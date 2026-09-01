#!/usr/bin/env node
// scripts/download-assets.mjs
// Usage:
//   node scripts/download-assets.mjs assets.json
// where assets.json is the JSON output from the browser MCP asset discovery script.

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function fetchToFile(url, dest) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(dest, buf);
    return { url, dest, ok: true };
  } catch (err) {
    return { url, dest, ok: false, error: String(err) };
  }
}

async function downloadAssets(list, basePublic) {
  const concurrency = 4;
  let i = 0;
  const results = [];
  const workers = new Array(concurrency).fill(0).map(async () => {
    while (i < list.length) {
      const idx = i++;
      const asset = list[idx];
      const url = asset.src || asset.url || asset.href;
      if (!url) {
        results.push({ asset, ok: false, error: 'no url' });
        continue;
      }
      const urlObj = new URL(url, 'https://example.invalid');
      const pathname = urlObj.pathname.replace(/\/+/, '/');
      const fileName = path.basename(pathname) || 'asset';
      const dest = path.join(basePublic, urlObj.hostname || 'remote', pathname.replace(/^[\/]+/, ''));
      const r = await fetchToFile(url, dest);
      results.push(r);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.log('Usage: node scripts/download-assets.mjs assets.json');
    process.exit(1);
  }
  const assetsJson = await fs.readFile(arg, 'utf8');
  const data = JSON.parse(assetsJson);
  const assets = data.assets || data;

  // Flatten discovered assets into an array of objects with url
  const list = [];
  const pushUrl = (url) => {
    if (!url || typeof url !== 'string') return;
    const normalized = url.trim();
    if (/^(linear-gradient|radial-gradient|repeating-linear-gradient|repeating-radial-gradient)/i.test(normalized)) return;
    list.push({ src: normalized });
  };

  if (Array.isArray(assets.images)) assets.images.forEach(i => pushUrl(i.src || i.url || i.href));
  if (Array.isArray(assets.videos)) assets.videos.forEach(v => pushUrl(v.src || v.poster || v.url));
  if (Array.isArray(assets.backgroundImages)) assets.backgroundImages.forEach(b => {
    const rawUrl = b.src || b.url || b.backgroundImage;
    const m = rawUrl && rawUrl.match(/url\((?:"|')?(.*?)(?:"|')?\)/);
    const url = m ? m[1] : rawUrl;
    pushUrl(url);
  });
  if (Array.isArray(assets.favicons)) assets.favicons.forEach(f => pushUrl(f.href || f.src || f.url));

  const basePublic = path.join(__dirname, '..', 'public');
  const results = await downloadAssets(list, basePublic);
  const report = { total: results.length, successes: results.filter(r => r.ok).length, failures: results.filter(r => !r.ok) };
  const outPath = path.join(__dirname, '..', 'docs', 'research', 'download-report.json');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify({ report, results }, null, 2), 'utf8');
  console.log('Download finished. Report saved to', outPath);
}

main().catch(err => { console.error(err); process.exit(1); });
