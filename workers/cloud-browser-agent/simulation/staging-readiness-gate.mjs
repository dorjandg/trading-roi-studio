// Design-only staging gate. Never imported by production Worker or MCP.
// A passing gate is a readiness assessment, NOT permission to execute website actions.
const required=["authenticatedPrincipal","originAllowlisted","independentApprovalVerifier","sessionBoundApproval","singleUseApproval","actionScopedApproval","durableAuditBeforeExecution","auditFailureBlocksExecution","networkEgressRestricted","navigationBlocked","cancellationFailClosed","productionWritesDisabled"];
export const STAGING_REQUIREMENTS=Object.freeze([...required]);
export function assessStagingReadiness(evidence) {
 if(!evidence || Object.getPrototypeOf(evidence)!==Object.prototype ||
    Object.keys(evidence).some(k=>!required.includes(k)) ||
    Object.values(evidence).some(v=>typeof v!=="boolean"))
   throw new Error("Invalid staging evidence");
 const missing=required.filter(k=>evidence[k]!==true);
 return Object.freeze({readyForSecurityReview:missing.length===0,executionAllowed:false,productionWritesAllowed:false,missing:Object.freeze(missing)});
}
