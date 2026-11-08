/* Move the existing combined active-account limit into Capital & Account Allocation.
   The original input ID, persisted value, engine inputs and event listeners stay intact. */
(function(){
'use strict';
function stageLegend(){
 const root=document.getElementById('journeyContents');if(!root||root.querySelector('[data-stage-count-legend]'))return;
 const legend=document.createElement('div');legend.dataset.stageCountLegend='1';
 legend.className='hint';legend.style.cssText='font-size:11px;line-height:1.5;margin:5px 0 8px;padding:7px 9px;border:1px solid var(--border,#354359);border-radius:7px';
 legend.textContent='Active stages: P1 = Challenge; P2 = Verification; P3 = Funded (includes payout-pending); P4 = payout-pending subset of P3, not an extra account. P1 pass / P2 pass = cumulative completed milestones, not active accounts. Combined allocation = P1 + P2 + P3 + activation-wait accounts; never add P4 again.';
 root.prepend(legend);
}
function init(){
 stageLegend();
 const root=document.getElementById('journeyContents');if(root)new MutationObserver(stageLegend).observe(root,{childList:true});
 const panel=document.querySelector('#capitalAllocationPanel .capital-limit-fields');
 const field=document.getElementById('maxActive')?.closest('.field');
 const mode=document.getElementById('capacityMode');
 const input=document.getElementById('maxActive');
 const manual=document.getElementById('manualCapacityFields');
 if(!panel||!field||!mode||!input||!manual)return;
 if(field.parentElement!==panel)panel.prepend(field);
 const label=field.querySelector('label');
 if(label)label.textContent='Max active accounts · all stages';
 input.title='Combined simultaneous Challenge + Verification + Funded accounts, including activation wait and payout pending. Total purchases over time may be higher.';
 const note=document.createElement('small');
 note.className='hint';
 note.textContent='CH + VR + Funded together. 20 means 20 total, not 20 per stage.';
 field.append(note);
 // Explicit manual mode ensures the entered limit is enforced by the engine.
 function activateLimit(){
   if(mode.value!=='manual'){mode.value='manual';mode.dispatchEvent(new Event('change',{bubbles:true}));}
 }
 input.addEventListener('change',activateLimit);
 // Manual capacity is needed when a combined cap is configured.
 if(mode.value==='manual')manual.hidden=false;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();