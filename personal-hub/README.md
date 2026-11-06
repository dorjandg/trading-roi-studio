# Personal Hub

A lightweight, mobile-first, searchable start page for personal websites, study resources, dashboards, videos and documents.

## Live sites seeded at launch

- Trading ROI Studio — https://trading-roi-studio.pages.dev/
- JJ Simon Knowledge Hub — https://jj-simon-knowledge.pages.dev/
- WHOOP — https://app.whoop.com/
- Google Sheets and YouTube general shortcuts (not private links)

## How to update it

All links and collections are in **`links.js`** in this directory.

- Add a category to the `categories` array with a unique id.
- Add a link to the `links` array with id, title, https URL, description, category, type, symbol, accent, and tags.
- `featured: true` places a link in the top "My websites" area.
- Existing IDs must remain stable to preserve device-local favorites and recent history.
- Push the change to branch **`personal-hub`**. Cloudflare Pages will redeploy once connected.

The "Add link" dialog **copies a request** for ChatGPT. It does *not* directly edit GitHub or sync across devices. Favorites, theme and recent links are saved in the individual browser's localStorage.

## Deploy with Cloudflare Pages

Create a **new Pages project**, not an edit of the Trading ROI Studio or JJ Simon projects.

| Setting | Value |
|---|---|
| GitHub repository | `dorjandg/trading-roi-studio` |
| Production branch | `personal-hub` |
| Framework preset | None |
| Build command | Leave blank |
| Root directory | Leave blank (repo root) |
| Build output directory | `personal-hub` |

Suggested project name: `personal-hub-4ds` (Cloudflare confirms whether the hostname is available).

## Privacy

This branch is in a **public GitHub repository** and the Pages URL will be public unless you configure access restrictions. Only place shareable titles, descriptions and URLs here. A destination that requires sign-in still uses its own authentication, but the URL itself and the link title are visible on the public hub.

For a private homepage, enable **Cloudflare Access** on the new Pages project before adding sensitive bookmarks. Do not add passwords, API keys, session tokens, account IDs, or confidential private document links to this file.

## Maintenance

No framework, npm, build tools, external fonts, cookies or third-party scripts required. Works as plain static HTML + CSS + JS. Do not merge this branch into `main` merely to publish the hub: the branch is used as a separate production source.
