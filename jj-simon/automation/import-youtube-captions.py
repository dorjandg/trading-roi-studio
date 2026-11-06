#!/usr/bin/env python3
"""JJ Academy YouTube caption importer.

Reads the JJ Simon tab directly using a Google service account,
verifies each YouTube ID, and imports
available captions to a private Google Drive folder. No transcript or
private sheet data is committed to the public repository.
"""
import argparse
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SPREADSHEET_ID = "1a6pfEVUAit_bdxbfE8eND1X7sRJDtGC30WFjrwIG08E"
SHEET_RANGE = "'JJ Simon'!A2:D1000"
ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
STAMP_RE = re.compile(r"^(\d\d:\d\d:\d\d[.,]\d{3})\s*-->")
TAG_RE = re.compile(r"<[^>]+>")
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive",
]

def load_google():
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    raw = os.environ.get("JJ_GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        raise RuntimeError("JJ_GOOGLE_SERVICE_ACCOUNT_JSON must be configured; private Sheet cannot be read anonymously")
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            "JJ_GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. "
            "In GitHub Actions secrets, paste the complete contents of the downloaded "
            "Google service-account .json file, not its filename or path. "
            "Never post credentials in logs or chat."
        ) from None
    if not isinstance(obj, dict) or obj.get("type") != "service_account" or not all(
        isinstance(obj.get(k), str) and obj[k] for k in
        ("project_id", "client_email", "private_key", "token_uri")
    ):
        raise RuntimeError(
            "JJ_GOOGLE_SERVICE_ACCOUNT_JSON is missing required service-account fields. "
            "Use the complete JSON key file, not an OAuth client configuration."
        )
    try:
        cred = service_account.Credentials.from_service_account_info(obj, scopes=SCOPES)
    except (ValueError, KeyError, TypeError) as exc:
        raise RuntimeError(
            "JJ_GOOGLE_SERVICE_ACCOUNT_JSON contains unusable service-account credentials. "
            "Re-copy the full JSON file into the GitHub secret."
        ) from None
    return build("sheets", "v4", credentials=cred, cache_discovery=False), build(
        "drive", "v3", credentials=cred, cache_discovery=False
    )

def get_videos(sheets):
    rows = sheets.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID, range=SHEET_RANGE
    ).execute().get("values", [])
    videos = []
    seen = set()
    invalid = []
    for index, values in enumerate(rows, start=2):
        values = list(values) + [""] * (4 - len(values))
        published, title, link, vid = values[:4]
        match = re.search(r"[?&]v=([A-Za-z0-9_-]{11})(?:[&#]|$)", link)
        if not ID_RE.fullmatch(vid) or (match and match.group(1) != vid):
            invalid.append(index)
            continue
        if vid in seen:
            continue
        if not title:
            invalid.append(index)
            continue
        seen.add(vid)
        videos.append({"id": vid, "title": title, "published": published, "url": "https://www.youtube.com/watch?v=" + vid})
    if invalid:
        raise RuntimeError("Invalid or mismatched row(s) in JJ Simon tab: " + ",".join(map(str, invalid)))
    return videos

def parse_vtt(path):
    """Extract timestamped caption cues, stripping tags and duplicate cue lines."""
    out = []
    timestamp = None
    fragments = []
    def flush():
        if timestamp is None or not fragments:
            return
        val = " ".join(fragments).strip()
        if val and (not out or out[-1]["text"] != val):
            out.append({"time": timestamp, "text": val})
    for raw in Path(path).read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        found = STAMP_RE.match(line)
        if found:
            flush()
            timestamp = found.group(1).replace(",", ".")
            fragments = []
        elif not line:
            flush()
            timestamp = None
            fragments = []
        elif timestamp is not None and not line.startswith(("NOTE", "STYLE", "REGION")):
            text = re.sub(r"\s+", " ", TAG_RE.sub("", line)).strip()
            if text and (not fragments or fragments[-1] != text):
                fragments.append(text)
    flush()
    return out

def classify_youtube_failure(stderr, returncode):
    """Report actionable categories without printing external command output or URLs."""
    message = (stderr or "").lower()
    checks = (
        ("youtube_auth_required", ("sign in to confirm", "sign in to prove", "login required", "cookies are required", "use --cookies")),
        ("youtube_rate_limited", ("http error 429", "too many requests")),
        ("youtube_forbidden", ("http error 403", "forbidden")),
        ("youtube_unavailable", ("video unavailable", "private video", "this video is unavailable")),
        ("youtube_captcha", ("captcha", "not a bot", "confirm you're not a bot")),
        ("youtube_js_runtime", ("javascript runtime", "js runtime", "challenge solving failed", "n challenge")),
        ("youtube_unsupported_client", ("requested format is not available", "no supported youtube js runtime")),
        ("youtube_network_error", ("timed out", "network is unreachable", "connection reset", "certificate verify failed")),
        ("youtube_no_captions", ("there are no subtitles", "no subtitles", "did not match any subtitles")),
    )
    for name, phrases in checks:
        if any(p in message for p in phrases):
            return name
    return "youtube_command_failed" if returncode else "youtube_no_caption_file"


def extract_captions(video, tmpdir):
    vid = video["id"]
    template = str(Path(tmpdir) / "%(id)s.%(language)s.%(ext)s")
    cmd = [
        "yt-dlp", "--no-playlist", "--skip-download",
        "--write-subs", "--write-auto-subs",
        "--sub-langs", "en,en-US,en-GB,en.*",
        "--sub-format", "vtt", "--convert-subs", "vtt",
        "--output", template, "--retries", "2", "--socket-timeout", "15",
        "--no-simulate", "--print", "%(id)s\t%(title)s",
        "https://www.youtube.com/watch?v=" + vid,
    ]
    try:
        completed = subprocess.run(cmd, text=True, capture_output=True, timeout=160, check=False)
    except subprocess.TimeoutExpired:
        return {"status": "failed", "reason": "youtube_timeout"}
    files = sorted(Path(tmpdir).glob(vid + ".*.vtt"), key=lambda x: ("en." not in x.name, len(x.name)))
    if not files:
        reason = classify_youtube_failure(completed.stderr, completed.returncode)
        return {"status": "needs_review", "reason": reason, "exit_code": completed.returncode}
    cues = parse_vtt(files[0])
    if not cues:
        return {"status": "needs_review", "reason": "empty_caption_file"}
    video_title = completed.stdout.strip().split("\n")[-1].split("\t", 1)
    return {
        "status": "caption_imported",
        "caption_language": files[0].name[len(vid)+1:].removesuffix(".vtt"),
        "cues": cues,
        "youtube_title": video_title[-1] if len(video_title) == 2 and video_title[0] == vid else None,
    }

def extract_supadata(video):
    """Use hosted captions so GitHub runner does not scrape YouTube itself.

    Native-only deliberately prevents an unapproved speech-to-text bill.
    Never log API keys or raw provider responses.
    """
    key = os.environ.get("JJ_SUPADATA_API_KEY", "").strip()
    if not key:
        return {"status": "needs_review", "reason": "supadata_api_key_missing"}
    endpoint = "https://api.supadata.ai/v1/transcript"
    params = urllib.parse.urlencode({
        "url": "https://www.youtube.com/watch?v=" + video["id"],
        "lang": "en", "text": "false", "mode": "native",
    })
    def request_json(url):
        req = urllib.request.Request(url, headers={
            "x-api-key": key, "Accept": "application/json",
            "User-Agent": "JJ-Academy-Research/1.0",
        })
        try:
            with urllib.request.urlopen(req, timeout=35) as response:
                return json.load(response)
        except urllib.error.HTTPError as err:
            if err.code in (401, 403):
                return {"_error": "provider_auth_or_forbidden"}
            if err.code == 402:
                return {"_error": "provider_no_credits"}
            if err.code == 429:
                return {"_error": "provider_rate_limited"}
            return {"_error": "provider_http_" + str(err.code)}
        except (OSError, ValueError):
            return {"_error": "provider_network_or_response_error"}
    data = request_json(endpoint + "?" + params)
    for attempt in range(8):
        if "_error" in data:
            return {"status": "needs_review", "reason": data["_error"]}
        job_id = data.get("jobId")
        if not job_id:
            break
        if not isinstance(job_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", job_id):
            return {"status": "needs_review", "reason": "provider_invalid_job"}
        time.sleep(8)
        data = request_json(endpoint + "/" + urllib.parse.quote(job_id))
        if data.get("status") == "failed":
            return {"status": "needs_review", "reason": "provider_job_failed"}
        if data.get("status") in ("queued", "active"):
            data = {"jobId": job_id}
            continue
        break
    if data.get("jobId"):
        return {"status": "needs_review", "reason": "provider_job_pending"}
    content = data.get("content")
    if not isinstance(content, list) or not content:
        return {"status": "needs_review", "reason": "provider_no_timestamped_transcript"}
    cues = []
    for segment in content:
        if not isinstance(segment, dict):
            continue
        text = segment.get("text")
        offset = segment.get("offset")
        if not isinstance(text, str) or not isinstance(offset, (int, float)):
            continue
        if not text.strip() or offset < 0:
            continue
        seconds = int(offset // 1000)
        timecode = f"{seconds//3600:02d}:{(seconds//60)%60:02d}:{seconds%60:02d}.{int(offset)%1000:03d}"
        cues.append({"time": timecode, "text": text.strip()})
    if not cues:
        return {"status": "needs_review", "reason": "provider_empty_cues"}
    return {
        "status": "caption_imported", "caption_language": data.get("lang", "en"),
        "cues": cues, "youtube_title": None,
        "provider": "supadata_native_captions",
    }


def find_existing(drive, folder, video_id):
    q = "name = '" + video_id + ".captions.json' and '" + folder.replace("'", "\\'") + "' in parents and trashed = false"
    records = drive.files().list(q=q, fields="files(id,name),nextPageToken",
        supportsAllDrives=True, includeItemsFromAllDrives=True, pageSize=10).execute().get("files", [])
    return records[0]["id"] if records else None

def upload_json(drive, folder, filename, obj, existing=None):
    from googleapiclient.http import MediaIoBaseUpload
    data = json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8")
    media = MediaIoBaseUpload(io.BytesIO(data), mimetype="application/json", resumable=False)
    if existing:
        return drive.files().update(fileId=existing, media_body=media,
            supportsAllDrives=True, fields="id").execute()["id"]
    return drive.files().create(body={
        "name": filename, "parents": [folder], "mimeType": "application/json"
    }, media_body=media, supportsAllDrives=True, fields="id").execute()["id"]

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--limit", type=int, default=10)
    ap.add_argument("--video-id", default="", help="Optional exact YouTube ID to import")
    ap.add_argument("--dry-run", action="store_true", help="Validate Sheet without downloading/uploading")
    args = ap.parse_args()
    if args.limit < 1 or args.limit > 67:
        ap.error("limit must be 1..67")
    if args.video_id and not ID_RE.fullmatch(args.video_id):
        ap.error("video ID must be 11 valid characters")
    sheets, drive = load_google()
    videos = get_videos(sheets)
    if args.video_id:
        videos = [x for x in videos if x["id"] == args.video_id]
        if not videos:
            raise RuntimeError("Requested video is not in the JJ Simon spreadsheet")
    print(f"Validated {len(videos)} video(s) from live JJ Sheet.", flush=True)
    if args.dry_run:
        return
    folder = os.environ.get("JJ_TRANSCRIPTS_DRIVE_FOLDER_ID", "").strip()
    if not folder:
        raise RuntimeError("JJ_TRANSCRIPTS_DRIVE_FOLDER_ID required: transcripts must remain in a private owner-controlled Drive folder")
    drive.files().get(fileId=folder, fields="id,name,mimeType", supportsAllDrives=True).execute()
    imported = skipped = failed = 0
    for video in videos:
        if imported + failed >= args.limit:
            break
        vid = video["id"]
        try:
            if find_existing(drive, folder, vid):
                skipped += 1
                print(f"{vid}: already stored; skipped")
                continue
            with tempfile.TemporaryDirectory() as tmp:
                result = extract_supadata(video) if os.environ.get("JJ_SUPADATA_API_KEY") else extract_captions(video, tmp)
            if result["status"] != "caption_imported":
                failed += 1
                print(f"{vid}: {result['status']} ({result['reason']}; yt_dlp_exit={result.get('exit_code', 'n/a')})")
                if result["reason"] in ("youtube_auth_required", "youtube_captcha", "youtube_rate_limited"):
                    print("STOP: YouTube requires interactive authentication or is rate-limiting this GitHub runner. "
                          "Do not retry all videos here; use the local caption importer.", flush=True)
                    break
                continue
            payload = {
                "schema": 1, "source_type": "youtube_caption", "source": "JJ Simon public video",
                "video_id": vid, "video_title_from_sheet": video["title"],
                "youtube_title": result["youtube_title"], "published": video["published"],
                "url": video["url"], "caption_language": result["caption_language"],
                "verification": "auto_or_manual_caption_not_chart_verified",
                "provider": result.get("provider", "yt_dlp"),
                "imported_at": datetime.now(timezone.utc).isoformat(), "cues": result["cues"],
            }
            upload_json(drive, folder, vid + ".captions.json", payload)
            imported += 1
            print(f"{vid}: captions stored privately ({len(result['cues'])} cues)")
        except Exception as exc:
            failed += 1
            print(f"{vid}: import error ({type(exc).__name__})", file=sys.stderr)
        time.sleep(1)
    print(json.dumps({"imported": imported, "already_present": skipped, "needs_review_or_failed": failed,
                      "processed": imported + skipped + failed}))
    if failed and not imported and not skipped:
        sys.exit(2)

if __name__ == "__main__":
    main()
