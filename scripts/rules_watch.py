#!/usr/bin/env python3
"""Conservative official rule-watch. Never edits financial parameters.

This is a drift alert, not a complete compliance review. It intentionally
requires known phrases to be present; websites may change their HTML markup.
"""
import html
import json
import re
import urllib.request
from datetime import datetime, timezone

SOURCES = [
    {"id": "topstep-combine", "name": "Topstep Trading Combine",
     "url": "https://help.topstep.com/en/articles/8284197-trading-combine-parameters",
     "patterns": [r"55\s*%", r"Maximum Loss Limit", r"Profit Target"]},
    {"id": "ftmo-2step", "name": "FTMO 2-Step",
     "url": "https://ftmo.com/en/2-step-challenge/",
     "patterns": [r"Max Daily Loss", r"Min Trading Days", r"Profit Target"]},
    {"id": "fundednext-stellar2", "name": "FundedNext Stellar 2-Step",
     "url": "https://help.fundednext.com/en/articles/17255124-stellar-2-step-challenge",
     "patterns": [r"Daily Loss", r"Maximum Loss", r"Phase"]},
    {"id": "the5ers-high", "name": "The5ers High Stakes",
     "url": "https://the5ers.com/faqs/what-are-the-general-rules-for-the-high-stakes-program/",
     "patterns": [r"High Stakes", r"news"]},
]

def main():
    results = []
    for src in SOURCES:
        item = {k: src[k] for k in ("id", "name", "url")}
        try:
            req = urllib.request.Request(src["url"], headers={
                "User-Agent": "Mozilla/5.0 (compatible; 4DsRuleWatch/1.0; compliance-monitor)"})
            with urllib.request.urlopen(req, timeout=18) as response:
                raw = response.read(1_200_000).decode("utf-8", errors="replace")
            clean = html.unescape(re.sub(r"<[^>]+>", " ", raw))
            clean = re.sub(r"\s+", " ", clean)
            missing = [phrase for phrase in src["patterns"] if not re.search(phrase, clean, re.IGNORECASE)]
            item["status"] = "needs_review" if missing else "checks_passed"
            item["missing_markers"] = missing
        except Exception as exc:
            item["status"] = "fetch_failed"
            item["error"] = str(exc)[:300]
        results.append(item)
    data = {"checked_at": datetime.now(timezone.utc).isoformat(), "results": results,
            "notice": "Presence checks only. Passing does not verify that rules, fees or payouts are unchanged. No changes are automatically applied."}
    with open("rule-watch-report.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(json.dumps(data, indent=2))

if __name__ == "__main__":
    main()
