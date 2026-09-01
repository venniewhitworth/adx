import { loadEnvFile } from "./load-env-file.mjs";

await loadEnvFile();

const baseUrl = process.env.APP_BASE_URL?.trim();
const schedulerToken = process.env.REFRESH_SCHEDULER_TOKEN?.trim();
const limit = process.env.REFRESH_DUE_LIMIT?.trim();
const intervalMs = Number(process.env.REFRESH_DUE_POLL_INTERVAL_MS?.trim() || "30000");

if (!baseUrl) {
  console.error("APP_BASE_URL is required");
  process.exit(1);
}

if (!Number.isFinite(intervalMs) || intervalMs < 1000) {
  console.error("REFRESH_DUE_POLL_INTERVAL_MS must be a number >= 1000");
  process.exit(1);
}

function buildRequestUrl() {
  const url = new URL("/api/links/refresh-due", baseUrl);
  if (limit) {
    url.searchParams.set("limit", limit);
  }
  return url;
}

function buildHeaders() {
  const headers = {};
  if (schedulerToken) {
    headers["x-refresh-scheduler-token"] = schedulerToken;
  }
  return headers;
}

async function refreshOnce() {
  const response = await fetch(buildRequestUrl(), {
    method: "POST",
    headers: buildHeaders(),
  });

  const text = await response.text();
  const now = new Date().toISOString();

  if (!response.ok) {
    console.error(`[${now}] Refresh due request failed: ${response.status} ${text}`);
    return;
  }

  console.log(`[${now}] ${text}`);
}

let running = false;

async function tick() {
  if (running) {
    return;
  }

  running = true;
  try {
    await refreshOnce();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${new Date().toISOString()}] Refresh due worker error: ${message}`);
  } finally {
    running = false;
  }
}

console.log(
  `Refresh due worker started: interval=${intervalMs}ms baseUrl=${baseUrl}`,
);

await tick();
setInterval(() => {
  void tick();
}, intervalMs);
