/* Trading Studio local knowledge index — read-only and API-free. */
(function(root){'use strict';
const sections=[
 {id:'section1Panel',keys:['inputs','parameter','setup','configuration','section 1'],title:'Section 1 · Investment & simulation inputs',info:'Controls starting budget, net-profit goal, assumed trade win rate, trading-day horizon, signals, trial count, correlated trade outcomes, account purchasing, capacity and reinvestment. Editing inputs alone does not rerun the Monte Carlo model.'},
 {id:'section2Panel',keys:['run simulation','section 2','full simulation','run estimate'],title:'Section 2 · Full simulation',info:'Runs the Monte Carlo portfolio engine with the currently selected assumptions and saved phase strategies. A new run is required after changing parameters to refresh result-dependent explanations.'},
 {id:'section3Panel',keys:['investment optimizer','calculate investment','section 3','optimizer'],title:'Investment optimizer',info:'Calculate Investment searches or compares investment choices. It is not equivalent to Run Full Simulation. Verify the result source label before interpreting any figures.'},
 {id:'section4Panel',keys:['section 5','results dashboard','results across','comparison table'],title:'Section 5 · Results',info:'Displays modeled purchases, phase passes, funded and first-paid accounts, total spend, receipts, expected net profit, ROI and payout probability. Comparisons are separate alternatives unless split-budget mode is selected.'},
 {id:'chartsPanel',keys:['chart','equity curve','drawdown','distribution','section 6'],title:'Section 6 · Charts',info:'Charts visualize Monte Carlo scenarios and their outcomes. A single sampled trial is not the average result, and P10/median/P90 describe a distribution rather than guaranteed outcomes.'},
 {id:'journeyPanel',keys:['journey','day by day','transition','section 7','account timeline'],title:'Section 7 · Account Journey',info:'Tracks modeled account progression through purchased evaluation, phase transitions, funded target and first payout across trading days. Use it to understand timing and how account counts evolve.'},
 {id:'section7Panel',keys:['trade risk','detailed account','section 8','stop loss','risk profile'],title:'Section 8 · Trade Risks & Detailed Accounts',info:'Shows selected per-stage risk settings and illustrative trade histories. Example account traces come from sampled trials and must not be treated as measured averages or real trading records.'},
 {id:'section9Panel',keys:['spending ledger','daily spending','section 9','cash flow','daily cost'],title:'Section 9 · Daily Spending',info:'Daily spending includes modeled challenge purchases and other applicable costs; cash receipts may arrive later than evaluation passes or funded targets. The ledger helps identify when money is spent and returned.'},
 {id:'section8Panel',keys:['history','saved run','section 10','past simulation'],title:'Section 10 · Simulation History',info:'Stores saved calculation and simulation snapshots. Calculate Investment and Run Simulation are different run types; check the saved type and timestamp before comparisons.'},
 {id:'gptResearchPanel',keys:['research','section 11','gpt review','question tracker','evidence'],title:'Section 11 · GPT Research',info:'Contains reviewed findings and a GPT-review request queue. The local assistant is separate from scheduled research; unanswered questions are saved in this browser until you queue an external review.'}
];
const definitions=[
 {keys:['win rate','winrate','winning percentage'],ids:['winRate'],explain:'Trade win rate is the assumed chance a trade signal wins. It is not the evaluation pass probability or the first-payout probability. Results also depend on R:R, stage risk, stop limits and time horizon.'},
 {keys:['trials','monte carlo','simulation count'],ids:['trials'],explain:'The trial count is the number of repeated simulated portfolio outcomes. More trials reduce sampling noise but do not fix uncertain assumptions or guarantee accuracy.'},
 {keys:['seed','random seed'],ids:['seed'],explain:'The random seed makes a simulation repeatable with the same model, inputs and implementation. Changing the seed explores another random sample, not a different trading strategy.'},
 {keys:['trade signals','signals per day','trades per day','trading frequency'],ids:['signalPace','tradesPerDay'],explain:'Trade signals represent opportunities for the portfolio. They are not automatically one trade per purchased account: available accounts, stage rules and signal-sharing logic decide how opportunities are used.'},
 {keys:['signal mode','shared signals','correlated','independent outcomes'],ids:['signalMode'],explain:'Shared/correlated signals can cause several accounts to win or lose together. Independence is a modeling assumption; using it when real trades share signals can overstate diversification.'},
 {keys:['purchase mode','challenge purchases','recycle','upfront'],ids:['purchaseMode'],explain:'Purchase mode decides whether challenges are bought at the start or dynamically as trading slots and budget become available. It can change both fee timing and the number of accounts purchased.'},
 {keys:['capacity','simultaneous accounts','max active','allocation'],ids:['capacityMode','maxActive'],explain:'Capacity restricts how many accounts the simulated portfolio can trade simultaneously. It can limit account usage even when the signal schedule has many opportunities.'},
 {keys:['new accounts per day','buys per day'],ids:['maxBuysPerDay'],explain:'This caps the number of new account purchases per modeled day; it is separate from trade signals and concurrent trading capacity.'},
 {keys:['reinvest','reinvestment'],ids:['reinvestPayouts'],explain:'Reinvestment controls whether modeled payout proceeds can finance new challenges. It is a planning assumption, not actual money available before payout eligibility and receipt.'},
 {keys:['time horizon','trading days','days'],ids:['days'],explain:'The horizon is trading days, not calendar days. A shorter horizon can prevent funded targets or delayed first payouts from appearing in results.'},
 {keys:['budget','starting capital'],ids:['budget'],explain:'Starting budget is the cash available to the simulated portfolio. It differs from total spent across replacements and from net profit.'},
 {keys:['goal','target net','profit target'],ids:['netGoal'],explain:'The net goal is the desired receipts minus modeled expenses. Goal-hit probability is obtained from simulated trials; it is not the same as expected net.'}
];
function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9% ]/g,' ').replace(/\s+/g,' ').trim()}
function values(ids){return ids.map(id=>{let e=document.getElementById(id);if(!e)return null;let label=document.querySelector('label[for="'+id+'"]');let val=e.tagName==='SELECT'?(e.selectedOptions?.[0]?.textContent?.trim()||e.value):e.value;return (label?.textContent?.trim().replace(/\s+/g,' ')||id)+': '+val}).filter(Boolean)}
function fieldMatch(q){
 const nq=norm(q);const exact=definitions.filter(d=>d.keys.some(k=>nq.includes(k)));if(!exact.length)return null;
 const d=exact.sort((a,b)=>Math.max(...b.keys.map(k=>k.length))-Math.max(...a.keys.map(k=>k.length)))[0];
 const current=values(d.ids);return [d.explain+(current.length?'\nCurrent website input: '+current.join(' · '):'')+'\nSource: Trading Studio input labels and documented model rules.','Website parameters · High',false];
}
function sectionMatch(q){
 const nq=norm(q);const scored=sections.map(s=>({s,score:Math.max(0,...s.keys.filter(k=>nq.includes(k)).map(k=>k.length))})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
 if(!scored.length)return null;const s=scored[0].s;const element=document.getElementById(s.id);
 return [s.title+'\n'+s.info+(element?'\nLocation: available in this Portfolio Simulator page.':'\nLocation: this section may be hidden or unavailable in the current page.')+'\nSource: website section documentation.','Website guide · High',false];
}

function currentContext(){
 const selected=document.querySelector('main .page.active')||document.querySelector('.page.active');
 const scope=selected||document.querySelector('main')||document.body;
 const page=selected?.id?.replace(/^page-/,'')||document.title||'Trading Studio';
 const visible=el=>{if(el.closest('#studioFloatingAI'))return false;if(el.type==='password'||el.type==='hidden'||el.disabled)return false;
   const st=typeof getComputedStyle==='function'?getComputedStyle(el):null;
   return (!st||st.display!=='none'&&st.visibility!=='hidden')&&!!(el.getClientRects?.().length||el.offsetParent)};
 const items=Array.from(scope.querySelectorAll('input,select')).filter(visible).slice(0,120).map(el=>{
  const name=(el.labels?.[0]?.textContent||document.querySelector('label[for="'+el.id+'"]')?.textContent||el.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,75);
  if(!name||/password|api key|secret|token|email|credential/i.test(name))return null;
  const value=el.type==='checkbox'?String(el.checked):el.tagName==='SELECT'?(el.selectedOptions?.[0]?.textContent||el.value):el.value;
  if(!value||String(value).length>90)return null;
  return {name,value:String(value).slice(0,90)};
 }).filter(Boolean).slice(0,35);
 const heads=Array.from(scope.querySelectorAll('h1,h2,h3')).filter(visible).slice(0,8).map(el=>el.textContent.trim().slice(0,90));
 return {page,items,heads};
}
function pageAnswer(q){
 const text=norm(q),context=currentContext();
 if(!/(this page|this tab|current page|current tab|visible|on this page|what are the parameters|which parameters|what settings|my settings|current settings|what value|which value)/.test(text)&&!/(overview|firm|labs|preset|profile)/.test(text))return null;
 let matched=context.items.filter(i=>text.includes(norm(i.name))||norm(i.name).split(' ').some(w=>w.length>=5&&text.includes(w)));
 if(!matched.length)matched=context.items.slice(0,10);
 const shown=matched.slice(0,12).map(i=>i.name+': '+i.value);
 const head='Current view: '+context.page+'.'+(context.heads.length?'\nVisible sections: '+context.heads.slice(0,4).join(' · ')+'.':'');
 return [head+(shown.length?'\nVisible inputs: '+shown.join(' · '):'\nThere are no readable visible input values in this view.')+
 '\nThese are browser-visible values only; not saved cloud results, and no setting was changed.','Current website UI · High',false];
}
function answer(q){
 const onPage=pageAnswer(q);if(onPage)return onPage;
 const nq=norm(q);
 if(/what (is|does|means)|explain|define|how (does|do)|where|which section|show me|parameter|setting|input/.test(nq)){
   return fieldMatch(q)||sectionMatch(q);
 }
 return null;
}
root.StudioKnowledge={answer,fieldMatch,sectionMatch,pageAnswer,currentContext,sections:sections.map(s=>({id:s.id,title:s.title}))};
})(window);