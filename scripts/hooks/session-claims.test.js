/**
 * Tests for session-claims.js — run:  node --test scripts/hooks/session-claims.test.js
 *
 * The end-to-end case builds a throwaway git repo with session-claims.js as its real pre-commit
 * hook, so it proves the thing that matters: a pathspec commit (`git commit -- file`) is checked
 * against git's temporary index, and CLAUDE_CODE_SESSION_ID reaches the hook.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');
const { loadSessions, relPath, MAIN_ROOT } = require('./session-claims');

test('relPath keeps main-checkout files only', () => {
  assert.strictEqual(relPath(path.join(MAIN_ROOT, 'backend', 'src', 'app.ts')), 'backend/src/app.ts');
  assert.strictEqual(relPath(path.join(MAIN_ROOT, '.claude', 'worktrees', 'x', 'a.ts')), null);
  assert.strictEqual(relPath(path.join(MAIN_ROOT, 'frontend', 'node_modules', 'x', 'a.js')), null);
  assert.strictEqual(relPath(path.join(MAIN_ROOT, '.git', 'config')), null);
  assert.strictEqual(relPath('C:\\somewhere\\else.ts'), null);
});

test('loadSessions reads claims, releases and session end', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-'));
  fs.writeFileSync(path.join(dir, 'aaa.log'), '100\tbackend/a.ts\n200\tbackend/b.ts\n300\t#RELEASE\tbackend/a.ts\n400\t#END\n');
  const [s] = loadSessions(dir);
  assert.strictEqual(s.id, 'aaa');
  assert.ok(!s.files.has('backend/a.ts'), 'released');
  assert.strictEqual(s.files.get('backend/b.ts').ts, 200);
  assert.strictEqual(s.ended, true);
  assert.strictEqual(s.lastSeen, 400);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('pre-commit refuses a file another terminal edited, allows your own', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-repo-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf-8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  git('config', 'core.hooksPath', 'hooks');
  fs.mkdirSync(path.join(repo, 'scripts', 'hooks'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'session-claims.js'), path.join(repo, 'scripts', 'hooks', 'session-claims.js'));
  fs.mkdirSync(path.join(repo, 'hooks'));
  fs.writeFileSync(path.join(repo, 'hooks', 'pre-commit'), '#!/bin/sh\nnode scripts/hooks/session-claims.js check\n');
  fs.writeFileSync(path.join(repo, 'mine.txt'), 'v1\n');
  fs.writeFileSync(path.join(repo, 'theirs.txt'), 'v1\n');
  git('add', 'mine.txt', 'theirs.txt');
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: repo, env: { ...process.env, CLAUDE_CODE_SESSION_ID: '' } });

  // Both terminals edit after the first commit; terminal B also stages its file in the shared index.
  const later = Date.now() + 5000;
  fs.writeFileSync(path.join(repo, 'mine.txt'), 'v2\n');
  fs.writeFileSync(path.join(repo, 'theirs.txt'), 'v2\n');
  const claims = path.join(repo, '.git', 'claude-sessions');
  fs.mkdirSync(claims);
  fs.writeFileSync(path.join(claims, 'session-A.log'), `${later}\tmine.txt\n`);
  fs.writeFileSync(path.join(claims, 'session-B.log'), `${later}\ttheirs.txt\n`);
  git('add', 'theirs.txt');

  const commit = (env, ...args) => spawnSync('git', ['commit', '-q', ...args], {
    cwd: repo, encoding: 'utf-8', env: { ...process.env, ...env },
  });

  // A sweeps B's staged file in with a plain commit -> refused.
  let r = commit({ CLAUDE_CODE_SESSION_ID: 'session-A' }, '-m', 'sweep', '--', 'mine.txt', 'theirs.txt');
  assert.notStrictEqual(r.status, 0, 'committing theirs.txt as A must be refused');
  assert.match(r.stderr, /theirs\.txt/);

  // A commits only its own file by pathspec -> allowed, B's staged file stays staged for B.
  r = commit({ CLAUDE_CODE_SESSION_ID: 'session-A' }, '-m', 'mine', '--', 'mine.txt');
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(git('diff', '--cached', '--name-only'), /theirs\.txt/);

  // The override works when the owner agreed.
  r = commit({ CLAUDE_CODE_SESSION_ID: 'session-A', ALLOW_SHARED_COMMIT: '1' }, '-m', 'shared', '--', 'theirs.txt');
  assert.strictEqual(r.status, 0, r.stderr);

  fs.rmSync(repo, { recursive: true, force: true });
});
