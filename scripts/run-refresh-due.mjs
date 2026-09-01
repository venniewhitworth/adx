import { loadEnvFile } from "./load-env-file.mjs";

await loadEnvFile();

const baseUrl = process.env.APP_BASE_URL?.trim();
const schedulerToken = process.env.REFRESH_SCHEDULER_TOKEN?.trim();
const limit = process.env.REFRESH_DUE_LIMIT?.trim();

if (!baseUrl) {
  console.error("APP_BASE_URL is required");
  process.exit(1);
}

const url = new URL("/api/links/refresh-due", baseUrl);
if (limit) {
  url.searchParams.set("limit", limit);
}

const headers = {};
if (schedulerToken) {
  headers["x-refresh-scheduler-token"] = schedulerToken;
}

const response = await fetch(url, {
  method: "POST",
  headers,
});

const text = await response.text();

if (!response.ok) {
  console.error(`Refresh due request failed: ${response.status} ${text}`);
  process.exit(1);
}

let payload = null;
try {
  payload = JSON.parse(text);
} catch {
  console.log(text);
  process.exit(0);
}

if (payload && typeof payload.failed === "number" && payload.failed > 0) {
  console.error(`Refresh due completed with failures: ${text}`);
  process.exit(1);
}

console.log(text);
