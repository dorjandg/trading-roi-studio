export async function onRequestGet({request,env}) {
  const url = new URL(request.url);
  url.pathname = '/staff/collections.html';
  return env.ASSETS.fetch(new Request(url.toString(), request));
}
