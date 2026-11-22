// Dedicated isolated Finance API Worker. Never bind production finance-hub-db.
// Cloudflare Access must protect the eventual private route before deployment.
import { onRequest } from "../../functions/api/finance.js";
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/finance") return new Response("Not found", { status: 404 });
    return onRequest({ request, env, waitUntil: ctx.waitUntil.bind(ctx), passThroughOnException: () => {} });
  }
};
