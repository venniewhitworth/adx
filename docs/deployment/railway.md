# Railway Deployment

This app can run as a single Railway service.

## What you get after deploy

The dashboard workflow is now intentionally simple:

1. Open `/dashboard`
2. Fill in `name`, `tracking link`, and `country`
3. Keep the default Facebook Referer or enter a custom `Referer URL`
4. Click `Save and Resolve`
5. Copy the final URL or Google Ads suffix

The app now defaults to IPRoyal for proxy resolution and syncs Google Ads only at the campaign level.

## Before you deploy

- Push this repo to GitHub.
- Make sure the app builds locally with `npm run build`.
- Decide your production domain:
  - Railway temporary domain, or
  - your own custom domain.

## Railway setup

1. Create a new Railway project.
2. Choose **Deploy from GitHub repo**.
3. Select this repository.
4. Railway should detect the root `Dockerfile` and build the app with Chromium bundled for Playwright.
5. If the latest build logs still mention `RAILPACK`, trigger a redeploy after the new commit is pushed so Railway re-detects the service from the Dockerfile.

## Required Railway variables

Add these in `Railway -> Service -> Variables`:

- `IPROYAL_PROXY_HOST`
  - Required.
  - Example: `geo.iproyal.com:12321`
- `IPROYAL_PROXY_USER`
  - Required.
- `IPROYAL_PROXY_PASSWORD_BASE`
  - Required.
  - The app will append a fresh `_session-..._lifetime-...` suffix on every resolve, so each new resolve can rotate to a new IP.
- `IPROYAL_PROXY_SESSION_LIFETIME`
  - Optional.
  - Default: `10m`
- `DASHBOARD_PASSWORD`
  - Strongly recommended.
  - Protects `/dashboard` and dashboard APIs with a login screen.
- `GOOGLE_ADS_SCRIPT_TOKEN`
  - Recommended. Used to protect `/api/google-ads/pending` and `/api/google-ads/report`.
- `REFRESH_SCHEDULER_TOKEN`
  - Recommended. Used to protect `/api/links/refresh-due`.

Optional:

- `DASHBOARD_SESSION_SECRET`
  - Recommended in production.
  - Used to sign the dashboard login session cookie. If omitted, the app falls back to `DASHBOARD_PASSWORD`.
- `REMOTE_API_BASE_URL`
  - Leave this empty for the current single-service deployment.
  - Only set it if you intentionally want the frontend to proxy `/api/*` and `/r/*` to a separate backend.
- `LINK_STORE_DATA_DIR`
  - Optional if you attach a Railway Volume and want to choose the storage path yourself.
  - If you do not set this, the app will automatically use Railway's `RAILWAY_VOLUME_MOUNT_PATH` when a Volume is attached.

## Persistent storage for saved links

If you want saved records to survive redeploys, attach a Railway Volume to this service.

Recommended setup:

1. Open the Railway project canvas.
2. Create a new Volume.
3. Attach it to the `ink-manager` service.
4. Set the mount path to `/data`.
5. Redeploy the service.

After that, this app will automatically store `links.json` inside the mounted Volume.

If you prefer a custom path, keep the Volume attached and set:

```text
LINK_STORE_DATA_DIR=/data
```

Railway also provides `RAILWAY_VOLUME_MOUNT_PATH` automatically at runtime when a Volume is attached.

## Start behavior

The service starts with:

```bash
npm run start -- --hostname 0.0.0.0 --port $PORT
```

## After deploy

Once Railway gives you a public URL such as:

```text
https://your-app.up.railway.app
```

use that URL in:

- the Dashboard `Google Ads Script` section as `BASE_URL`
- your scheduled refresh job target:

```text
POST https://your-app.up.railway.app/api/links/refresh-due
```

with header:

```text
x-refresh-scheduler-token: YOUR_REFRESH_SCHEDULER_TOKEN
```

## Recommended automation

### Final URL refresh

Create a second Railway service for cron jobs from the same repository.

Set:

- Start Command: `npm run cron:refresh-due`
- Schedule: every 10 minutes

Add these variables to the cron service:

- `APP_BASE_URL=https://your-app.up.railway.app`
- `REFRESH_SCHEDULER_TOKEN=...`
- `SERVICE_MODE=cron-refresh`

That cron service will call:

```text
POST https://your-app.up.railway.app/api/links/refresh-due
```

The backend itself decides whether a link is due based on each record's selected interval:

- 10 minutes
- 30 minutes
- 1 hour
- 2 hours
- 6 hours
- 12 hours
- 24 hours
- 48 hours

If you want `30 seconds` or `1 minute` refresh intervals to actually run on time, use a long-running worker service instead of a 10-minute cron job.

Recommended worker setup:

- Start Command: `npm run worker:refresh-due`
- Variables:
  - `APP_BASE_URL=https://your-app.up.railway.app`
  - `REFRESH_SCHEDULER_TOKEN=...`
  - `REFRESH_DUE_POLL_INTERVAL_MS=30000`

For a 1-minute loop, set:

```text
REFRESH_DUE_POLL_INTERVAL_MS=60000
```

### Google Ads sync

Run the Google Ads Script every hour.

That script will:

1. pull pending suffix updates from `/api/google-ads/pending`
2. update Final URL suffix in Google Ads campaigns
3. report success or failure to `/api/google-ads/report`

The dashboard now generates a compatibility version of the script:

- you still replace `REPLACE_ME` with `GOOGLE_ADS_SCRIPT_TOKEN`
- the script sends the token in both the request header and the `scriptToken` URL query
- the backend accepts both formats to avoid `401 Unauthorized Google Ads Script request` in some Google Ads Script runtimes

If the script preview log says `No pending suffix updates for ...`, auth is already working and there is simply no pending record to sync yet.
