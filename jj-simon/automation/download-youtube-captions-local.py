#!/usr/bin/env python3
"""Download available JJ Simon video captions on the owner's Windows computer.

Runs locally, never uploads YouTube cookies or Google keys. Source inventory is
the Academy's reviewed public metadata snapshot, not private transcripts.
Local caption files can be uploaded manually to the private Google Drive folder.
"""
import argparse
import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

SOURCE = "https://raw.githubusercontent.com/dorjandg/trading-roi-studio/jj-simon-knowledge-hub/jj-simon/youtube-video-inventory.json"
ID = re.compile(r"^[A-Za-z0-9_-]{11}$")

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--browser", choices=["none", "chrome", "edge", "firefox"], default="none",
                    help="Optional: use your own locally logged-in browser; cookies never leave the computer except requests to YouTube.")
    ap.add_argument("--limit", type=int, default=1)
    ap.add_argument("--video-id", default="UVKVSWKFlvo")
    ap.add_argument("--all", action="store_true", help="Process the first N videos instead of one ID")
    ap.add_argument("--output", default="JJ-YouTube-Captions")
    args = ap.parse_args()
    if not 1 <= args.limit <= 67:
        ap.error("--limit must be 1..67")
    if not ID.fullmatch(args.video_id):
        ap.error("--video-id must contain 11 valid YouTube ID characters")
    try:
        request = urllib.request.Request(SOURCE, headers={"User-Agent": "JJ-Academy-Local-Importer/1.0"})
        with urllib.request.urlopen(request, timeout=25) as response:
            videos = json.load(response)["videos"]
    except Exception as exc:
        print("Unable to fetch the Academy video inventory. Check internet access.", file=sys.stderr)
        return 2
    videos = [v for v in videos if ID.fullmatch(v["id"])]
    if not args.all:
        videos = [v for v in videos if v["id"] == args.video_id]
    videos = videos[:args.limit]
    if not videos:
        print("Selected ID not found in Academy inventory.", file=sys.stderr)
        return 2
    out = Path(args.output).resolve()
    out.mkdir(parents=True, exist_ok=True)
    successful = 0
    report = []
    for video in videos:
        vid = video["id"]
        preexisting = list(out.glob(vid + ".*.vtt"))
        if preexisting:
            report.append({"id": vid, "status": "already_downloaded"})
            print(f"{vid}: already downloaded")
            continue
        cmd = [sys.executable, "-m", "yt_dlp", "--no-playlist", "--skip-download",
               "--write-subs", "--write-auto-subs", "--sub-langs", "en,en-US,en-GB",
               "--sub-format", "vtt", "--no-simulate", "--retries", "2",
               "--socket-timeout", "15", "-o", str(out / "%(id)s.%(language)s.%(ext)s")]
        if args.browser != "none":
            cmd.extend(["--cookies-from-browser", args.browser])
        cmd.append("https://www.youtube.com/watch?v=" + vid)
        print(f"{vid}: fetching captions locally...", flush=True)
        try:
            done = subprocess.run(cmd, capture_output=True, text=True, timeout=210)
        except subprocess.TimeoutExpired:
            report.append({"id": vid, "status": "timeout"})
            print(f"{vid}: timeout")
            continue
        found = list(out.glob(vid + ".*.vtt"))
        if found:
            successful += 1
            report.append({"id": vid, "status": "caption_downloaded", "files": [p.name for p in found]})
            print(f"{vid}: caption saved to {out}")
        else:
            message = done.stderr.lower()
            reason = ("authentication_required" if ("sign in" in message or "cookies" in message)
                      else "rate_limited" if "429" in message
                      else "caption_unavailable_or_fetch_failed")
            report.append({"id": vid, "status": reason})
            print(f"{vid}: {reason}; do not upload browser cookies to GitHub or chat")
            if reason in ("authentication_required", "rate_limited"):
                print("Stopped this batch to avoid repeated blocked requests.")
                break
        time.sleep(2)
    (out / "import-status.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Saved captions for {successful} new video(s). Results: {out}")
    return 0 if any(x["status"] in ("caption_downloaded", "already_downloaded") for x in report) else 2

if __name__ == "__main__":
    raise SystemExit(main())
