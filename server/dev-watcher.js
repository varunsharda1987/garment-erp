/**
 * Development file watcher - auto-rebuilds frontend/backend on file changes
 *
 * Runs alongside the static server. When you save a file:
 * - Frontend changes → rebuilds frontend/dist (takes ~5-10s)
 * - Backend changes → rebuilds backend/dist + restarts PM2 backend
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend', 'src');
const BACKEND = path.join(ROOT, 'backend', 'src');

// Shared restart helper. A plain `pm2 restart` here was the single biggest orphan source on this
// PC: on 2026-08-05 it drove garment-erp-api's restart counter to 1121 and the fleet watchdog
// reaped 5 stale forks in 2h. The helper does stop -> wait for the port -> kill a *verified*
// stale fork -> start -> confirm the port owner matches PM2's pid.
const SAFE_RESTART = 'C:\\Users\\NEW\\ops\\pm2-safe-restart.js';

// Build output is ~7MB/day of npm/vite/tsc noise in the PM2 log. Keep the pass/fail summary
// lines; set DEV_WATCHER_VERBOSE=1 when you actually need to read a build failure live
// (a FAILED build always prints its output regardless).
const VERBOSE = process.env.DEV_WATCHER_VERBOSE === '1';

let buildInProgress = false;
let pendingFrontend = false;
let pendingBackend = false;

function rebuild(type) {
  if (buildInProgress) {
    if (type === 'frontend') pendingFrontend = true;
    if (type === 'backend') pendingBackend = true;
    return;
  }

  buildInProgress = true;
  const startTime = Date.now();

  if (type === 'frontend') {
    console.log('\n🔄 Frontend changed - rebuilding...');
    const proc = spawn('npm', ['run', 'build'], {
      cwd: path.join(ROOT, 'frontend'),
      shell: true,
      stdio: 'pipe'
    });

    // Buffer instead of streaming: a passing build's output is pure noise in the PM2 log, but a
    // FAILING build's output is exactly what you need, so keep it and print it on failure.
    let output = '';
    proc.stdout.on('data', (d) => { output += d; if (VERBOSE) process.stdout.write(d); });
    proc.stderr.on('data', (d) => { output += d; if (VERBOSE) process.stderr.write(d); });

    proc.on('close', (code) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`✅ Frontend rebuilt in ${elapsed}s - refresh browser to see changes`);
      } else {
        console.log(`❌ Frontend build failed (${elapsed}s)`);
        if (!VERBOSE) process.stderr.write(output);
      }
      buildInProgress = false;
      checkPending();
    });
  } else if (type === 'backend') {
    console.log('\n🔄 Backend changed - rebuilding...');
    const proc = spawn('npm', ['run', 'build'], {
      cwd: path.join(ROOT, 'backend'),
      shell: true,
      stdio: 'pipe'
    });

    let output = '';
    proc.stdout.on('data', (d) => { output += d; if (VERBOSE) process.stdout.write(d); });
    proc.stderr.on('data', (d) => { output += d; if (VERBOSE) process.stderr.write(d); });

    proc.on('close', (code) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (code !== 0) {
        console.log(`❌ Backend build failed (${elapsed}s) - API left running on the previous build`);
        if (!VERBOSE) process.stderr.write(output);
        buildInProgress = false;
        checkPending();
        return;
      }

      console.log(`✅ Backend rebuilt in ${elapsed}s - restarting (safe sequence)...`);
      // NEVER `pm2 restart` here - it races PM2's Windows kill and orphans the old fork, which
      // then holds port 5000 while the tracked copy crash-loops on EADDRINUSE. Hold the build
      // lock until the restart finishes so a fast second save cannot overlap two restarts.
      const restart = spawn('node', [SAFE_RESTART, 'garment-erp-api:5000'], {
        shell: false, stdio: 'inherit'
      });
      restart.on('close', (rc) => {
        if (rc !== 0) console.log('⚠ safe restart reported a problem - check: pm2 logs garment-erp-api');
        buildInProgress = false;
        checkPending();
      });
    });
  }
}

function checkPending() {
  if (pendingFrontend) {
    pendingFrontend = false;
    rebuild('frontend');
  } else if (pendingBackend) {
    pendingBackend = false;
    rebuild('backend');
  }
}

// Debounce to avoid multiple rapid rebuilds
let frontendTimer = null;
let backendTimer = null;

function watchDir(dir, type) {
  fs.watch(dir, { recursive: true }, (event, filename) => {
    if (!filename || !/\.(ts|tsx|js|jsx|css|json)$/.test(filename)) return;

    if (type === 'frontend') {
      clearTimeout(frontendTimer);
      frontendTimer = setTimeout(() => rebuild('frontend'), 300);
    } else {
      clearTimeout(backendTimer);
      backendTimer = setTimeout(() => rebuild('backend'), 300);
    }
  });
}

console.log('👀 Watching for file changes...');
console.log(`   Frontend: ${FRONTEND}`);
console.log(`   Backend: ${BACKEND}`);
console.log('   Save a file to trigger auto-rebuild\n');

watchDir(FRONTEND, 'frontend');
watchDir(BACKEND, 'backend');
