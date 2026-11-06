#!/usr/bin/env python3
"""JJ Academy public YouTube caption ingestion, without YouTube scraping.

Source: JJ Simon tab of the user's YouTube link sheet (read-only).
Provider: Supadata native captions only (no paid speech-to-text fallback).
Destination: user-owned private Google Sheet shared with this service account.
Raw transcripts and API credentials are NEVER committed or printed.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

SOURCE_SHEET = "1a6pfEVUAit_bdxbfE8eND1X7sRJDtGC30WFjrwIG08E"
SINK_SHEET = "1FFjshwPnQtA2sLe5hoXfQRco6Sif9cJ0eS9yGsxTj-w"
VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
EXPECTED_TABS = {"Index", "Segments"}
MAX_CHUNK = 18000


def google_sheets():
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    raw = os.environ.get("JJ_GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        raise RuntimeError("Missing Google service-account JSON secret")
    try:
        data = json.loads(raw)
        if data.get("type") != "service_account":
            raise ValueError("Wrong credential type")
        creds = service_account.Credentials.from_service_account_info(
            data, scopes=["https://www.googleapis.com/auth/spreadsheets"]
        )
    except (ValueError, KeyError, TypeError) as exc:
        raise RuntimeError("Invalid service-account secret; do not print or share its value") from None
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def video_inventory(api):
    rows = api.spreadsheets().values().get(
        spreadsheetId=SOURCE_SHEET, range="'JJ Simon'!A2:D1000"
    ).execute().get("values", [])
    videos = []
    seen = set()
    for row_number, raw in enumerate(rows, 2):
        cells = list(raw) + [""] * max(0, 4 - len(raw))
        published, title, link, vid = cells[:4]
        if not vid and not title and not link:
            continue
        url_id = re.search(r"[?&]v=([\w-]{11})(?:[&#]|$)", link or "")
        if not VIDEO_ID.fullmatch(vid or "") or not title or (url_id and url_id.group(1) != vid):
            raise RuntimeError(f"Source spreadsheet contains an invalid video row {row_number}; import stopped")
        if vid not in seen:
            videos.append({"id": vid, "title": title, "date": published,
                           "url": "https://www.youtube.com/watch?v=" + vid})
            seen.add(vid)
    return videos


def sink_configuration(api):
    meta = api.spreadsheets().get(spreadsheetId=SINK_SHEET, fields="sheets(properties(sheetId,title))").execute()
    ids = {sheet["properties"]["title"]: sheet["properties"]["sheetId"] for sheet in meta.get("sheets", [])}
    if not EXPECTED_TABS.issubset(ids):
        raise RuntimeError("Private caption destination lacks Index or Segments tab")
    return ids


def already_processed(api):
    rows = api.spreadsheets().values().get(
        spreadsheetId=SINK_SHEET, range="'Index'!A2:A3000"
    ).execute().get("values", [])
    return {row[0] for row in rows if row and VIDEO_ID.fullmatch(row[0])}


def provider_transcript(video, api_key):
    """Return timestamped cues or a bounded status. Never log private key or body."""
    url = "https://api.supadata.ai/v1/transcript"
    params = urllib.parse.urlencode({
        "url": video["url"], "mode": "native", "text": "false", "lang": "en"
    })
    def fetch(url_to_call):
        request = urllib.request.Request(url_to_call, headers={
            "x-api-key": api_key, "Accept": "application/json"
        })
        try:
            with urllib.request.urlopen(request, timeout=40) as response:
                if response.status == 206:
                    return {"error_category": "native_captions_unavailable"}
                return json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code in (401, 403):
                return {"error_category": "provider_authorization"}
            if exc.code == 402:
                return {"error_category": "provider_credits_exhausted"}
            if exc.code == 429:
                return {"error_category": "provider_rate_limited"}
            return {"error_category": "provider_http_" + str(exc.code)}
        except (OSError, ValueError):
            return {"error_category": "provider_network_error"}

    data = fetch(url + "?" + params)
    for _ in range(9):
        if not isinstance(data, dict):
            return {"error_category": "provider_invalid_response"}
        if data.get("error_category"):
            return data
        job = data.get("jobId")
        if not job:
            break
        if not isinstance(job, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", job):
            return {"error_category": "provider_invalid_job"}
        time.sleep(8)
        data = fetch(url + "/" + urllib.parse.quote(job))
        if data.get("status") == "failed":
            return {"error_category": "native_caption_job_failed"}
        if data.get("status") in ("queued", "active"):
            data = {"jobId": job}
    if data.get("jobId"):
        return {"error_category": "provider_job_still_pending"}
    content = data.get("content")
    if not isinstance(content, list) or not content:
        return {"error_category": "no_timestamped_captions"}
    cues = []
    for item in content:
        if not isinstance(item, dict):
            continue
        text = item.get("text")
        offset = item.get("offset")
        duration = item.get("duration", 0)
        if isinstance(text, str) and text.strip() and isinstance(offset, (int, float)) and offset >= 0:
            cues.append({"offset": int(offset), "duration": int(duration) if isinstance(duration, (int, float)) else 0,
                         "text": text.strip()})
    return {"cues": cues, "lang": data.get("lang", "en")} if cues else {"error_category": "empty_captions"}


def chunk_cues(cues):
    chunks = []
    chunk = []
    for cue in cues:
        encoded = json.dumps(cue, ensure_ascii=False, separators=(",", ":"))
        if len(encoded) > MAX_CHUNK:
            raise RuntimeError("A caption exceeds a single safe cell size")
        if chunk and len(json.dumps(chunk, ensure_ascii=False)) + len(encoded) > MAX_CHUNK:
            chunks.append(json.dumps(chunk, ensure_ascii=False))
            chunk = []
        chunk.append(cue)
    if chunk:
        chunks.append(json.dumps(chunk, ensure_ascii=False))
    return chunks


def row_values(values):
    # A leading apostrophe ensures video captions never evaluate as formulas.
    return {"values": [{"userEnteredValue": {"stringValue": "'" + str(v) if str(v).startswith("=") else str(v)}} for v in values]}


def record(api, tab_ids, video, status, provider, lang="", cues=None):
    """Atomic two-tab append, so a video cannot be marked imported without its caption rows."""
    chunks = chunk_cues(cues or [])
    now = datetime.now(timezone.utc).isoformat()
    index = [video["id"], video["title"], video["date"], video["url"],
             lang, str(len(cues or [])), now, status, provider]
    requests = []
    if chunks:
        requests.append({"appendCells": {
            "sheetId": tab_ids["Segments"],
            "rows": [row_values([video["id"], str(i), chunk]) for i, chunk in enumerate(chunks, 1)],
            "fields": "userEnteredValue"
        }})
    requests.append({"appendCells": {
        "sheetId": tab_ids["Index"], "rows": [row_values(index)], "fields": "userEnteredValue"
    }})
    api.spreadsheets().batchUpdate(spreadsheetId=SINK_SHEET, body={"requests": requests}).execute()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--video-id", default="")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.limit <= 67:
        parser.error("limit must be between 1 and 67")
    if args.video_id and not VIDEO_ID.fullmatch(args.video_id):
        parser.error("invalid video ID")
    api = google_sheets()
    videos = video_inventory(api)
    if args.video_id:
        videos = [v for v in videos if v["id"] == args.video_id]
    print(f"Validated {len(videos)} videos in JJ source spreadsheet.")
    ids = sink_configuration(api)
    processed = already_processed(api)
    print(f"Private caption store connected; {len(processed)} videos already indexed.")
    if args.dry_run:
        return
    key = os.environ.get("JJ_SUPADATA_API_KEY", "").strip()
    if not key:
        raise RuntimeError("JJ_SUPADATA_API_KEY is missing; no YouTube scraping fallback")
    successful = unavailable = attempted = 0
    for video in videos:
        if attempted >= args.limit:
            break
        if video["id"] in processed:
            continue
        result = provider_transcript(video, key)
        failure = result.get("error_category")
        if failure in ("provider_authorization", "provider_credits_exhausted", "provider_rate_limited",
                       "provider_network_error", "provider_job_still_pending"):
            print(f"Stopped safely: {failure}. No repeated provider requests in this batch.")
            break
        attempted += 1
        if failure:
            record(api, ids, video, "needs_review", failure)
            unavailable += 1
            print(f"{video['id']}: needs_review ({failure})")
            continue
        record(api, ids, video, "caption_imported", "supadata_native", result["lang"], result["cues"])
        successful += 1
        print(f"{video['id']}: stored {len(result['cues'])} timestamped cues privately")
        time.sleep(1.5)
    print(json.dumps({"imported": successful, "needs_review": unavailable, "attempted": attempted,
                      "already_indexed": len(processed)}))


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        # Never print provider response or key.
        print(f"JJ caption import stopped: {type(err).__name__}: {str(err)[:200]}", file=sys.stderr)
        raise SystemExit(1)
