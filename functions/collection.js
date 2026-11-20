export async function onRequestGet({request,env}) {
  const url = new URL(request.url);
  url.pathname = '/staff/collection.html';
  return env.ASSETS.fetch(new Request(url.toString(), request));
}
