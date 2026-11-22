import {forwardAuthorizedMcp} from "./forward.mjs";

// FAIL CLOSED: Do not deploy before integrating a real OAuth 2.1 authorization server
// that verifies user identity, consent, audience, token expiry and mcp:read scope.
// Never accept identity from a plain HTTP header, query string or request body.
export default {
  fetch() {
    return new Response(JSON.stringify({error:"OAuth gateway not configured"}),{
      status:503,headers:{"content-type":"application/json","cache-control":"no-store"}
    });
  }
};
export {forwardAuthorizedMcp};
