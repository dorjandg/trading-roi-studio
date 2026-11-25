// Inspect structure only. Never collect values, files, credentials, hidden input data,
// user-typed text, form submission payloads or DOM outerHTML.
const danger = /password|passcode|secret|token|api.?key|credential|otp|2fa|auth|card|cvv|cvc|iban|account|routing|ssn|tax|passport|identity|private|wallet|seed|recovery/i;
const clamp = (v,n=80) => String(v || "").replace(/[\r\n\t]+/g," ").trim().slice(0,n);
export function sanitizeFormInventory(raw) {
  const result=[];
  for(const form of Array.isArray(raw)?raw.slice(0,12):[]){
    if(!form || typeof form!=="object") continue;
    const fields=[];
    for(const input of Array.isArray(form.fields)?form.fields.slice(0,80):[]){
      if(!input || typeof input!=="object") continue;
      const type=clamp(input.type||"text",24).toLowerCase();
      const label=clamp(input.label);
      const name=clamp(input.name);
      if(["hidden","password","file"].includes(type) || danger.test(name+" "+label+" "+(input.autocomplete||"")))continue;
      if(!["text","email","tel","number","date","datetime-local","time","url","search","textarea","select-one","select-multiple","checkbox","radio"].includes(type))continue;
      fields.push({
        type,
        label:danger.test(label)?"":label,
        required:input.required===true,
        disabled:input.disabled===true,
        editable:input.disabled!==true && input.readonly!==true
      });
    }
    result.push({
      index:result.length+1,
      method:clamp(form.method||"GET",8).toUpperCase()==="GET"?"GET":"NON_GET",
      fieldCount:fields.length,
      fields
    });
  }
  return {forms:result,formCount:result.length,readOnly:true,valuesCollected:false,submissionsAllowed:false,uploadsAllowed:false};
}
export function inventoryBrowserScript(){
  return Array.from(document.forms).slice(0,12).map(form=>({
    method:form.method,
    fields:Array.from(form.elements).slice(0,80).map(el=>({
      type:el.tagName==="TEXTAREA"?"textarea":el.type,
      label:el.labels?.[0]?.innerText || "",
      name:el.name||"",
      autocomplete:el.autocomplete||"",
      required:el.required,
      disabled:el.disabled,
      readonly:el.readOnly
    }))
  }));
}
// Reserve approvals for a later, separate, audited, write-enabled deployment.
// There is deliberately NO write-capable tool in the current MCP protocol.
export function prepareWriteApproval(){
  return {approved:false,enabled:false,reason:"Write operations are disabled in Phase 2 staging"};
}
