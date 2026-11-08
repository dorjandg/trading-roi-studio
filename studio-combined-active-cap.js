/* Move the existing combined active-account limit into Capital & Account Allocation.
   The original input ID, persisted value, engine inputs and event listeners stay intact. */
(function(){
'use strict';
function init(){
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