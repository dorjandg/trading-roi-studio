/* Group detailed glossary sections into easier browsing categories; preserve original subtype. */
const jjDictionaryCategoryMap={
 'Trading reference':'Structure & Strategy','Entry confirmation':'Structure & Strategy','Entry condition':'Structure & Strategy','Market Structure':'Structure & Strategy','Strategy':'Structure & Strategy',
 'Trade Risk':'Trades & Instruments','Futures Instruments':'Trades & Instruments',
 'Probability and math':'Statistics & EV','Probability & Statistics':'Statistics & EV',
 'Account stage':'Accounts & Prop Firms','Account Survival':'Accounts & Prop Firms',
 'Portfolio risk':'Portfolio & Scaling','Portfolio management':'Portfolio & Scaling','Portfolio Execution':'Portfolio & Scaling','Payouts & Scaling':'Portfolio & Scaling',
 'Accounting':'Accounting & Payouts'
};
for(const term of jjTerms){term.subcategory=term.category;term.category=jjDictionaryCategoryMap[term.category]||term.category;}
