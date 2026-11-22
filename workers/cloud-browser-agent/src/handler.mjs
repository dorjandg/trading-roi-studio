import { validateTarget, validateReadOnlyLink, canRequest, safeTitle } from "./policy.mjs";
import { inventoryBrowserScript, sanitizeFormInventory } from "./form-inventory.mjs";
import { validateEditPreviewRequest, buildEditPreview } from "./edit-preview.mjs";

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
    if (request.method !== "POST" || !["/inspect","/screenshot","/links","/follow","/forms","/edit-preview"].includes(path))
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
    let proposal;
    if(path === "/edit-preview"){
      try { proposal = validateEditPreviewRequest(body,env.ALLOWED_ORIGINS); }
      catch(e){ return json({error:e.message},400); }
    }
    let destination;
    if(path === "/follow") {
      try {
        if(!body||typeof body.linkUrl!=="string"||Object.keys(body).sort().join(",")!=="linkUrl,url")throw new Error("Only source URL and link URL are permitted");
        destination=validateReadOnlyLink(target,body.linkUrl,env.ALLOWED_ORIGINS).link;
      } catch(e) { return json({error:e.message},400); }
    }
    if (!env.BROWSER) return json({error:"Browser binding unavailable"},503);

    let browser;
    let context;
    let stage="launch";
    try {
      stage="launch";
      browser = await launch(env.BROWSER);
      context = await browser.newContext({serviceWorkers:"block",acceptDownloads:false});
      const page = await context.newPage();
      page.on("dialog", d => { d.dismiss().catch(()=>{}); });
      context.on("page", newPage => { if(newPage !== page) newPage.close().catch(()=>{}); });
      await context.route("**/*", async route => {
        if (!canRequest(route.request().url(), target)) return route.abort();
        if (!["GET","HEAD"].includes(route.request().method())) return route.abort();
        return route.continue();
      });
      const started = Date.now();
      stage="source-navigation";
      const response = await page.goto(target,{waitUntil:"domcontentloaded",timeout:20000});
      if (new URL(page.url()).origin !== new URL(target).origin) throw new Error("Cross-origin navigation refused");
      if (path === "/follow") {
        stage="find-source-links";
        const sourceLinks = await page.locator("a[href]").evaluateAll(els =>
          els.slice(0,500).map(el => el.href));
        // Navigation is permitted only if an actual link on the source page exists.
        if(!sourceLinks.some(href=>{try {
          const u=new URL(typeof href==="string"?href:href?.href);
          u.hash="";return u.href===destination;
        }catch{return false;}}))return json({error:"Destination is not a link on the source page"},400);
        stage="destination-navigation";
        const next=await page.goto(destination,{waitUntil:"domcontentloaded",timeout:20000});
        // Canonical redirects are acceptable only within the same exact origin and safe GET paths.
        validateReadOnlyLink(target,page.url(),env.ALLOWED_ORIGINS);
        stage="extract-destination";
        const headings=await page.locator("h1, h2").allTextContents();
        return json({sourceUrl:target,finalUrl:page.url(),httpStatus:next?.status()??null,title:safeTitle(await page.title()),headings:headings.slice(0,12).map(s=>s.trim().slice(0,200)),readOnly:true,method:"GET",clicked:false});
      }
      const title = safeTitle(await page.title());
      if(path === "/edit-preview") {
        stage="preview-read-only-form-inventory";
        const raw = await page.evaluate(inventoryBrowserScript);
        try { return json(buildEditPreview(proposal,raw)); }
        catch(e){ return json({error:e.message,executionAllowed:false},400); }
      }
      if(path === "/forms"){
        const raw = await page.evaluate(inventoryBrowserScript);
        return json({requestedUrl:target,finalUrl:page.url(),title,...sanitizeFormInventory(raw)});
      }
      if (path === "/screenshot") {
        const bytes = await page.screenshot({type:"png",fullPage:false});
        return new Response(bytes,{headers:{"content-type":"image/png","cache-control":"no-store","x-content-type-options":"nosniff"}});
      }
      if (path === "/links") {
        const hrefs = await page.locator("a[href]").evaluateAll(els =>
          els.slice(0, 200).map(el => ({href:el.href, text:(el.innerText||el.textContent||"").trim().slice(0,100)})));
        const origin = new URL(target).origin;
        const seen = new Set(), links = [];
        for (const item of hrefs) {
          try {
            const destination = new URL(item.href);
            if (destination.origin !== origin || destination.protocol !== "https:" ||
                destination.username || destination.password) continue;
            destination.search=""; destination.hash="";
            if (seen.has(destination.href)) continue;
            seen.add(destination.href);
            links.push({url:destination.href,text:String(item.text||"").slice(0,100)});
            if (links.length === 30) break;
          } catch { /* malformed link is skipped */ }
        }
        return json({requestedUrl:target,finalUrl:page.url(),title,links,readOnly:true,queryParametersRemoved:true});
      }
      const headings = await page.locator("h1, h2").allTextContents();
      const links = await page.locator("a[href]").count();
      return json({
        requestedUrl:target,finalUrl:page.url(),httpStatus:response?.status()??null,
        title,headings:headings.slice(0,12).map(s=>s.trim().slice(0,200)),linkCount:links,
        durationMs:Date.now()-started,readOnly:true
      });
    } catch {
      return json({error:"Browser inspection failed",code:"INSPECTION_FAILED",stage},502);
    } finally {
      if(context) await context.close().catch(()=>{});
      if(browser) await browser.close().catch(()=>{});
    }
  };
}
