import { launch } from "@cloudflare/playwright";
import { createHandler } from "./handler.mjs";

// Browser binding runs in Cloudflare; business logic is independently testable.
export default { fetch: createHandler(launch) };
