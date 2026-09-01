#!/usr/bin/env node
// scripts/mcp/collect-assets.mjs
// Playwright-based collector: screenshots, asset discovery, basic behavior sweep.

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }

function safeName(url) {
  try { return new URL(url).hostname.replace(/[:@]/g, '-'); } catch { return 'site'; }
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 }
];

async function collect(url) {
  const host = safeName(url);
  const outDir = path.join(__dirname, '..', '..', 'docs', 'design-references');
  const researchDir = path.join(__dirname, '..', '..', 'docs', 'research');
  await ensureDir(outDir);
  await ensureDir(researchDir);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const assetsCollect = { url, host, screenshots: [], assets: null, meta: null };

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(url, { waitUntil: 'networkidle' });
    // wait a bit more for lazy loads
    await page.waitForTimeout(1000);
    const screenshotPath = path.join(outDir, `${host}-${vp.name}-${vp.width}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    assetsCollect.screenshots.push({ name: vp.name, path: screenshotPath, width: vp.width, height: vp.height });
  }

  // Run the in-page asset discovery (from SKILL)
  const assetDiscovery = await page.evaluate(() => {
    try {
      const images = [...document.querySelectorAll('img')].map(img => ({ src: img.src || img.currentSrc, alt: img.alt }));
      const videos = [...document.querySelectorAll('video')].map(v => ({ src: v.src || v.querySelector('source')?.src, poster: v.poster }));
      const backgroundImages = [...document.querySelectorAll('*')].filter(el => {
        const bg = getComputedStyle(el).backgroundImage;
        return bg && bg !== 'none';
      }).map(el => ({ url: getComputedStyle(el).backgroundImage, element: el.tagName + (el.className ? '.' + el.className.split(' ')[0] : '') }));
      const svgCount = document.querySelectorAll('svg').length;
      const fonts = [...new Set([...document.querySelectorAll('*')].slice(0, 200).map(el => getComputedStyle(el).fontFamily))];
      const favicons = [...document.querySelectorAll('link[rel*="icon"]')].map(l => ({ href: l.href, sizes: l.sizes?.toString ? l.sizes.toString() : l.sizes }));
      const animations = [...document.querySelectorAll('*')].slice(0, 500).map(el => {
        const cs = getComputedStyle(el);
        return { tag: el.tagName, classes: el.className, animation: cs.animationName, transition: cs.transitionDuration };
      }).filter(a => a.animation && a.animation !== 'none' || (a.transition && a.transition !== '0s'));
      return { images, videos, backgroundImages, svgCount, fonts, favicons, animations };
    } catch (e) {
      return { error: String(e) };
    }
  });

  assetsCollect.assets = assetDiscovery;

  // Basic scroll sweep to capture styles of top-level sections
  const topology = await page.evaluate(() => {
    const sections = [...document.querySelectorAll('main > section, body > section, header, footer, nav')].slice(0, 100).map(el => {
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        classes: el.className?.toString().split(' ').slice(0,4).join(' '),
        top: rect.top, left: rect.left, width: rect.width, height: rect.height,
        styles: { display: cs.display, position: cs.position, zIndex: cs.zIndex }
      };
    });
    return { sections };
  });

  assetsCollect.meta = { topology };

  const outPath = path.join(researchDir, `${host}-assets.json`);
  await fs.writeFile(outPath, JSON.stringify(assetsCollect, null, 2), 'utf8');

  await browser.close();
  return outPath;
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node scripts/mcp/collect-assets.mjs <url>');
    process.exit(2);
  }
  console.log('Collecting:', url);
  try {
    const out = await collect(url);
    console.log('Assets saved to', out);
    console.log('Next: run node scripts/download-assets.mjs', out);
  } catch (e) {
    console.error('Collector error:', e);
    process.exit(1);
  }
}

main();
