// ISOLATED DESIGN PROTOTYPE. Not imported by src/handler.mjs or src/mcp.mjs.
// A Playwright-compatible page can be injected only by an offline test harness.
// This module is intentionally hard-disabled; never enable execution in production.
import {validateInteractionProposal} from "../src/interaction-policy.mjs";
export const REAL_BROWSER_EXECUTION_ENABLED = false;
export async function prepareBrowserInteraction(page, input, approval) {
  const proposal=validateInteractionProposal(input);
  if (!approval || Object.getPrototypeOf(approval)!==Object.prototype ||
      Object.keys(approval).sort().join(",")!=="approved,scope" ||
      approval.approved!==true || approval.scope!=="isolated-browser-test")
    throw new Error("Isolated browser-test approval required");
  if (!page || typeof page.getByTestId!=="function") throw new Error("Invalid browser adapter");
  const locator=page.getByTestId(proposal.testId);
  if (!locator || typeof locator.count!=="function") throw new Error("Invalid locator");
  if (await locator.count()!==1) throw new Error("Element must match exactly once");
  if (typeof locator.evaluate!=="function") throw new Error("Element inspection unavailable");
  const metadata=await locator.evaluate(el=>({
    tag:el.tagName?.toLowerCase(),
    type:el.getAttribute?.("type")?.toLowerCase()||"",
    formAssociated:!!el.closest?.("form"),
    disabled:!!el.disabled,
    editable:!el.readOnly,
    contentEditable:!!el.isContentEditable,
    sensitive:!!el.closest?.("[data-sensitive], [aria-hidden='true']"),
    action:el.getAttribute?.("formaction")||""
  }));
  if(!metadata || metadata.disabled || metadata.sensitive || metadata.formAssociated || metadata.action)
    throw new Error("Unsafe browser element");
  if(proposal.kind==="click") {
    if(metadata.tag!=="button" || metadata.type!=="button")throw new Error("Only inert buttons supported");
  } else if(metadata.tag!=="input" || !["search","text"].includes(metadata.type) ||
            !metadata.editable || metadata.contentEditable)
    throw new Error("Only non-form plain-text inputs supported");
  // NO locator.click() or locator.fill() here: approval is a planning gate only.
  if(REAL_BROWSER_EXECUTION_ENABLED!==false)throw new Error("Execution flag unexpectedly changed");
  return Object.freeze({readyForReview:true,executed:false,executionAllowed:false,kind:proposal.kind,testId:proposal.testId});
}
