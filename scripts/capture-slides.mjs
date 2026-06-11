#!/usr/bin/env node
/**
 * Capture high-quality screenshots from the presentation demo for Google Slides.
 *
 * Uses the real Driver.js tour so every screenshot includes the highlight
 * overlay and popover — exactly as the audience sees it live.
 *
 * Static steps  → PNG at 2× device-pixel-ratio (3840×2160)
 * FLIP animation → frame PNGs encoded into an optimised GIF via ffmpeg
 *
 * Usage:  npm run capture          (or: node scripts/capture-slides.mjs)
 * Output: slides/*.png, slides/step-05-06-flip-animation.gif
 */

import puppeteer from 'puppeteer';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SITE_DIR   = join(__dirname, '..');
const LIGHT_MODE = process.argv.includes('--light');
const ONLY_STEP  = (() => {
  const idx = process.argv.indexOf('--only');
  return idx !== -1 ? Number(process.argv[idx + 1]) : null;
})();
const OUT_DIR    = join(SITE_DIR, LIGHT_MODE ? 'slides-light' : 'slides');
const FRAMES_DIR = join(OUT_DIR, 'frames');
const PORT       = 8787;
// 1920/1.25 × 1080/1.25 → content renders 25% larger (125% zoom)
const VIEWPORT   = { width: 1536, height: 864 };

/* ── Tiny static file server ──────────────────────────────────────── */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
};

function startServer() {
  return new Promise(resolve => {
    const server = createServer(async (req, res) => {
      const url  = new URL(req.url, `http://localhost:${PORT}`);
      let   path = decodeURIComponent(url.pathname);
      if (path.endsWith('/')) path += 'index.html';
      const file = join(SITE_DIR, path);
      try {
        const data = await readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(PORT, () => resolve(server));
  });
}

/* ── Driver.js step index → capture map ────────────────────────────── */
// The Driver.js tour has 7 steps (indices 0–6).
// Every step is captured — 1:1 mapping with Google Slides.

const TOTAL_DRIVER_STEPS = 7;

const CAPTURES = {
  0: 'step-01-homepage-hero',
  1: 'step-02-assessment-dropdown',
  2: 'step-03-profile-selection',
  3: 'step-04-data-sovereignty',
  4: 'step-05-results-and-gaps',
  5: 'step-06-ecosystem-overview',
  6: 'step-07-assurance-rh',
};

const ECOSYSTEM_IDX = 5;
const FLIP_IDX      = 6;

/* ── Helpers ──────────────────────────────────────────────────────── */

const sleep = ms => new Promise(r => setTimeout(r, ms));

function fileSizeMB(path) {
  try {
    const bytes = execSync(`stat -c%s "${path}"`, { encoding: 'utf-8' }).trim();
    return (Number(bytes) / 1024 / 1024).toFixed(2);
  } catch { return '?'; }
}

async function waitForDemoData(page) {
  await page.waitForFunction('window.siteLoaded === true', { timeout: 20000 });
}

async function waitForDriverPopover(page) {
  await page.waitForSelector('.driver-popover', { visible: true, timeout: 10000 });
  await sleep(600);
}

async function waitForImages(page) {
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.querySelectorAll('#demo-landscape-root .landscape-tile-img')).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        });
      })
    )
  );
  await sleep(1000);
}

/* ── Static screenshot capture (with Driver.js overlay) ───────────── */

async function captureStaticScreenshots(page) {
  console.log('\n══ Static screenshots (PNG, 2× DPR, 125% zoom, with Driver.js highlights) ══\n');
  await page.setViewport({ ...VIEWPORT, deviceScaleFactor: 2 });
  await sleep(300);

  console.log('  Starting Driver.js tour…');
  await page.evaluate(() => {
    window.phase = 'slides';
    window.startDemo();
  });
  await waitForDriverPopover(page);
  console.log('  Tour started.\n');

  let imagesLoaded = false;

  for (let i = 0; i < TOTAL_DRIVER_STEPS; i++) {
    // Advance the tour (skip for the first step which is already showing)
    if (i > 0) {
      await page.evaluate(() => window.driverObj.moveNext());
      await waitForDriverPopover(page);
    }

    const name = CAPTURES[i];

    // Skip steps not in the capture map
    if (!name) {
      console.log(`  (driver idx ${i} — skipped)`);
      continue;
    }

    // --only flag: skip capture (but still advance tour) for non-target steps
    if (ONLY_STEP !== null && i !== ONLY_STEP) {
      console.log(`  (driver idx ${i} — not target, advancing)`);
      continue;
    }

    process.stdout.write(`  ${name} … `);

    // Ecosystem: hide filter toolbar and wait for CNCF logos to load
    if (i === ECOSYSTEM_IDX && !imagesLoaded) {
      await page.evaluate(() => {
        var toolbar = document.querySelector('#demo-s-ecosystem .landscape-toolbar');
        if (toolbar) toolbar.style.display = 'none';
        var legend = document.getElementById('demo-rh-legend');
        if (legend) legend.style.display = 'none';
      });
      process.stdout.write('(waiting for logos) ');
      await waitForImages(page);
      await sleep(2000);
      imagesLoaded = true;
    }

    // Results+gaps step: freeze the gap-pulse at visible red
    if (i === 4) {
      await page.evaluate(() => {
        document.querySelectorAll('.demo-gap-row td').forEach(td => {
          td.style.background = 'rgba(239, 68, 68, .18)';
        });
      });
      await sleep(200);
    }

    // FLIP animation steps: wait for tiles to settle
    if (i === FLIP_IDX || i === FLIP_IDX + 1) {
      await sleep(3000);
    }

    const out = join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: out, fullPage: false });
    console.log(`✓  (${fileSizeMB(out)} MB)`);
  }

  // Tear down Driver.js without triggering showClosingSlides()
  await page.evaluate(() => {
    if (window.driverObj) {
      window.driverObj.setConfig({ onDestroyed: () => {} });
      window.driverObj.destroy();
      window.driverObj = null;
    }
    document.getElementById('demo-site').style.display = 'block';
    document.getElementById('closing-viewer').style.display = 'none';
    document.body.classList.add('demo-active');
  });
  await sleep(500);
}

/* ── GIF: FLIP animation (step 10 → 11) ──────────────────────────── */

async function captureFlipGif(page) {
  console.log('\n══ FLIP animation GIF ══\n');

  if (existsSync(FRAMES_DIR)) await rm(FRAMES_DIR, { recursive: true });
  await mkdir(FRAMES_DIR, { recursive: true });

  await page.setViewport({ ...VIEWPORT, deviceScaleFactor: 1 });
  await sleep(300);

  // Reset to ecosystem without RH highlight (clean state for GIF)
  await page.evaluate(() => {
    showDemoSection('demo-s-ecosystem');
    setNavActive('ecosystem');
    clearEcosystemHighlights();
    // Hide the filter toolbar so tiles fill the frame
    var toolbar = document.querySelector('#demo-s-ecosystem .landscape-toolbar');
    if (toolbar) toolbar.style.display = 'none';
    var legend = document.getElementById('demo-rh-legend');
    if (legend) legend.style.display = 'none';
    var root = document.getElementById('demo-landscape-root');
    root.classList.remove('rh-highlight', 'flipping');
    document.querySelectorAll('.landscape-tile').forEach(t => {
      t.classList.remove('is-flipping');
      t.style.transition = '';
      t.style.transitionDelay = '';
      t.style.transformOrigin = '';
      t.style.transform = '';
    });
    window.scrollTo(0, 0);
  });
  await sleep(1500);

  const FPS = 10;
  const FRAME_INTERVAL = 1000 / FPS;
  const HOLD_BEFORE_S  = 1.0;
  const HOLD_AFTER_S   = 50.0;

  let frameNum = 0;
  const pad = n => String(n).padStart(4, '0');

  // Phase 1 — hold initial state
  const holdBeforeCount = Math.round(HOLD_BEFORE_S * FPS);
  process.stdout.write(`  Phase 1: initial hold (${holdBeforeCount} frames) … `);
  const initFrame = await page.screenshot({ encoding: 'binary' });
  for (let i = 0; i < holdBeforeCount; i++) {
    await writeFile(join(FRAMES_DIR, `frame-${pad(frameNum++)}.png`), initFrame);
  }
  console.log('✓');

  // Phase 2 — trigger animation, capture frames as fast as possible
  process.stdout.write('  Phase 2: FLIP animation … ');
  await page.evaluate(() => {
    var root = document.getElementById('demo-landscape-root');
    document.getElementById('demo-rh-toggle').checked = true;
    window.flipToggle(root, true);
  });

  const animStart = Date.now();
  const animDuration = 3500;
  while (Date.now() - animStart < animDuration) {
    const frameStart = Date.now();
    const buf = await page.screenshot({ encoding: 'binary' });
    await writeFile(join(FRAMES_DIR, `frame-${pad(frameNum++)}.png`), buf);
    const elapsed = Date.now() - frameStart;
    const remaining = FRAME_INTERVAL - elapsed;
    if (remaining > 0) await sleep(remaining);
  }
  const animFrames = frameNum - holdBeforeCount;
  console.log(`✓  (${animFrames} frames captured)`);

  // Phase 3 — hold final state (with DS-2 highlight)
  await page.evaluate(() => {
    var sec = document.querySelector('[data-category="DS-2"]');
    if (sec) sec.classList.add('demo-highlight-domain');
  });
  await sleep(300);

  const holdAfterCount = Math.round(HOLD_AFTER_S * FPS);
  process.stdout.write(`  Phase 3: final hold (${holdAfterCount} frames) … `);
  const finalFrame = await page.screenshot({ encoding: 'binary' });
  for (let i = 0; i < holdAfterCount; i++) {
    await writeFile(join(FRAMES_DIR, `frame-${pad(frameNum++)}.png`), finalFrame);
  }
  console.log('✓');

  // Encode with ffmpeg: two-pass palettegen for optimal 256-colour palette
  const gifPath = join(OUT_DIR, 'step-06-07-flip-animation.gif');
  const palettePath = join(FRAMES_DIR, 'palette.png');

  process.stdout.write('  Encoding GIF (ffmpeg palettegen) … ');

  execSync([
    'ffmpeg', '-y',
    `-framerate ${FPS}`,
    `-i "${join(FRAMES_DIR, 'frame-%04d.png')}"`,
    `-vf "palettegen=max_colors=256:stats_mode=diff"`,
    `"${palettePath}"`,
  ].join(' '), { stdio: 'pipe' });

  execSync([
    'ffmpeg', '-y',
    `-framerate ${FPS}`,
    `-i "${join(FRAMES_DIR, 'frame-%04d.png')}"`,
    `-i "${palettePath}"`,
    `-filter_complex "[0:v][1:v]paletteuse=dither=bayer:bayer_scale=5"`,
    '-loop 0',
    `"${gifPath}"`,
  ].join(' '), { stdio: 'pipe' });

  console.log(`✓  (${fileSizeMB(gifPath)} MB, ${frameNum} total frames)`);

  await rm(FRAMES_DIR, { recursive: true });
  console.log('  Cleaned up frame directory.');
}

/* ── Main ─────────────────────────────────────────────────────────── */

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log('Starting local server…');
  const server = await startServer();
  console.log(`  http://localhost:${PORT}`);

  console.log('Launching browser…');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ],
  });

  const page = await browser.newPage();

  if (LIGHT_MODE) {
    await page.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: 'light' },
    ]);
    console.log('  Color scheme: light (forced)');
  }

  console.log('Loading presentation.html…');
  await page.goto(`http://localhost:${PORT}/presentation.html`, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  await waitForDemoData(page);
  console.log('Demo data ready.');

  await captureStaticScreenshots(page);
  if (ONLY_STEP === null) {
    await captureFlipGif(page);
  }

  await browser.close();
  server.close();

  // Summary
  console.log('\n══ Summary ══\n');
  const files = (await readdir(OUT_DIR)).filter(f => f.endsWith('.png') || f.endsWith('.gif')).sort();
  for (const f of files) {
    console.log(`  ${f}  (${fileSizeMB(join(OUT_DIR, f))} MB)`);
  }
  console.log(`\n  Total: ${files.length} files in slides/`);
  console.log('  Done!\n');
}

main().catch(err => {
  console.error('\n✗ Fatal error:', err);
  process.exit(1);
});
