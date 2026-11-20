// Legacy collection route: always use the maintained static collection catalog.
export async function onRequest({request}) {
  const incoming = new URL(request.url);
  const target = new URL('/collections/', incoming.origin);
  target.search = incoming.search;
  return Response.redirect(target.toString(), 302);
}
