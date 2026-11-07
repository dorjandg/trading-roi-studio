/* 4Ds Studio formula/data lineage knowledge and strict invariant audit.
   Scope: verified Portfolio Engine formulas. No broker data and no writes. */
(function(root){'use strict';
const entries=[
 {id:'net',name:'Expected net P/L',terms:['net profit','expected net','net pnl','net p l','net cash','how net'],formula:'Expected net = average cash receipts − average total spending.',inputs:'avg.receipts, avg.spent (cash from Monte Carlo trials)',source:'portfolio-engine.js · simulatePortfolio / oneTrial',output:'Section 5 net, cash ledger, ROI numerator',caveat:'Includes modeled spending; not a funded account balance or received real cash.'},
 {id:'roi',name:'Modeled net ROI',terms:['roi','return on investment','return percentage','net return','roi calculation'],formula:'ROI = avg.net / avg.spent if avg.spent > 0; otherwise 0. Website shows 100 × ROI%.',inputs:'avg.net and avg.spent',source:'portfolio-engine.js · simulatePortfolio return.roi',output:'Section 5 portfolio comparison, KPI cards',caveat:'Total modeled spending is the denominator, not initial budget. Independent alternatives must not be summed.'},
 {id:'payoutchance',name:'Probability of at least one first payout',terms:['payout chance','chance of payout','probability of payout','first payout probability','payout probability'],formula:'chancePayout = count(trials where paid > 0) / trial count.',inputs:'per-trial first-paid account count; trials',source:'portfolio-engine.js · simulatePortfolio trial loop',output:'Section 5 chance of ≥1 payout',caveat:'A simulated probability, not the share of purchased accounts that got paid.'},
 {id:'goalchance',name:'Probability of reaching net goal',terms:['chance goal','net goal probability','chance of goal','target probability','goal hit'],formula:'chanceGoal = count(trials with net ≥ positive netGoal) / trials; null when goal = 0.',inputs:'per-trial net, configured positive netGoal, trials',source:'portfolio-engine.js · simulatePortfolio',output:'Section 5 chance net ≥ goal',caveat:'Goals are cash-based modeled net P/L, not funded profit target.'},
 {id:'funnel',name:'Account stage funnel',terms:['stage funnel','phase conversion','funded conversion','funded rate','phase pass','account funnel'],formula:'Stage conversion = average next-stage account count / average previous-stage account count (when previous > 0). Overall conversion divides by average purchased.',inputs:'avg.bought, result.stages, avg.funded, avg.targetHit, avg.payoutRequested, avg.paid',source:'portfolio-engine.js · stageFunnel',output:'Section 5 progression and Section 7 journey',caveat:'Ratios of averaged counts; not individual trade win rate, and not a guarantee of future pass rate.'},
 {id:'spend',name:'Modeled spending and fees',terms:['fees','spent','spending','expenses','cost per','challenge cost'],formula:'avg.spent = mean realized modeled spending over Monte Carlo trials (including applicable purchases and activation fees).',inputs:'per-trial spent ledger, program fee and activation charges',source:'portfolio-engine.js · oneTrial / simulatePortfolio',output:'Section 5 spend, Section 9 daily ledger, ROI denominator',caveat:'Not necessarily equal to upfront starting budget; real provider charges, renewal or activation details may differ.'},
 {id:'trades',name:'Win rate and average trade expectancy',terms:['win rate formula','trade expectancy','trade win rate','expected r','profit factor'],formula:'Realized modeled WR = total winning trades / total trades. Average realized R = total R / trades. Trade EV = trade P/L / trade count. Profit factor = gross profit / gross loss (where defined).',inputs:'wins, trades, totalR, tradePnl, grossProfit, grossLoss across Monte Carlo runs',source:'portfolio-engine.js · tradeKpis',output:'Section 8 trade KPIs',caveat:'Assumed input winRate differs from measured simulated trade outcomes; trade EV includes modeled costs.'},
 {id:'purchase',name:'Account purchases and allocation',terms:['account count','number of accounts','buy challenges','maximum active','capacity','purchases'],formula:'Upfront purchase capacity depends on floor(budget / (fee + reserved Topstep activation fee)), account cap and allocation cap. Recycle purchasing reuses available slots subject to modeled constraints.',inputs:'budget, fee, activationFee, allocation caps, maxAccounts, maxActive, purchase mode, maxBuysPerDay',source:'portfolio-engine.js · simulatePortfolio / oneTrial',output:'Section 5 purchased challenges and Section 7 journey',caveat:'Trade signals are opportunities, not an instruction to buy one new account for every signal.'},
 {id:'distribution',name:'Monte Carlo percentiles',terms:['p10','p90','median','percentile','net distribution'],formula:'P10 / median / P90 are 10th / 50th / 90th percentiles of simulated net outcomes.',inputs:'per-trial portfolio net results',source:'portfolio-engine.js · quantile / simulatePortfolio',output:'Section 5 net distribution and Section 6 charts',caveat:'Distribution describes model uncertainty, not empirical live trading risk or worst possible loss.'},
 {id:'days',name:'Timing and first payout',terms:['payout waiting','payout delay','trading days','horizon','funded wait'],formula:'The model advances accounts over configured trading-day horizon and provider-specific funded/payout waiting states. Average first-payout day is conditional on trials reaching the first payout.',inputs:'days, trading schedule, firm plan rules, per-trial event timing',source:'portfolio-engine.js · oneTrial / simulatePortfolio',output:'Section 7 journey, Section 9 daily ledger',caveat:'Trading days are not calendar days; some provider waiting, processing and eligibility rules are planning approximations.'}
];
const n=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
function lookup(q){
 const text=norm(q); if(!text)return null;
 let best=null,score=0;
 for(const item of entries){
  let s=0;
  for(const term of [item.name,...item.terms]){
   const t=norm(term);
   if(text.includes(t))s=Math.max(s,t.length);
  }
  if(s>score){best=item;score=s}
 }
 return best;
}
function answer(q){
 const item=lookup(q);if(!item)return null;
 const ask=norm(q);
 if(!/(how|why|explain|formula|calculate|definition|meaning|derive|source|where|trace|depend|what|audit|check)/.test(ask))return null;
 return [item.name+'\nFormula: '+item.formula+'\nInputs: '+item.inputs+'\nCode source: '+item.source+'\nShown in: '+item.output+'\nLimit: '+item.caveat,'Verified engine formula map · High',false];
}
function audit(results){
 const findings=[];
 for(const r of Array.isArray(results)?results:[]){
  const avg=r?.avg||{},spent=n(avg.spent),receipts=n(avg.receipts),net=n(avg.net),roi=n(r.roi);
  const id=String(r?.programId||r?.plan?.id||'unknown').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,35);
  function add(metric,evidence){findings.push({key:id+':'+metric,program:id,metric,severity:'high',title:'Formula inconsistency: '+metric,evidence,source:'portfolio-engine.js · simulatePortfolio',status:'detected'})}
  if(spent!==null&&receipts!==null&&net!==null){
   const delta=Math.abs((receipts-spent)-net);
   if(delta>Math.max(.05,Math.abs(net)*1e-7))add('net','Average receipts − spending differs from average net beyond rounding tolerance.');
  }
  if(spent!==null&&net!==null&&roi!==null){
   const expected=spent>0?net/spent:0;
   if(Math.abs(roi-expected)>1e-6)add('roi','Expected ROI differs from net/spending beyond numerical tolerance.');
  }
  if(r.chancePayout!==undefined&&r.chancePayout!==null&&(n(r.chancePayout)===null||r.chancePayout<0||r.chancePayout>1))add('payout-probability','Payout probability falls outside [0, 1].');
  const bought=n(avg.bought),funded=n(avg.funded),paid=n(avg.paid);
  if(bought!==null&&funded!==null&&funded>bought+.02)add('funded-count','Average funded exceeds average purchased.');
  if(funded!==null&&paid!==null&&paid>funded+.02)add('paid-count','Average first-paid exceeds average funded.');
 }
 return findings;
}
root.StudioFormulaAudit={entries,lookup,answer,audit};
})(window);