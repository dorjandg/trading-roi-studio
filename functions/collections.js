// Serve the real Collections page without redirecting /collections/ to itself.
// Cloudflare Pages exposes static build assets through env.ASSETS.
export async function onRequest({request,env}) {
  const url = new URL(request.url);
  url.pathname = '/collections/index.html';
  const response = await env.ASSETS.fetch(new Request(url.toString(), request));
  return response;
}
