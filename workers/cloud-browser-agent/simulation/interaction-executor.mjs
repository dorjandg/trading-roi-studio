// In-memory simulation only. This file is not imported by the worker or MCP.
// No browser, network, file, credential, or production adapter is accepted.
import {validateInteractionProposal} from "../src/interaction-policy.mjs";
const SIMULATOR = Symbol("isolated-interaction-simulator");
export function createDisposableInteractionPage(initialElements) {
  if (!initialElements || Object.getPrototypeOf(initialElements) !== Object.prototype) throw new Error("Invalid fixture");
  const elements = new Map();
  for (const [id, data] of Object.entries(initialElements)) {
    if (!data || Object.getPrototypeOf(data) !== Object.prototype ||
        !["button","input"].includes(data.type) || typeof data.value !== "string")
      throw new Error("Invalid fixture element");
    elements.set(id,{type:data.type,value:data.value,clicks:0});
  }
  return Object.freeze({
    [SIMULATOR]:true,
    snapshot(){return [...elements].map(([testId,el])=>({testId,...el}));},
    apply(proposal) {
      const element=elements.get(proposal.testId);
      if (!element) throw new Error("Element absent");
      if (proposal.kind==="click") {
        if (element.type!=="button") throw new Error("Not a button");
        element.clicks++;
      } else {
        if (element.type!=="input") throw new Error("Not an input");
        element.value=proposal.value;
      }
    }
  });
}
export function executeDisposableInteraction(page, input, approval) {
  const proposal=validateInteractionProposal(input);
  if (!page || page[SIMULATOR]!==true) throw new Error("Disposable simulation required");
  if (!approval || Object.getPrototypeOf(approval)!==Object.prototype ||
      Object.keys(approval).sort().join(",")!=="approved,scope" ||
      approval.approved!==true || approval.scope!=="disposable-fixture")
    throw new Error("Explicit fixture approval required");
  page.apply(proposal);
  return Object.freeze({simulated:true,productionWritesAllowed:false,kind:proposal.kind,testId:proposal.testId});
}
