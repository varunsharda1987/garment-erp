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

    proc.stdout.on('data', (d) => process.stdout.write(d));
    proc.stderr.on('data', (d) => process.stderr.write(d));

    proc.on('close', (code) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`✅ Frontend rebuilt in ${elapsed}s - refresh browser to see changes`);
      } else {
        console.log(`❌ Frontend build failed (${elapsed}s)`);
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

    proc.on('close', (code) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`✅ Backend rebuilt in ${elapsed}s - restarting...`);
        spawn('pm2', ['restart', 'garment-erp-api', '--silent'], { shell: true, stdio: 'inherit' });
      } else {
        console.log(`❌ Backend build failed (${elapsed}s)`);
      }
      buildInProgress = false;
      checkPending();
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
