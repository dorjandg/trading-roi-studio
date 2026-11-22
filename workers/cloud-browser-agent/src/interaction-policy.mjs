// Phase 1: pure validation only. Never connected to a deployed browser endpoint.
const allowedKinds = new Set(["click","fill"]);
const safeAttribute = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const dangerous = /(?:submit|save|delete|remove|pay|purchase|transfer|withdraw|approve|confirm|publish|upload|logout|signout|execute|send|order|checkout|password|passwd|secret|token|credential|auth|login|signin)/i;
export function validateInteractionProposal(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype) throw new Error("Invalid proposal");
  const keys = Object.keys(input).sort().join(",");
  if (!allowedKinds.has(input.kind)) throw new Error("Unsupported interaction");
  if (typeof input.testId !== "string" || !safeAttribute.test(input.testId) || dangerous.test(input.testId)) throw new Error("Unsafe test identifier");
  if (input.kind === "click") {
    if (keys !== "kind,testId") throw new Error("Unexpected click fields");
    return Object.freeze({kind:"click",testId:input.testId,requiresApproval:true,executionAllowed:false});
  }
  if (keys !== "kind,testId,value" || typeof input.value !== "string" || input.value.length > 256) throw new Error("Invalid fill proposal");
  return Object.freeze({kind:"fill",testId:input.testId,value:input.value,requiresApproval:true,executionAllowed:false});
}
