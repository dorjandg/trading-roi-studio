// Development only. Start inside GitHub Codespaces; port forwarding must remain PRIVATE.
import {chromium} from "playwright";
import {createWikipediaViewerServer} from "./wikipedia-visual-viewer-server.mjs";
const viewer=await createWikipediaViewerServer(chromium);
console.log("API1_LOCAL_VIEWER_READY",viewer.url);
console.log("Open the forwarded Codespaces port in a browser; keep visibility PRIVATE.");
const shutdown=async()=>{await viewer.close();process.exit(0);};
process.once("SIGINT",shutdown);
process.once("SIGTERM",shutdown);
