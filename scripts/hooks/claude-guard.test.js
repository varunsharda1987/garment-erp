/**
 * Tests for claude-guard.js — run:  node --test scripts/hooks/claude-guard.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { analyze } = require('./claude-guard');

const MAIN = path.resolve(__dirname, '..', '..');
const BACKEND = path.join(MAIN, 'backend');
const FRONTEND = path.join(MAIN, 'frontend');
const ELSEWHERE = 'C:\\Users\\NEW\\AppData\\Local\\Temp\\wt';

const ctx = (paused = false, claimed = []) => ({
  paused: () => paused,
  claimsRule: (paths) => (paths.some((p) => claimed.includes(p)) ? 'claimed by another terminal' : null),
});

const blocked = (cmd, cwd = MAIN, c = ctx()) => analyze(cmd, cwd, c).length > 0;

test('git commands that take or wipe other terminals\' work are blocked', () => {
  for (const cmd of [
    'git add -A',
    'git add .',
    'git add --all',
    'git add -u',
    'git add -Av',
    'git commit -am "fix"',
    'git commit -a -m "fix"',
    'git commit --all -m x',
    'git commit --amend --no-edit',
    'git stash',
    'git stash push -m wip',
    'git stash pop',
    'git reset --hard',
    'git reset --hard HEAD~1',
    'git reset',
    'git reset HEAD',
    'git reset --soft HEAD~1',
    'git checkout .',
    'git checkout -- .',
    'git checkout -b feature/x',
    'git checkout some-branch-that-is-not-a-file',
    'git restore .',
    'git clean -fd',
    'git switch main',
    'git rebase main',
    'git merge feature',
    'git pull',
    'cd backend && git stash',
    'git status; git stash',
    'git -C C:/Users/NEW/garment-erp stash',
  ]) {
    assert.ok(blocked(cmd), `should block: ${cmd}`);
  }
});

test('ordinary git commands are allowed', () => {
  for (const cmd of [
    'git status --short',
    'git diff --cached --stat',
    'git log --oneline -5',
    'git add backend/src/app.ts frontend/src/App.tsx',
    'git commit -m "fix: git add . was a bug" -- backend/src/app.ts',
    'git commit -m "feat: x" --allow-empty',
    'git commit -F msg.txt -- package.json',
    'git reset -- backend/src/app.ts',
    'git reset HEAD package.json',
    'git restore --staged package.json',
    'git stash list',
    'git clean -n',
    'git pull --ff-only',
    'git push',
    'git worktree add --detach C:/tmp/wt HEAD',
    'git checkout -- package.json',
  ]) {
    assert.ok(!blocked(cmd), `should allow: ${cmd}`);
  }
});

test('commit messages and heredoc bodies never trigger the guard', () => {
  assert.ok(!blocked("git commit -m 'git stash && git reset --hard' -- a.ts"));
  assert.ok(!blocked('git commit -F - <<\'EOF\'\nfix: stop using git add -A\ngit stash\nEOF\n'));
  assert.ok(!blocked('git commit -m "$(cat <<\'EOF\'\nfix: git reset --hard is gone\n\nCo-Authored-By: x\nEOF\n)" -- a.ts'));
  assert.ok(!blocked("git commit -m @'\ngit add .\n'@ -- a.ts"));
});

test('restoring a file another terminal edited is blocked; your own is not', () => {
  const c = ctx(false, ['package.json']);
  assert.ok(blocked('git checkout -- package.json', MAIN, c));
  assert.ok(blocked('git restore package.json', MAIN, c));
  assert.ok(!blocked('git restore --staged package.json', MAIN, c));
  assert.ok(!blocked('git checkout -- CLAUDE.md', MAIN, c));
});

test('outside the main checkout nothing git-related is checked', () => {
  assert.ok(!blocked('git stash', ELSEWHERE));
  assert.ok(!blocked('git reset --hard', path.join(MAIN, '.claude', 'worktrees', 'x')));
  assert.ok(!blocked('cd C:/Users/NEW/AppData/Local/Temp/wt && git stash'));
  assert.ok(!blocked('git -C C:/Users/NEW/AppData/Local/Temp/wt reset --hard'));
});

test('building into the live dist is blocked; type-checking is not', () => {
  for (const [cmd, cwd] of [
    ['npm run build', BACKEND],
    ['npm run build', FRONTEND],
    ['cd backend && npm run build', MAIN],
    ['npm --prefix backend run build', MAIN],
    ['npx tsc', BACKEND],
    ['npx tsc -p tsconfig.json', BACKEND],
    ['node --max-old-space-size=16384 ./node_modules/typescript/bin/tsc', BACKEND],
    ['npx vite build', FRONTEND],
    ['Set-Location backend; npm run build', MAIN],
  ]) {
    assert.ok(blocked(cmd, cwd), `should block: ${cmd} (in ${cwd})`);
  }
  for (const [cmd, cwd] of [
    ['npm run type-check', BACKEND],
    ['npx tsc --noEmit', BACKEND],
    ['npx tsc -b', FRONTEND],
    ['npx tsc --noEmit -p tsconfig.app.json', FRONTEND],
    ['npm test -- src/__tests__/unit/date.test.ts', BACKEND],
    ['npm run build -- --outDir C:/tmp/preview', FRONTEND],
    ['npx vite', FRONTEND],
    ['npm run build', ELSEWHERE],
    ['npm run ship:wait', MAIN],
    ['npm run lint', FRONTEND],
  ]) {
    assert.ok(!blocked(cmd, cwd), `should allow: ${cmd} (in ${cwd})`);
  }
});

test('a second API in this folder is blocked (port 5000 reclaim kills the live one)', () => {
  assert.ok(blocked('npm run dev', BACKEND));
  assert.ok(blocked('npm start', BACKEND));
  assert.ok(blocked('node dist/server.js', BACKEND));
  assert.ok(blocked('npx nodemon', BACKEND));
  assert.ok(!blocked('npm run dev', FRONTEND));
});

test('pm2 on the live apps', () => {
  assert.ok(blocked('pm2 restart garment-erp-api'));
  assert.ok(blocked('pm2 reload garment-erp-web'));
  assert.ok(blocked('pm2 delete garment-erp-api'));
  assert.ok(blocked('pm2 stop garment-erp-api'), 'stop needs deploys paused');
  assert.ok(!blocked('pm2 stop garment-erp-api', MAIN, ctx(true)), 'stop allowed while paused');
  assert.ok(!blocked('pm2 start garment-erp-api', MAIN, ctx(true)));
  assert.ok(blocked('pm2 restart garment-erp-api', MAIN, ctx(true)), 'restart never');
  assert.ok(!blocked('pm2 logs garment-erp-api --lines 50'));
  assert.ok(!blocked('pm2 describe garment-erp-api'));
  assert.ok(!blocked('pm2 restart garment-erp-deployer'));
  assert.ok(!blocked('pm2 restart kasya-b2b-api'), 'other businesses are not this guard\'s concern');
  assert.ok(blocked('& pm2 restart garment-erp-api'), 'PowerShell call operator');
  assert.ok(blocked('pm2 restart garment-erp-api', ELSEWHERE), 'pm2 is global — any folder');
});

test('the owner-approved escape hatch', () => {
  assert.ok(!blocked('CLAUDE_GUARD_OK=1 git stash'));
  assert.ok(!blocked('$env:CLAUDE_GUARD_OK=1; git stash'));
});
