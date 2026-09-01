import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const cliPath = require.resolve("playwright/cli");

const result = spawnSync(
  process.execPath,
  [cliPath, "install", "chromium", "chromium-headless-shell"],
  {
  stdio: "inherit",
  env: {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: "0",
  },
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
