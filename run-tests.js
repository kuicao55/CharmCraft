/**
 * run-tests.js — Puppeteer-based test runner for browser-based tests
 *
 * Starts a local HTTP server, opens each test HTML file in a headless browser,
 * collects results, and reports them to the console.
 */
const puppeteer = require('puppeteer');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Simple static file HTTP server
function createServer(rootDir, port) {
  return new Promise((resolve, reject) => {
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
    };
    const server = http.createServer((req, res) => {
      const filePath = path.join(rootDir, req.url);
      try {
        const content = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain');
        res.end(content);
      } catch (e) {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

const TEST_FILES = [
  'tests/PhysicsScene.test.html',
  'tests/test-runner.html',
];

async function runTests() {
  const port = 8765;
  const server = await createServer(__dirname, port);
  const baseUrl = `http://127.0.0.1:${port}`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let allPassed = true;

  for (const testFile of TEST_FILES) {
    const url = `${baseUrl}/${testFile}`;
    console.log(`\n--- Running: ${testFile} ---`);

    const page = await browser.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`  [browser error] ${msg.text()}`);
      }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait for tests to complete
    await page.waitForSelector('.summary', { timeout: 30000 });

    const summary = await page.$eval('.summary', el => el.textContent);
    console.log(`  ${summary.trim()}`);

    const results = await page.$$eval('.pass, .fail', els =>
      els.map(el => ({ text: el.textContent }))
    );

    const passed = results.filter(r => r.text.startsWith('PASS')).length;
    const failed = results.filter(r => r.text.startsWith('FAIL')).length;

    console.log(`  Passed: ${passed}, Failed: ${failed}`);

    if (failed > 0) {
      allPassed = false;
      console.log('  Failed tests:');
      results.filter(r => r.text.startsWith('FAIL')).forEach(r => {
        console.log(`    - ${r.text}`);
      });
    }

    await page.close();
  }

  await browser.close();
  server.close();

  if (allPassed) {
    console.log('\n=== ALL TESTS PASSED ===\n');
    process.exit(0);
  } else {
    console.log('\n=== SOME TESTS FAILED ===\n');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});