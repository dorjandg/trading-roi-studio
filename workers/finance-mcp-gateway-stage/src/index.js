// Isolated Finance MCP staging Worker. Deliberately inert until authentication,
// authorization, protocol and deployment tests are complete.
// No D1 bindings, secrets, upstream calls, or financial data access.
export default {
  async fetch() {
    return new Response(JSON.stringify({ error: "Gateway disabled" }), {
      status: 503,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff"
      }
    });
  }
};
