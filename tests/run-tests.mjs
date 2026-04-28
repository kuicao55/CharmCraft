/**
 * Headless browser test runner using Puppeteer.
 * Loads test-runner.html and reports pass/fail results.
 */
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, 'test-runner.html');
const htmlUrl = `file://${htmlPath}`;

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--allow-file-access-from-files']
  });
  const page = await browser.newPage();

  // Collect console messages
  const logs = [];
  page.on('console', msg => {
    logs.push(`[console.${msg.type()}] ${msg.text()}`);
  });

  // Collect page errors
  const errors = [];
  page.on('pageerror', err => {
    errors.push(err.message);
  });

  try {
    await page.goto(htmlUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait a bit for module scripts to execute
    await page.waitForFunction(() => {
      const summary = document.querySelector('.summary');
      return summary && summary.textContent.includes('Results:');
    }, { timeout: 15000 });
  } catch (e) {
    console.error('ERROR: Test page did not produce results in time.');
    console.error('Console logs:');
    logs.forEach(l => console.error('  ' + l));
    console.error('Page errors:');
    errors.forEach(e => console.error('  ' + e));
    await browser.close();
    process.exit(2);
  }

  // Extract results from the page
  const result = await page.evaluate(() => {
    const passEls = document.querySelectorAll('.pass');
    const failEls = document.querySelectorAll('.fail');
    const summaryEl = document.querySelector('.summary');
    return {
      passed: passEls.length,
      failed: failEls.length,
      summary: summaryEl ? summaryEl.textContent.trim() : 'No summary',
      failures: Array.from(failEls).map(el => el.textContent.trim())
    };
  });

  console.log('\n=== PngToBody Test Results ===\n');
  console.log(result.summary);
  console.log('');

  if (result.failures.length > 0) {
    console.log('Failed tests:');
    result.failures.forEach(f => console.log('  ' + f));
  }

  if (errors.length > 0) {
    console.log('\nPage errors:');
    errors.forEach(e => console.log('  ' + e));
  }

  await browser.close();
  process.exit(result.failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
