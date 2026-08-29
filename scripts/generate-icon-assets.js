#!/usr/bin/env node
// Generates the raster icon and link-preview assets from site/favicon.svg.
//
// NOT part of `npm run build` / the Netlify build - it needs Playwright
// (a full browser download), which would make every deploy slow and heavy
// for a one-off asset that only needs regenerating when the design
// changes. Run it manually and commit the resulting PNGs:
//
//   npm install --no-save playwright
//   node scripts/generate-icon-assets.js
//
// Outputs (all committed to the repo, not generated at deploy time):
//   site/apple-touch-icon.png  180x180, iOS home-screen icon
//   site/icon-192.png          192x192, site.webmanifest icon
//   site/icon-512.png          512x512, site.webmanifest icon
//   site/og-image.png          1200x630, Open Graph / Twitter card preview

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SITE_DIR = path.join(__dirname, '..', 'site');
const SVG = fs.readFileSync(path.join(SITE_DIR, 'favicon.svg'), 'utf8');
const SVG_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(SVG).toString('base64')}`;

const TEAL = '#0B7161';
const TEAL_DARK = '#155B50';

async function shootIcon(page, size, outFile) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`
    <html><body style="margin:0;">
      <img src="${SVG_DATA_URL}" width="${size}" height="${size}">
    </body></html>
  `);
  await page.screenshot({ path: path.join(SITE_DIR, outFile) });
  console.log(`Wrote site/${outFile}`);
}

async function shootOgImage(page) {
  const width = 1200;
  const height = 630;
  await page.setViewportSize({ width, height });
  await page.setContent(`
    <html><body style="margin:0;">
      <div style="
        width:${width}px; height:${height}px; box-sizing:border-box;
        background:linear-gradient(135deg, ${TEAL} 0%, ${TEAL_DARK} 100%);
        display:flex; align-items:center; padding:0 90px;
        font-family:-apple-system,'Segoe UI',Arial,sans-serif;
      ">
        <img src="${SVG_DATA_URL}" width="180" height="180" style="flex:none; margin-right:64px;">
        <div>
          <div style="color:#ffffff; font-size:64px; font-weight:700; line-height:1.15;">STEM Impact Tracker</div>
          <div style="color:#ffffff; opacity:0.9; font-size:34px; font-weight:600; margin-top:18px;">Prototype dashboard (mock data)</div>
          <div style="color:#ffffff; opacity:0.75; font-size:26px; margin-top:22px; max-width:820px;">
            Built on synthetic data for Deakin University's School of Education. Not a live reporting tool.
          </div>
        </div>
      </div>
    </body></html>
  `);
  await page.screenshot({ path: path.join(SITE_DIR, 'og-image.png') });
  console.log('Wrote site/og-image.png');
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await shootIcon(page, 180, 'apple-touch-icon.png');
  await shootIcon(page, 192, 'icon-192.png');
  await shootIcon(page, 512, 'icon-512.png');
  await shootOgImage(page);
  await browser.close();
}

main();
