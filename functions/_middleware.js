// Personal Hub password gate
// Secret must be configured in Cloudflare Pages: HUB_PASSWORD
// This middleware runs before every page and static file (see _routes.json).
// It deliberately fails closed when the secret is absent.
const COOKIE = "personal_hub_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();

function constantTimeEqual(left, right) {
  if (left.byteLength !== right.byteLength) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left[i] ^ right[i];
  return mismatch === 0;
}

async function hash(value) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return new Uint8Array(bytes);
}

async function passwordMatches(candidate, secret) {
  const [a, b] = await Promise.all([hash(candidate), hash(secret)]);
  return constantTimeEqual(a, b);
}

async function sessionKey(secret) {
  return crypto.subtle.importKey(
    "raw", encoder.encode("personal-hub-session-v1:" + secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
}

async function signature(secret, expiration) {
  const key = await sessionKey(secret);
  const bytes = new Uint8Array(await crypto.subtle.sign(
    "HMAC", key, encoder.encode("personal-hub:" + expiration)
  ));
  return [...bytes].map(byte => byte.toString(16).padStart(2,"0")).join("");
}

function readCookie(request) {
  const raw = request.headers.get("Cookie") || "";
  const part = raw.split(";").map(piece => piece.trim())
    .find(piece => piece.startsWith(COOKIE + "="));
  return part ? part.slice(COOKIE.length + 1) : "";
}

async function validSession(request, secret) {
  const value = readCookie(request);
  const parts = value.split(".");
  if (parts.length !== 2) return false;
  const [rawExpiration, rawSig] = parts;
  if (!/^\d{10,13}$/.test(rawExpiration) || !/^[a-f0-9]{64}$/.test(rawSig)) return false;
  const expiration = Number(rawExpiration);
  if (!Number.isSafeInteger(expiration)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (expiration <= now || expiration > now + SESSION_SECONDS) return false;
  const expected = await signature(secret, rawExpiration);
  return constantTimeEqual(encoder.encode(rawSig), encoder.encode(expected));
}

const loginStyle = `
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:radial-gradient(ellipse at 50% 0%,rgba(90,95,230,.18),transparent 58%),#0b1020;color:#f1f5ff;font:14px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
.panel{width:min(390px,100%);padding:30px 28px;background:#111a2b;border:1px solid #263148;border-radius:18px;box-shadow:0 20px 70px #0004}
.mark{display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:#242b51;color:#b0b4ff;font-size:26px;margin-bottom:20px}
.kicker{font-size:10px;letter-spacing:2px;color:#a5a9fd;font-weight:800;margin-bottom:8px}
h1{font-size:25px;letter-spacing:-.7px;margin:0}
p{font-size:12px;color:#a1acc3;margin:9px 0 24px}
label{display:block;font-size:12px;font-weight:700;margin-bottom:8px}
input{width:100%;padding:13px 14px;background:#0b1020;border:1px solid #35405b;border-radius:10px;color:#fff;outline:none}
input:focus{border-color:#8a91ff;box-shadow:0 0 0 3px #8a91ff22}
button{width:100%;border:0;border-radius:10px;margin-top:14px;padding:13px;background:#6672ec;color:white;font:700 13px system-ui,sans-serif;cursor:pointer}
button:hover{background:#7d85ff}
.error{font-size:12px;margin:0 0 16px;color:#fda4af}
small{display:block;color:#7f8da7;text-align:center;font-size:10px;margin-top:21px}
`;

function layout(message = "", unavailable = false) {
  const title = unavailable ? "Temporarily unavailable" : "Private Personal Hub";
  const description = unavailable
    ? "Password protection is being configured. Please try again after setup is complete."
    : "Enter the shared password to open your personal dashboard.";
  const main = unavailable ? "" :
    '<form method="post" action="/_hub-login">' +
    '<label for="password">Website password</label>' +
    '<input id="password" name="password" type="password" required autofocus autocomplete="current-password" maxlength="256">' +
    '<button type="submit">Unlock Personal Hub</button></form>';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex, nofollow"><title>' + title + '</title>' +
    '<style>' + loginStyle + '</style></head><body><main class="panel">' +
    '<div class="mark" aria-hidden="true">◇</div><div class="kicker">PERSONAL HUB</div>' +
    '<h1>' + title + '</h1><p>' + description + '</p>' +
    (message ? '<div class="error" role="alert">' + message + '</div>' : "") +
    main + '<small>Protected access · hub.immamarketing.com</small>' +
    '</main></body></html>';
}

function htmlResponse(message, status, unavailable=false) {
  return new Response(layout(message, unavailable), {
    status,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
    }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const secret = typeof env.HUB_PASSWORD === "string" ? env.HUB_PASSWORD : "";
  if (!secret) return htmlResponse("", 503, true);

  const path = new URL(request.url).pathname;
  if (path === "/_hub-login") {
    if (request.method === "POST") {
      let candidate;
      try {
        const form = await request.formData();
        candidate = form.get("password");
      } catch {
        return htmlResponse("Please enter the password again.", 400);
      }
      if (typeof candidate !== "string" || candidate.length > 256 ||
          !(await passwordMatches(candidate, secret))) {
        return htmlResponse("Incorrect password. Please try again.", 401);
      }
      const expiration = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
      const token = expiration + "." + (await signature(secret, expiration));
      return new Response(null, {
        status: 303,
        headers: {
          "Location": "/",
          "Set-Cookie": COOKIE + "=" + token +
            "; Path=/; Max-Age=" + SESSION_SECONDS + "; HttpOnly; Secure; SameSite=Lax",
          "Cache-Control": "no-store"
        }
      });
    }
    if (request.method === "GET") {
      if (await validSession(request, secret)) {
        return Response.redirect(new URL("/", request.url), 302);
      }
      return htmlResponse("", 200);
    }
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (path === "/_hub-logout" && request.method === "GET") {
    return new Response(null, {
      status: 303,
      headers: {
        "Location": "/",
        "Set-Cookie": COOKIE + "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
        "Cache-Control": "no-store"
      }
    });
  }

  if (!(await validSession(request, secret))) {
    return htmlResponse("", 401);
  }

  return context.next();
}
