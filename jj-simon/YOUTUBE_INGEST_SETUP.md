# JJ Academy — YouTube transcript import (opt-in)

## What is implemented
- The JJ Simon tab of **NoteBookLM YT** is the source of truth.
- A 67-video validated snapshot is committed as `jj-simon/youtube-video-inventory.json`.
- The Academy's searchable `jj-simon/youtube.html` presents the snapshot (no transcripts published).
- The importer at `jj-simon/automation/import-youtube-captions.py` reads the **live private Google Sheet**, validates YouTube IDs, attempts English manual and auto-generated VTT captions using yt-dlp, preserves per-cue timestamps, and stores caption JSON **only in a private Drive folder**.
- Videos with inaccessible/no captions are reported as `needs_review`. No invented transcript or chart assertions are produced.
- Existing private captions are skipped. The script processes up to 10 new attempts per invocation by default.
- The GitHub Actions workflow is **opt-in**; scheduled runs require repository variable `JJ_YOUTUBE_INGEST_ENABLED=true`. Scheduled workflows require the workflow file to exist on the repository **default branch**, so simply adding this on the `jj-simon-knowledge-hub` branch does not start a schedule.

## One-time owner setup
1. Create a **dedicated Google Cloud service account** with Sheets API and Drive API enabled. Don't put its JSON key in the repository or this chat.
2. Give the service account **Viewer** access to the source spreadsheet:
   https://docs.google.com/spreadsheets/d/1a6pfEVUAit_bdxbfE8eND1X7sRJDtGC30WFjrwIG08E/edit?gid=1955261849
3. Create a **private folder in a Google Shared Drive** that accepts service-account file creation, and give the service account write permission to that folder. Do not make transcripts publicly accessible. Shared Drives avoid common service-account My Drive storage quota limitations.
4. In the repository's Actions secrets, add `JJ_GOOGLE_SERVICE_ACCOUNT_JSON` (the JSON service account key) and `JJ_TRANSCRIPTS_DRIVE_FOLDER_ID` (the ID of that private writable folder). Do not reuse Trading Studio or JJ question-sync credentials.
5. Merge/copy the workflow file to the default branch when ready to enable Actions, or trigger the workflow from a branch where GitHub exposes it.
6. Run **JJ Academy YouTube caption ingestion** manually first with `dry_run=true`. Then run a single video ID and limit=1; verify the JSON file appears in the private Drive folder.
7. Only after testing, set Actions variable `JJ_YOUTUBE_INGEST_ENABLED=true` to allow nightly schedule. Remove/set false to stop schedules.

## Important limitations and handoff
- The script does not access the full video frames, manually inspect charts, or transcribe audio when YouTube captions are missing.
- YouTube throttling, consent restrictions, regional blocks, age restrictions, and video deletion can prevent extraction. Retry failures separately. Avoid bypassing access controls.
- It does **not** automatically add transcript-derived conclusions to the public Academy. The existing JJ research process must review private transcript excerpts, verify rules against the private course, label conflicts, and only then publish summaries with source timestamps.
- The public inventory JSON is a static snapshot. Live Sheet additions will be considered by the importer, but a separate explicitly reviewed manifest refresh is needed to update the public inventory.
- The script has no extra OpenAI API subscription requirement. GitHub Actions, Google Cloud/Drive, and YouTube services may have quotas or charges depending on account and usage.
- Raw caption files remain private. Public chapters should contain original summaries, limited short attributed excerpts, source timestamps and video links, not wholesale copied captions.

## Run locally (for maintainers)
```bash
python -m pip install yt-dlp google-api-python-client google-auth
export JJ_GOOGLE_SERVICE_ACCOUNT_JSON='...'
export JJ_TRANSCRIPTS_DRIVE_FOLDER_ID='...'
python jj-simon/automation/import-youtube-captions.py --dry-run
python jj-simon/automation/import-youtube-captions.py --video-id UVKVSWKFlvo --limit 1
```
