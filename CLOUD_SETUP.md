# 4Ds Trading Studio — one-time Google cloud deployment

The website is public and does NOT require login. Anyone who knows the website link and can select Doen, Dori, Dona or Dion can read, overwrite or edit that profile. Never store secrets or broker credentials here. Different names are organizational separation, not access control.

## One-time Google setup

1. Open https://script.google.com/ and create a **New project** in the Google account that will own the shared data.
2. Replace the sample `Code.gs` source with everything in [cloud-backend.gs](./cloud-backend.gs). Save the project as **4Ds Trading Studio Cloud**.
3. Click **Deploy → New deployment → Web app**.
4. Select **Execute as: Me** and **Who has access: Anyone**. Authorize the script's Google Drive permissions. These permissions are required to maintain four JSON files in a new private Drive folder. (Your Apps Script deployment URL is publicly callable even though the Drive folder itself is private.)
5. Copy the full `https://script.google.com/macros/s/.../exec` URL and send it to ChatGPT. The endpoint is configured in the website HTML, so users do not need to enter it on each device.
6. Refresh https://dorjandg.github.io/trading-roi-studio/ in the browser and check **Export & help → 4Ds cloud synchronization**. The status should change to **Cloud synced** once connected.
7. A truly new device downloads the selected user's existing cloud profile automatically before initializing its local settings. Devices with an existing, unrecognized local profile may still be asked to choose **Load cloud onto this device** once; do not overwrite meaningful unsynced local changes.

## Behaviors

- Four user profiles (Doen, Dori, Dona, Dion) with independent configurations.
- Inside a user, each prop-firm program and account size retains independent parameters.
- Changes are saved immediately to browser storage and automatically synchronized to Google Cloud when reachable. Cloud reads run before the main application initializes, preventing default local settings from causing a false conflict on a new device.
- The website checks for external cloud changes when active and every 60 seconds. Conflicting changes require an explicit decision; no automatic overwrite of a newer cloud revision.
- Browser local storage remains an offline fallback. Export your profile settings before changing devices.
- The server stores each user as a JSON file under a Drive folder **4Ds Trading Studio Cloud Data** and returns its contents to anyone accessing the public script endpoint. Do not confuse this with private Google Drive sharing.
- No passwords or login means there is NO secure isolation from people who intentionally select someone else's name.
- ChatGPT can keep updating the website code through its GitHub connection. To edit data from ChatGPT across devices, the deployed cloud service must be connected before those changes can be reflected live.

## Source files

- `cloud-backend.gs`: Apps Script service (Drive-owned JSON profile store).
- `index.html`: currently embeds the configured Google Apps Script web-app endpoint.
- `cloud-bootstrap.js`: cloud-first profile hydration for new devices and trusted synced profiles.
- `cloud-sync.js`: version checks, remote pull, local change upload, conflict handling.
