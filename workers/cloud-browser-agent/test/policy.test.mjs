import test from "node:test";
import assert from "node:assert/strict";
import { validateTarget, canRequest, safeTitle } from "../src/policy.mjs";
const allow = "https://fin-kac.pages.dev,https://jp-realty.pages.dev";
test("accepts allowlisted HTTPS URL and strips fragment", () => assert.equal(validateTarget("https://fin-kac.pages.dev/app#section", allow), "https://fin-kac.pages.dev/app"));
test("blocks unapproved and deceptive subdomain websites", () => {
 assert.throws(() => validateTarget("https://example.com", allow));
 assert.throws(() => validateTarget("https://fin-kac.pages.dev.evil.com", allow));
});
test("blocks localhost, HTTP and malformed URLs", () => {
 for (const url of ["http://fin-kac.pages.dev", "https://127.0.0.1", "not-a-url"]) assert.throws(() => validateTarget(url, allow));
});
test("blocks credential-bearing URLs", () => assert.throws(() => validateTarget("https://a:b@fin-kac.pages.dev", allow)));
test("blocks empty allowlist", () => assert.throws(() => validateTarget("https://fin-kac.pages.dev", "")));
test("allows same-origin resource requests", () => assert.equal(canRequest("https://fin-kac.pages.dev/assets/main.css", "https://fin-kac.pages.dev/"), true));
test("blocks third-party network requests, including redirects", () => {
 for (const u of ["https://example.com/", "http://fin-kac.pages.dev/", "https://fin-kac.pages.dev.evil.com/"]) {
   assert.equal(canRequest(u, "https://fin-kac.pages.dev/"), false);
 }
});
test("bounds title length", () => assert.equal(safeTitle("x".repeat(500)).length, 300));
