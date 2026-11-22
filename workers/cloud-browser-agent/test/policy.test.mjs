import test from "node:test";
import assert from "node:assert/strict";
import { validateTarget, safeTitle } from "../src/policy.mjs";
const allow = "https://fin-kac.pages.dev,https://jp-realty.pages.dev";
test("accepts allowlisted HTTPS URL", () => assert.equal(validateTarget("https://fin-kac.pages.dev/app#section", allow), "https://fin-kac.pages.dev/app"));
test("blocks unapproved websites", () => assert.throws(() => validateTarget("https://example.com", allow)));
test("blocks localhost and HTTP", () => {
 assert.throws(() => validateTarget("http://fin-kac.pages.dev", allow));
 assert.throws(() => validateTarget("https://127.0.0.1", allow));
});
test("blocks credential-bearing URLs", () => assert.throws(() => validateTarget("https://a:b@fin-kac.pages.dev", allow)));
test("bounds title length", () => assert.equal(safeTitle("x".repeat(500)).length, 300));
