import { validateTarget, canRequest, safeTitle } from "./policy.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: {
    "content-type": "application/json",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  }
});

export async function authorized(request, env) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!env.AGENT_API_TOKEN || !token || token.length > 512) return false;
  const enc = new TextEncoder();
  const [a,b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(token)),
    crypto.subtle.digest("SHA-256", enc.encode(env.AGENT_API_TOKEN))
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let mismatch = 0;
  for (let i=0;i<x.length;i++) mismatch |= x[i]^y[i];
  return mismatch===0;
}

export function createHandler(launch) {
  return async function fetch(request, env) {
    if (!(await authorized(request, env))) return json({error:"Unauthorized"},401);
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/health")
      return json({service:"cloud-browser-agent",mode:"read-only",browserConfigured:!!env.BROWSER});
    if (request.method !== "POST" || !["/inspect","/screenshot"].includes(path))
      return json({error:"Not found"},404);

    if (Number(request.headers.get("content-length") || "0") > 4096)
      return json({error:"Request too large"},413);
    const bodyText = await request.text();
    if (bodyText.length > 4096) return json({error:"Request too large"},413);
    let body;
    try { body = JSON.parse(bodyText); } catch { return json({error:"Invalid JSON"},400); }
    let target;
    try { target = validateTarget(body?.url, env.ALLOWED_ORIGINS); }
    catch(e) { return json({error:e.message},400); }
    if (!env.BROWSER) return json({error:"Browser binding unavailable"},503);

    let browser;
    let context;
    try {
      browser = await launch(env.BROWSER);
      context = await browser.newContext({serviceWorkers:"block",acceptDownloads:false});
      const page = await context.newPage();
      page.on("dialog", d => { d.dismiss().catch(()=>{}); });
      context.on("page", newPage => { if(newPage !== page) newPage.close().catch(()=>{}); });
      await context.route("**/*", async route => {
        if (!canRequest(route.request().url(), target)) return route.abort();
        return route.continue();
      });
      const started = Date.now();
      const response = await page.goto(target,{waitUntil:"domcontentloaded",timeout:20000});
      if (new URL(page.url()).origin !== new URL(target).origin) throw new Error("Cross-origin navigation refused");
      const title = safeTitle(await page.title());
      if (path === "/screenshot") {
        const bytes = await page.screenshot({type:"png",fullPage:false});
        return new Response(bytes,{headers:{"content-type":"image/png","cache-control":"no-store","x-content-type-options":"nosniff"}});
      }
      const headings = await page.locator("h1, h2").allTextContents();
      const links = await page.locator("a[href]").count();
      return json({
        requestedUrl:target,finalUrl:page.url(),httpStatus:response?.status()??null,
        title,headings:headings.slice(0,12).map(s=>s.trim().slice(0,200)),linkCount:links,
        durationMs:Date.now()-started,readOnly:true
      });
    } catch {
      return json({error:"Browser inspection failed",code:"INSPECTION_FAILED"},502);
    } finally {
      if(context) await context.close().catch(()=>{});
      if(browser) await browser.close().catch(()=>{});
    }
  };
}
