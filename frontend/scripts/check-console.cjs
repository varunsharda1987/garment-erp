/**
 * Console Error Checker for Kashaya Fabs ERP
 *
 * This script opens a page in headless browser and checks for console errors.
 * Agents can use this to verify there are no runtime JavaScript errors.
 *
 * Usage:
 *   node scripts/check-console.js [url]
 *
 * Examples:
 *   node scripts/check-console.js http://localhost:5173
 *   node scripts/check-console.js http://localhost:5173/login
 *   node scripts/check-console.js http://localhost:5173/dashboard
 */

const { chromium } = require('playwright');

async function checkConsole(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  const warnings = [];
  const logs = [];

  // Listen for console messages
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();

    if (type === 'error') {
      errors.push(text);
    } else if (type === 'warning') {
      warnings.push(text);
    } else if (type === 'log') {
      logs.push(text);
    }
  });

  // Listen for page errors (uncaught exceptions)
  page.on('pageerror', (error) => {
    errors.push(`Uncaught exception: ${error.message}\n${error.stack}`);
  });

  // Listen for failed requests
  const failedRequests = [];
  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText || 'Unknown error',
    });
  });

  try {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔍 Console Error Check: ${url}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Navigate to the page
    console.log(`Loading page...`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    console.log(`Page loaded. Waiting for JavaScript execution...\n`);

    // Wait for JavaScript to execute
    await page.waitForTimeout(3000);

    // Get page title
    const title = await page.title();
    console.log(`Page title: "${title}"\n`);

    // Print results
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 RESULTS`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    console.log(`Console Errors:   ${errors.length}`);
    console.log(`Console Warnings: ${warnings.length}`);
    console.log(`Failed Requests:  ${failedRequests.length}`);
    console.log(`Console Logs:     ${logs.length}\n`);

    // Show errors if any
    if (errors.length > 0) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`❌ CONSOLE ERRORS FOUND:`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      errors.forEach((err, index) => {
        console.log(`${index + 1}. ${err}\n`);
      });
    }

    // Show warnings if any
    if (warnings.length > 0) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`⚠️  CONSOLE WARNINGS:`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      warnings.forEach((warn, index) => {
        console.log(`${index + 1}. ${warn}\n`);
      });
    }

    // Show failed requests if any
    if (failedRequests.length > 0) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`❌ FAILED NETWORK REQUESTS:`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      failedRequests.forEach((req, index) => {
        console.log(`${index + 1}. ${req.method} ${req.url}`);
        console.log(`   Error: ${req.failure}\n`);
      });
    }

    // Final verdict
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    if (errors.length === 0 && failedRequests.length === 0) {
      console.log(`✅ NO CONSOLE ERRORS - Page is clean!`);
      if (warnings.length > 0) {
        console.log(`⚠️  Note: ${warnings.length} warning(s) found (not critical)`);
      }
    } else {
      console.log(`❌ VERIFICATION FAILED`);
      console.log(`   ${errors.length} error(s) found`);
      console.log(`   ${failedRequests.length} failed request(s)`);
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    await browser.close();

    // Exit with appropriate code
    if (errors.length > 0 || failedRequests.length > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error(`\n❌ ERROR: Failed to check console`);
    console.error(`Message: ${error.message}\n`);

    if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      console.error(`⚠️  Possible causes:`);
      console.error(`   - Server is not running`);
      console.error(`   - Wrong URL or port number`);
      console.error(`   - Firewall blocking connection\n`);
    }

    await browser.close();
    process.exit(1);
  }
}

// Get URL from command line or use default
const url = process.argv[2] || 'http://localhost:5173';

// Run the check
checkConsole(url);
