/**
 * Capture presentation demo slides as PNG + animated GIF.
 *
 * Usage:
 *   node capture-slides.cjs --theme light --output slides-light
 *   node capture-slides.cjs --theme dark  --output slides
 *
 * The only difference between dark and light is the emulated
 * prefers-color-scheme media feature and the output directory.
 */
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ── CLI args ────────────────────────────────────────────────
const args = process.argv.slice(2);
const themeIdx = args.indexOf('--theme');
const outputIdx = args.indexOf('--output');
const THEME = themeIdx !== -1 ? args[themeIdx + 1] : 'light';
const OUTPUT_DIR = path.join(__dirname, outputIdx !== -1 ? args[outputIdx + 1] : `slides-${THEME}`);
const FRAMES_DIR = path.join(OUTPUT_DIR, '_gif_frames');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Steps to capture (map to Driver.js tour indices 0-10) ───
const STEPS = [
  { name: 'step-01-homepage-hero' },
  { name: 'step-02-assessment-dropdown' },
  { name: 'step-03-readiness-intro' },
  { name: 'step-05-profile-selection', scrollTop: true },
  { name: 'step-06-data-sovereignty' },
  { name: 'step-07-technical-sovereignty' },
  { name: 'step-08-results-and-gaps', skip: true },
  { name: 'step-08-results-and-gaps', scrollToScore: true },
  { name: 'step-10-ecosystem-overview' },
  { name: 'step-11-technical-rh' },
  { name: 'step-12-assurance-rh' },
];

const VIEWPORT = { width: 1536, height: 864, deviceScaleFactor: 2 };

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: THEME }
  ]);

  await page.goto('http://localhost:8080/presentation.html', { waitUntil: 'networkidle0' });

  // Start demo tour
  await page.evaluate(() => { phase = 'slides'; startDemo(); });
  await page.waitForSelector('.driver-popover', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1500));

  // ── Capture each step ─────────────────────────────────────
  for (let i = 0; i < STEPS.length; i++) {
    if (i > 0) {
      await page.evaluate(() => { driverObj.moveNext(); });
      await new Promise(r => setTimeout(r, 1200));
    }

    if (STEPS[i].skip) continue;

    if (STEPS[i].scrollToScore) {
      await page.evaluate(() => {
        const el = document.querySelector('#demo-results-section');
        if (el) { el.scrollIntoView({ block: 'start', behavior: 'instant' }); window.scrollBy(0, -10); }
      });
      await new Promise(r => setTimeout(r, 400));
    }

    if (STEPS[i].scrollTop) {
      await page.evaluate(() => {
        const el = document.querySelector('#demo-profile-block');
        if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
      });
      await new Promise(r => setTimeout(r, 400));
    }

    console.log(`Capturing: ${STEPS[i].name}`);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${STEPS[i].name}.png`) });
  }

  // ── Generate flip animation GIF ──────────────────────────
  console.log('\nCapturing GIF frames...');
  fs.mkdirSync(FRAMES_DIR, { recursive: true });

  // Use 1x DPI for GIF (keeps file size manageable, matches dark version)
  await page.setViewport({ width: 1536, height: 864, deviceScaleFactor: 1 });

  // Go back to step 10 (ecosystem overview) to get the exact scroll position
  await page.evaluate(() => { driverObj.moveTo(8); });
  await new Promise(r => setTimeout(r, 1500));

  // Hide Driver.js overlay and popover but keep the scroll position
  await page.addStyleTag({ content: `
    .driver-overlay { opacity: 0 !important; pointer-events: none !important; }
    .driver-popover { display: none !important; }
    #driver-highlighted-element-stage, .driver-active-element { outline: none !important; }
  `});
  await new Promise(r => setTimeout(r, 500));

  // GIF: ~1.6s initial + ~2.4s transition + 30s final hold
  // At 5fps: 8 init + 12 transition + 150 final = 170 frames

  // Capture initial state (hold for 8 frames = 1.6s)
  const initFrame = path.join(FRAMES_DIR, 'frame-init.png');
  await page.screenshot({ path: initFrame });
  for (let f = 0; f < 8; f++) {
    fs.copyFileSync(initFrame, path.join(FRAMES_DIR, `frame-${String(f).padStart(3, '0')}.png`));
  }

  // Enable RH toggle — flip animation
  await page.evaluate(() => {
    const root = document.getElementById('demo-landscape-root');
    document.getElementById('demo-rh-toggle').checked = true;
    document.getElementById('demo-rh-legend').classList.remove('hidden');
    if (window.flipToggle) window.flipToggle(root, true);
    else root.classList.add('rh-highlight');
  });

  // Capture transition frames (12 frames)
  for (let f = 8; f < 20; f++) {
    await new Promise(r => setTimeout(r, 150));
    await page.screenshot({ path: path.join(FRAMES_DIR, `frame-${String(f).padStart(3, '0')}.png`) });
  }

  // Hold final state for 30 seconds (150 frames at 5fps)
  await new Promise(r => setTimeout(r, 500));
  const finalFrame = path.join(FRAMES_DIR, 'frame-final.png');
  await page.screenshot({ path: finalFrame });
  for (let f = 20; f < 170; f++) {
    fs.copyFileSync(finalFrame, path.join(FRAMES_DIR, `frame-${String(f).padStart(3, '0')}.png`));
  }

  await browser.close();

  // Assemble GIF (1536px wide, same as dark version)
  console.log('Assembling GIF...');
  const gifPath = path.join(OUTPUT_DIR, 'step-10-11-flip-animation.gif');
  execSync(
    `ffmpeg -y -framerate 5 -i "${FRAMES_DIR}/frame-%03d.png" ` +
    `-vf "scale=1536:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" ` +
    `"${gifPath}"`,
    { stdio: 'pipe' }
  );

  fs.rmSync(FRAMES_DIR, { recursive: true });
  console.log(`\nDone! Slides saved to ${OUTPUT_DIR}`);
})();
