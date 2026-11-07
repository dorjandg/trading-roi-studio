/* JJ Academy — calculators-only navigation home.
   One interactive tool per chapter. Reuse original calculator functions,
   avoid duplicate IDs, and preserve studied checkbox IDs for all lessons. */
(function(){
'use strict';
const slug='calc-acquisition';
if(!chapters.some(x=>x.slug===slug)){
 chapters.push({
   slug,
   group:'Calculators & Simulations',
   title:'Evaluation Acquisition Calculator',
   intro:'Estimate the average cost of reaching a funded account and the chance of at least one funded payout pathway across multiple evaluation purchases. The editable calculator is directly below.',
   status:'Illustrative course-based probability model — assumptions editable',
   sections:[
    {
     title:'How to use the evaluation acquisition calculator',
     points:[
      'Enter the price of a purchased evaluation, then your measured probability of passing an evaluation. Use a complete multi-phase pass rate when the evaluation has more than one phase.',
      'Enter funded success as the conditional probability that a newly funded account reaches the outcome you are studying. It is not the trading win rate and not a guaranteed payout.',
      'Enter an activation fee only when it is charged after passing the evaluation. Set the number of purchased evaluations to the number of independent attempts you want to compare.',
      'Read the four outputs: average acquisition cost per funded account, single-attempt funded-success pathway, chance of at least one successful pathway, and total initial evaluation spending.',
      'Run sensitivity checks by lowering the pass rate and funded success rate and increasing the fees. The output is a probability illustration; it does not simulate account timelines, resets, correlated copying, drawdowns or firm-specific payout restrictions.'
     ],
     src:[
      ['Prop Firm Math Stats','00:30–01:10, 05:00–07:16','1bzGIqxU1BCDPqKblORKaCUsjRFMsMBVs'],
      ['Risk Of Ruin Bankroll Management','03:25–04:50, 12:18–13:14','1VOJtRPDpy9LB4UakPYfZChROyAtPLQfv']
     ]
    },
    {
     title:'JJ course context and where the model can mislead',
     points:[
      'JJ discusses tracking evaluation passes divided by attempts and measuring actual purchases, resets and costs rather than assuming the same pass rate applies to everybody.',
      'His mathematical acquisition examples combine evaluation pass probability and funded success probability. Their product describes one particular two-stage success pathway, not guaranteed cash or a prediction of how long payout takes.',
      'JJ also describes correlated copying across accounts, which weakens a simple independent-attempt probability model. Treat copied attempts as linked outcomes unless they are genuinely independent.',
      'Track activation fees, resets, monthly renewals, account replacement, actual received payouts and withdrawal restrictions separately. The current calculator excludes most of those cash-flow details.',
      'Some examples in the course use different models, assumptions and providers. Keep those versions separate; do not automatically apply the current calculator to every firm.'
     ],
     src:[
      ['Managing Resets Billing Cycles Across Multiple Futures Funded Accounts','00:12–04:19','1pdmFifqByLbI75-XtX0C53vMiCGR4-i-'],
      ['Prop Firm Math Stats','02:55–07:16','1bzGIqxU1BCDPqKblORKaCUsjRFMsMBVs']
     ]
    }
   ]
 });
}
if(!curriculum.some(x=>x.slug===slug)){
 curriculum.push({
  slug,
  title:'Evaluation Acquisition Calculator',
  status:'review',
  reason:'Interactive JJ-derived evaluation acquisition probability model; user assumptions and firm costs require verification.'
 });
}
// A direct URL to the calculator should work even on the initial page load.
const deep=new URLSearchParams(location.search).get('topic');
if(deep===slug)active=slug;
if(typeof jjRebuildMobileSelector==='function')jjRebuildMobileSelector();
renderNav();
render();
})();
