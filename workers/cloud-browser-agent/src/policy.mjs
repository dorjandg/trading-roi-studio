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
export function safeTitle(title) {
  return String(title || "").slice(0, 300);
}
