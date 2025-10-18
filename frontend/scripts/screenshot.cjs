/**
 * Screenshot Utility for Kashaya Fabs ERP
 *
 * This script takes a screenshot of a page using headless browser.
 * Agents can use this to capture page appearance for documentation.
 *
 * Usage:
 *   node scripts/screenshot.js [url] [output-path]
 *
 * Examples:
 *   node scripts/screenshot.js http://localhost:5173 homepage.png
 *   node scripts/screenshot.js http://localhost:5173/login login.png
 *   node scripts/screenshot.js http://localhost:5173/dashboard dashboard.png
 */

const { chromium } = require('playwright');
const path = require('path');

async function takeScreenshot(url, outputPath) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  const warnings = [];

  // Listen for console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    } else if (msg.type() === 'warning') {
      warnings.push(msg.text());
    }
  });

  // Listen for page errors
  page.on('pageerror', (error) => {
    errors.push(`Uncaught exception: ${error.message}`);
  });

  try {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📸 Screenshot Tool: ${url}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Navigate to the page
    console.log(`Loading page...`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    console.log(`Page loaded. Waiting for render...\n`);

    // Wait for page to fully render
    await page.waitForTimeout(2000);

    // Get page title
    const title = await page.title();
    console.log(`Page title: "${title}"`);

    // Get viewport size
    const viewport = page.viewportSize();
    console.log(`Viewport: ${viewport.width}x${viewport.height}\n`);

    // Take screenshot
    const fullOutputPath = path.resolve(outputPath);
    await page.screenshot({
      path: fullOutputPath,
      fullPage: true,
    });

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Screenshot saved successfully!`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`📁 Location: ${fullOutputPath}\n`);

    // Report any errors found
    if (errors.length > 0) {
      console.log(`⚠️  WARNING: Console errors detected on page:`);
      errors.forEach((err, index) => {
        console.log(`   ${index + 1}. ${err}`);
      });
      console.log();
    }

    if (warnings.length > 0) {
      console.log(`⚠️  Note: ${warnings.length} warning(s) in console`);
      console.log();
    }

    if (errors.length === 0 && warnings.length === 0) {
      console.log(`✅ No console errors detected\n`);
    }

    await browser.close();
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ ERROR: Failed to take screenshot`);
    console.error(`Message: ${error.message}\n`);

    if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      console.error(`⚠️  Possible causes:`);
      console.error(`   - Server is not running`);
      console.error(`   - Wrong URL or port number`);
      console.error(`   - Firewall blocking connection\n`);
    } else if (error.message.includes('timeout')) {
      console.error(`⚠️  Page took too long to load`);
      console.error(`   - Check if server is responding`);
      console.error(`   - Try increasing timeout\n`);
    }

    await browser.close();
    process.exit(1);
  }
}

// Get arguments from command line
const url = process.argv[2] || 'http://localhost:5173';
const outputPath = process.argv[3] || 'screenshot.png';

// Validate output path has .png extension
if (!outputPath.endsWith('.png') && !outputPath.endsWith('.jpg') && !outputPath.endsWith('.jpeg')) {
  console.error('\n❌ ERROR: Output file must have .png, .jpg, or .jpeg extension\n');
  process.exit(1);
}

// Run the screenshot
takeScreenshot(url, outputPath);
