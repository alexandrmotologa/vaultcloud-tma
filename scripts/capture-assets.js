import puppeteer from 'puppeteer';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureAssets() {
  const imagesDir = path.resolve(process.cwd(), 'docs/images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const framesDir = path.resolve(process.cwd(), 'temp_frames');
  if (fs.existsSync(framesDir)) {
    fs.rmSync(framesDir, { recursive: true, force: true });
  }
  fs.mkdirSync(framesDir, { recursive: true });

  console.log('[Puppeteer] Launching browser at 1280x800 (scale 2)...');
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: {
      width: 1280,
      height: 800,
      deviceScaleFactor: 2,
    },
  });

  const page = await browser.newPage();
  let frameIdx = 0;

  async function captureFrame() {
    const filename = path.join(framesDir, `frame_${String(frameIdx).padStart(3, '0')}.png`);
    await page.screenshot({ path: filename });
    frameIdx++;
  }

  console.log('[Puppeteer] Navigating to VaultCloud TMA...');
  await page.goto('http://127.0.0.1:8085/index.html', { waitUntil: 'networkidle0' });
  await sleep(600);

  // 1. Screenshot: Unlock Screen
  console.log('[Puppeteer] Capturing unlock screen...');
  await page.screenshot({ path: path.join(imagesDir, 'screenshot_unlock.png') });
  for (let i = 0; i < 4; i++) await captureFrame();

  // Type master passphrase directly
  const passwordInput = await page.$('input[placeholder*="passphrase"]');
  if (passwordInput) {
    await passwordInput.type('DemoPassword123!', { delay: 40 });
  }
  await sleep(300);
  for (let i = 0; i < 3; i++) await captureFrame();

  // Click Submit / Unlock button
  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
  }

  // Wait for main drive interface
  await page.waitForSelector('header', { timeout: 6000 });
  await sleep(1500);
  for (let i = 0; i < 6; i++) await captureFrame();

  // 2. Screenshot: Main Drive View
  console.log('[Puppeteer] Capturing main drive view...');
  await page.screenshot({ path: path.join(imagesDir, 'screenshot_drive.png') });

  // 3. Navigate into "Work Documents" folder
  console.log('[Puppeteer] Navigating into folder...');
  const folderElements = await page.$$('div, button');
  for (const el of folderElements) {
    const text = await page.evaluate((e) => e.textContent, el);
    if (text && text.trim() === 'Work Documents') {
      await el.click();
      break;
    }
  }
  await sleep(800);
  for (let i = 0; i < 5; i++) await captureFrame();

  // 4. Open file preview modal
  console.log('[Puppeteer] Opening decrypted file preview...');
  const files = await page.$$('div, button');
  for (const el of files) {
    const text = await page.evaluate((e) => e.textContent, el);
    if (text && text.includes('Q3_Project_Report.pdf')) {
      await el.click();
      break;
    }
  }
  await sleep(1000);
  for (let i = 0; i < 6; i++) await captureFrame();
  await page.screenshot({ path: path.join(imagesDir, 'screenshot_preview.png') });

  // Close preview modal
  await page.keyboard.press('Escape');
  await sleep(400);

  // Navigate back to root via breadcrumbs
  const breadcrumbRoot = await page.$('nav button');
  if (breadcrumbRoot) {
    await breadcrumbRoot.click();
    await sleep(600);
    for (let i = 0; i < 4; i++) await captureFrame();
  }

  // 5. Open Storage Breakdown modal
  console.log('[Puppeteer] Opening storage analytics modal...');
  const statsBtn = await page.$('button[title="Storage Breakdown"]');
  if (statsBtn) {
    await statsBtn.click();
    await sleep(800);
    await page.screenshot({ path: path.join(imagesDir, 'screenshot_storage.png') });
    for (let i = 0; i < 5; i++) await captureFrame();
    await page.keyboard.press('Escape');
    await sleep(400);
  }

  // 6. Open Quick PIN modal
  console.log('[Puppeteer] Opening Quick PIN modal...');
  const pinBtn = await page.$('button[title*="PIN"]');
  if (pinBtn) {
    await pinBtn.click();
    await sleep(800);
    await page.screenshot({ path: path.join(imagesDir, 'screenshot_pin.png') });
    await page.keyboard.press('Escape');
    await sleep(400);
  }

  // 7. Open Encrypted Note Editor
  console.log('[Puppeteer] Opening encrypted note editor...');
  const noteBtn = await page.$('button[title="Create Encrypted Note"]');
  if (noteBtn) {
    await noteBtn.click();
    await sleep(800);
    const textarea = await page.$('textarea');
    if (textarea) {
      await textarea.type('# Encrypted Project Architecture\nAll notes encrypted with client AES-GCM-256 before storage.', { delay: 20 });
    }
    await sleep(500);
    await page.screenshot({ path: path.join(imagesDir, 'screenshot_notes.png') });
    for (let i = 0; i < 5; i++) await captureFrame();
    await page.keyboard.press('Escape');
    await sleep(400);
  }

  // 8. Select multiple files to display Batch Action Bar
  console.log('[Puppeteer] Multi-selecting files for batch action bar...');
  const selectBtns = await page.$$('button[title*="Select"]');
  if (selectBtns.length >= 2) {
    await selectBtns[0].click();
    await sleep(250);
    await selectBtns[1].click();
    await sleep(600);
    await page.screenshot({ path: path.join(imagesDir, 'screenshot_batch.png') });
    for (let i = 0; i < 5; i++) await captureFrame();
  }

  await browser.close();
  console.log(`[Puppeteer] Successfully captured ${frameIdx} frames in temp_frames`);

  // Compile demo.gif with ffmpeg
  console.log('[FFmpeg] Compiling high quality demo.gif...');
  const gifPath = path.join(imagesDir, 'demo.gif');
  const ffmpegCmd = `ffmpeg -y -framerate 6 -i "${path.join(framesDir, 'frame_%03d.png')}" -vf "scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" "${gifPath}"`;
  
  try {
    execSync(ffmpegCmd, { stdio: 'inherit' });
    console.log(`✓ Successfully created ${gifPath}`);
  } catch (err) {
    console.error('FFmpeg compilation error:', err);
  } finally {
    fs.rmSync(framesDir, { recursive: true, force: true });
    console.log('✓ Cleaned up temporary frames directory');
  }
}

captureAssets().catch((err) => {
  console.error('Fatal error capturing assets:', err);
  process.exit(1);
});
