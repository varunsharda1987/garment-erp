/* eslint-disable no-console */
/**
 * Creates (or checks) the deployer's private build folder:  C:\Users\NEW\garment-erp-build
 *
 *   node scripts/ship/setup-build-tree.js
 *
 * It is a detached `git worktree` of this repo. The deployer checks out the exact commit it is
 * shipping there and builds it, so uncommitted edits in the shared working folder can never reach
 * the live app.
 *
 * node_modules are JUNCTIONS into the main folder (not copies): the live app runs with the main
 * folder's packages, so the build compiles against exactly those. Consequence, and the reason for
 * README.txt in the folder: never delete this folder recursively — a recursive delete follows a
 * junction and would empty the main folder's node_modules. Remove the junctions first
 * (`(Get-Item <path> -Force).Delete()` in PowerShell), then `git worktree remove --force <path>`.
 */
const fs = require('fs');
const path = require('path');
const S = require('./state');

const JUNCTIONS = ['backend/node_modules', 'frontend/node_modules'];

const README = `THIS FOLDER IS THE GARMENT-ERP DEPLOYER'S BUILD FOLDER - do not edit or delete it by hand.

The deployer (PM2 app garment-erp-deployer, code in ${S.REPO}\\scripts\\ship\\) checks out the
commit it is shipping here, builds it, and copies the result into the live app.

backend\\node_modules and frontend\\node_modules are JUNCTIONS into ${S.REPO}.
A recursive delete of this folder would follow them and EMPTY the main folder's node_modules.
To remove it: delete the two junctions first -
  (Get-Item '${S.BUILD_DIR}\\backend\\node_modules' -Force).Delete()
  (Get-Item '${S.BUILD_DIR}\\frontend\\node_modules' -Force).Delete()
then:  git -C ${S.REPO} worktree remove --force ${S.BUILD_DIR}
`;

function isJunctionTo(link, target) {
  try {
    if (!fs.lstatSync(link).isSymbolicLink()) return false;
    return path.resolve(fs.readlinkSync(link)).toLowerCase() === path.resolve(target).toLowerCase();
  } catch {
    return false;
  }
}

/** Copy the gitignored env files the builds need (vite bakes VITE_* in; prisma reads DATABASE_URL). */
function copyEnvFiles() {
  const copied = [];
  for (const side of ['backend', 'frontend']) {
    const srcDir = path.join(S.REPO, side);
    for (const name of fs.readdirSync(srcDir)) {
      if (!/^\.env(\..+)?$/.test(name) || /example|sample|backup|\.bak$/i.test(name)) continue;
      const src = path.join(srcDir, name);
      if (!fs.statSync(src).isFile()) continue;
      fs.copyFileSync(src, path.join(S.BUILD_DIR, side, name));
      copied.push(`${side}/${name}`);
    }
  }
  return copied;
}

function ensureBuildTree(log = console.log) {
  const gitFile = path.join(S.BUILD_DIR, '.git');
  if (!fs.existsSync(gitFile)) {
    if (fs.existsSync(S.BUILD_DIR) && fs.readdirSync(S.BUILD_DIR).length > 0) {
      throw new Error(`${S.BUILD_DIR} exists but is not a git worktree - move it aside by hand`);
    }
    log(`creating build folder ${S.BUILD_DIR} (git worktree, detached at main)`);
    S.git(['worktree', 'add', '--detach', S.BUILD_DIR, 'refs/heads/main']);
  }

  for (const rel of JUNCTIONS) {
    const link = path.join(S.BUILD_DIR, rel);
    const target = path.join(S.REPO, rel);
    if (isJunctionTo(link, target)) continue;
    if (fs.existsSync(link)) {
      // A real folder here would mean the build uses different packages from the live app.
      // Never delete it automatically - it could be anything.
      throw new Error(`${link} exists but is not a junction to ${target} - fix by hand`);
    }
    fs.symlinkSync(target, link, 'junction');
    log(`junction ${rel} -> ${target}`);
  }

  fs.writeFileSync(path.join(S.BUILD_DIR, 'README-DEPLOYER.txt'), README);
  return S.BUILD_DIR;
}

module.exports = { ensureBuildTree, copyEnvFiles, isJunctionTo };

if (require.main === module) {
  try {
    ensureBuildTree();
    const env = copyEnvFiles();
    console.log(`build folder ready: ${S.BUILD_DIR}`);
    console.log(`env files copied: ${env.join(', ') || '(none)'}`);
  } catch (e) {
    console.error(`setup failed: ${e.message}`);
    process.exit(1);
  }
}
