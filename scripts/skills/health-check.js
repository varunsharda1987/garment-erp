#!/usr/bin/env node
/**
 * Live API Health Checker
 *
 * Prevents the #1 documented pitfall: debugging correct code against a stale server process.
 *
 * Checks:
 * 1. Node process age (kills stale processes older than threshold)
 * 2. Backend server reachability
 * 3. Frontend dev server reachability
 * 4. API endpoint response validation
 *
 * Usage:
 *   node scripts/skills/health-check.js [--check|--processes|--endpoints|--help]
 */

const { execSync } = require('child_process');
const http = require('http');
const path = require('path');

const colors = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m',
};

function c(color, text) { return `${colors[color]}${text}${colors.reset}`; }

// ─── Process Checker ──────────────────────────────────────────

function checkNodeProcesses() {
  console.log(`${c('bright', '1. Checking Node.js processes...')}\n`);

  try {
    // Get all node processes with start times (Windows PowerShell)
    const output = execSync(
      'powershell -Command "Get-Process node -ErrorAction SilentlyContinue | Select-Object Id, StartTime, Path | ConvertTo-Json"',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );

    if (!output || output.trim() === '') {
      console.log(`  ${c('yellow', '⚠')}  No Node.js processes running`);
      console.log(`  ${c('dim', 'Start servers: cd backend && npm run dev')}\n`);
      return { running: false, stale: false, processes: [] };
    }

    let processes = JSON.parse(output);
    if (!Array.isArray(processes)) processes = [processes];

    const now = new Date();
    const staleThreshold = 4 * 60 * 60 * 1000; // 4 hours
    const results = [];

    for (const proc of processes) {
      if (!proc.StartTime) continue;

      // PowerShell serializes dates as \/Date(milliseconds)\/
      let startTime;
      const dateMatch = typeof proc.StartTime === 'string' && proc.StartTime.match(/Date\((\d+)\)/);
      if (dateMatch) {
        startTime = new Date(parseInt(dateMatch[1], 10));
      } else {
        startTime = new Date(proc.StartTime);
      }
      const ageMs = now - startTime;
      const ageHours = Math.round(ageMs / (60 * 60 * 1000) * 10) / 10;
      const isStale = ageMs > staleThreshold;

      const status = isStale ? c('red', 'STALE') : c('green', 'OK');
      const ageStr = ageHours < 1
        ? `${Math.round(ageMs / 60000)} min`
        : `${ageHours} hrs`;

      console.log(`  PID ${String(proc.Id).padEnd(6)} ${status.padEnd(20)} Age: ${ageStr.padEnd(10)} ${c('dim', (proc.Path || '').substring(0, 60))}`);

      results.push({
        pid: proc.Id,
        startTime,
        ageMs,
        ageHours,
        isStale,
        path: proc.Path,
      });
    }

    const staleCount = results.filter(r => r.isStale).length;

    if (staleCount > 0) {
      console.log(`\n  ${c('red', `⚠ ${staleCount} stale process(es) detected!`)}`);
      console.log(`  ${c('yellow', 'Kill stale processes and restart:')}`);
      results.filter(r => r.isStale).forEach(r => {
        console.log(`    ${c('dim', `powershell -Command "Stop-Process -Id ${r.pid} -Force"`)}`);
      });
      console.log(`    ${c('dim', 'cd backend && npm run dev')}`);
    } else {
      console.log(`\n  ${c('green', '✓')} All processes are fresh`);
    }

    console.log();
    return { running: results.length > 0, stale: staleCount > 0, processes: results };

  } catch (error) {
    console.log(`  ${c('yellow', '⚠')}  Could not check processes: ${error.message}\n`);
    return { running: false, stale: false, processes: [], error: error.message };
  }
}

// ─── Endpoint Checker ─────────────────────────────────────────

function httpGet(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, ok: true }));
    });
    req.on('error', (err) => resolve({ status: 0, data: '', ok: false, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, data: '', ok: false, error: 'timeout' }); });
  });
}

async function checkEndpoints() {
  console.log(`${c('bright', '2. Checking server endpoints...')}\n`);

  const checks = [
    { name: 'Backend API', url: 'http://localhost:5000/api/health', expectStatus: [200, 401, 404] },
    { name: 'Backend root', url: 'http://localhost:5000/', expectStatus: [200, 404] },
  ];

  let allOk = true;

  for (const check of checks) {
    const result = await httpGet(check.url);

    if (!result.ok) {
      console.log(`  ${c('red', '✗')} ${check.name.padEnd(20)} ${c('red', 'UNREACHABLE')} ${c('dim', result.error)}`);
      allOk = false;
    } else if (check.expectStatus.includes(result.status)) {
      console.log(`  ${c('green', '✓')} ${check.name.padEnd(20)} ${c('green', `HTTP ${result.status}`)}`);
    } else {
      console.log(`  ${c('yellow', '⚠')} ${check.name.padEnd(20)} HTTP ${result.status} ${c('dim', '(unexpected)')}`);
    }
  }

  // Try frontend
  const frontendResult = await httpGet('http://localhost:5173/');
  if (!frontendResult.ok) {
    console.log(`  ${c('yellow', '⚠')} ${'Frontend'.padEnd(20)} ${c('yellow', 'NOT RUNNING')} ${c('dim', 'cd frontend && npm run dev')}`);
  } else {
    console.log(`  ${c('green', '✓')} ${'Frontend'.padEnd(20)} ${c('green', `HTTP ${frontendResult.status}`)}`);
  }

  console.log();
  return allOk;
}

async function checkSpecificEndpoints(endpoints) {
  console.log(`${c('bright', '3. Testing specific API endpoints...')}\n`);

  for (const endpoint of endpoints) {
    const url = `http://localhost:5000/api${endpoint}`;
    const result = await httpGet(url);

    if (!result.ok) {
      console.log(`  ${c('red', '✗')} ${endpoint.padEnd(40)} ${c('red', 'UNREACHABLE')}`);
    } else if (result.status === 401) {
      // 401 = endpoint exists but needs auth — this is GOOD
      console.log(`  ${c('green', '✓')} ${endpoint.padEnd(40)} ${c('green', '401 (auth required — route exists)')}`);
    } else if (result.status === 404) {
      console.log(`  ${c('red', '✗')} ${endpoint.padEnd(40)} ${c('red', '404 (route NOT found)')}`);
    } else {
      console.log(`  ${c('green', '✓')} ${endpoint.padEnd(40)} ${c('green', `${result.status}`)}`);
    }
  }

  console.log();
}

// ─── Recently Modified Routes Detection ──────────────────────

function getRecentlyModifiedRoutes() {
  try {
    // Get recently modified route files from git
    const output = execSync('git diff --name-only HEAD~1 HEAD -- "backend/src/routes/"', {
      encoding: 'utf-8', cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe']
    });

    const routeFiles = output.trim().split('\n').filter(f => f && f.endsWith('.routes.ts'));

    // Also check unstaged changes
    const unstaged = execSync('git diff --name-only -- "backend/src/routes/"', {
      encoding: 'utf-8', cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe']
    });

    const unstagedRoutes = unstaged.trim().split('\n').filter(f => f && f.endsWith('.routes.ts'));

    const allRoutes = [...new Set([...routeFiles, ...unstagedRoutes])];

    // Extract endpoint paths from route files
    const endpoints = [];
    const fs = require('fs');

    for (const routeFile of allRoutes) {
      try {
        const fullPath = path.join(process.cwd(), routeFile);
        if (!fs.existsSync(fullPath)) continue;

        const content = fs.readFileSync(fullPath, 'utf-8');
        // Extract route prefix from file name
        const moduleName = path.basename(routeFile, '.routes.ts');
        const plural = moduleName.endsWith('y')
          ? moduleName.slice(0, -1) + 'ies'
          : moduleName.endsWith('s') ? moduleName : moduleName + 's';

        endpoints.push(`/${plural}`);
        endpoints.push(`/${plural}/search`);
      } catch {}
    }

    return endpoints;
  } catch {
    return [];
  }
}

// ─── Help ─────────────────────────────────────────────────────

function showHelp() {
  console.log(`
${c('bright', c('cyan', 'Live API Health Checker'))}

Prevents the #1 pitfall: debugging correct code against a stale server.

${c('bright', 'Usage:')}
  node scripts/skills/health-check.js [mode]

${c('bright', 'Modes:')}
  ${c('cyan', '--check')}       Full health check: processes + endpoints (default)
  ${c('cyan', '--processes')}   Check only Node.js process ages
  ${c('cyan', '--endpoints')}   Check only endpoint reachability
  ${c('cyan', '--test')} <path> Test a specific API endpoint (e.g., --test /agencies)
  ${c('cyan', '--help')}        Show this help

${c('bright', 'Examples:')}
  node scripts/skills/health-check.js                    # Full check
  node scripts/skills/health-check.js --processes        # Just processes
  node scripts/skills/health-check.js --test /agencies   # Test specific endpoint

${c('bright', 'What it checks:')}
  1. Node.js process age (flags processes older than 4 hours as stale)
  2. Backend API reachability (port 5000)
  3. Frontend dev server reachability (port 5173)
  4. Recently modified route endpoints (from git diff)

${c('bright', 'Key insight:')}
  If an endpoint returns 404 but your code looks correct,
  you probably have a stale server process. This tool catches that.
`);
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--check';

  console.log(`\n${c('bright', c('cyan', '=== API Health Check ==='))}\n`);

  switch (mode) {
    case '--check': {
      const procResult = checkNodeProcesses();
      const endpointOk = await checkEndpoints();

      // Auto-detect recently modified routes and test them
      const recentEndpoints = getRecentlyModifiedRoutes();
      if (recentEndpoints.length > 0) {
        await checkSpecificEndpoints(recentEndpoints);
      }

      // Summary
      console.log(c('cyan', '─'.repeat(50)));
      if (procResult.stale) {
        console.log(`\n${c('red', '✗ STALE PROCESSES DETECTED — kill and restart before debugging!')}\n`);
        return 1;
      } else if (!procResult.running) {
        console.log(`\n${c('yellow', '⚠ No Node processes running. Start servers first.')}\n`);
        return 1;
      } else if (!endpointOk) {
        console.log(`\n${c('yellow', '⚠ Some endpoints unreachable. Check server logs.')}\n`);
        return 1;
      } else {
        console.log(`\n${c('green', '✓ All systems healthy!')}\n`);
        return 0;
      }
    }

    case '--processes':
      checkNodeProcesses();
      return 0;

    case '--endpoints':
      await checkEndpoints();
      return 0;

    case '--test': {
      const endpoint = args[1];
      if (!endpoint) {
        console.error(`${c('red', 'Error:')} --test requires an endpoint path (e.g., --test /agencies)`);
        return 1;
      }
      await checkSpecificEndpoints([endpoint]);
      return 0;
    }

    case '--help':
      showHelp();
      return 0;

    default:
      console.error(`${c('red', 'Unknown mode:')} ${mode}. Use --help for usage.`);
      return 1;
  }
}

if (require.main === module) {
  main().then(code => process.exit(code));
}
