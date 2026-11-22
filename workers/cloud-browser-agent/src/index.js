import { launch } from "@cloudflare/playwright";
import { createHandler } from "./handler.mjs";
import { createMcpHandler } from "./mcp.mjs";

const handler=createHandler(launch);
const mcp=createMcpHandler(launch);
export default {
  fetch(request,env) {
    if(new URL(request.url).pathname==="/mcp")return mcp(request,env);
    return handler(request,env);
  }
};
