export function validateTarget(input, allowedOrigins) {
  if (typeof input !== "string" || input.length > 2048) throw new Error("Invalid URL");
  let url;
  try { url = new URL(input); } catch { throw new Error("Invalid URL"); }
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("HTTPS URL required");
  const allowed = new Set((allowedOrigins || "").split(",").map(s => s.trim()).filter(Boolean));
  if (!allowed.has(url.origin)) throw new Error("Origin not approved");
  url.hash = "";
  return url.href;
}
// Phase 1 deliberately blocks third-party resources and redirected network requests.
// This trades visual fidelity for a narrow network access policy.
export function canRequest(requestUrl, targetUrl) {
  try {
    const url = new URL(requestUrl);
    const target = new URL(targetUrl);
    return url.protocol === "https:" && url.origin === target.origin && !url.username && !url.password;
  } catch { return false; }
}
export function safeTitle(title) { return String(title || "").slice(0, 300); }

const unsafeNavigationPath = /(?:^|\/)(?:logout|log-out|signout|sign-out|delete|remove|destroy|unsubscribe|cancel|purchase|checkout|pay|transfer|withdraw|approve|confirm|execute|submit|publish|activate|disable|enable|trigger|run)(?:\/|$|[.-])/i;
export function validateReadOnlyLink(sourceInput, linkInput, allowedOrigins) {
  const source = new URL(validateTarget(sourceInput, allowedOrigins));
  const link = new URL(validateTarget(linkInput, allowedOrigins));
  if(source.origin!==link.origin)throw new Error("Cross-origin link refused");
  if(source.search||link.search)throw new Error("Navigation query parameters refused");
  if(unsafeNavigationPath.test(link.pathname))throw new Error("Action-like navigation path refused");
  return {source:source.href,link:link.href};
}

export function validateSafeReadUrl(input, allowedOrigins) {
  const url = new URL(validateTarget(input, allowedOrigins));
  if (url.search) throw new Error("Navigation query parameters refused");
  if (unsafeNavigationPath.test(url.pathname)) throw new Error("Action-like navigation path refused");
  return url.href;
}
