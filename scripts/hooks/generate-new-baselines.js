/**
 * One-shot: generate baselines for the Phase-3 guardrail detectors (controller-reparse,
 * global-prisma-in-tx, decimal-compare, count-numbering) and regenerate the hardened enum-drift
 * baseline. Existing violations are grandfathered; only NEW ones will block. Re-run after any large
 * intentional change (see ratchet.js writeBaseline).
 */
const fs = require('fs');
const path = require('path');
const det = require('./drift-detectors.js');
const { writeBaseline } = require('./ratchet.js');

const REPO = path.resolve(__dirname, '..', '..');

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!/node_modules|dist|\.git/.test(e.name)) walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.ts$/.test(e.name)) {
      acc.push(path.relative(REPO, p).split(path.sep).join('/'));
    }
  }
  return acc;
}

const files = [...walk(path.join(REPO, 'backend', 'src'), []), ...walk(path.join(REPO, 'frontend', 'src'), [])];
console.log('files scanned:', files.length);

for (const [name, fn, baseline] of [
  ['controllerReparse', det.controllerReparse, 'controller-reparse-baseline.json'],
  ['globalPrismaInTx', det.globalPrismaInTx, 'global-prisma-tx-baseline.json'],
  ['decimalCompare', det.decimalCompare, 'decimal-compare-baseline.json'],
  ['countNumbering', det.countNumbering, 'count-numbering-baseline.json'],
]) {
  const v = fn(files);
  const n = writeBaseline(baseline, v.map((x) => x.key));
  console.log(`${name}: ${v.length} existing violations -> baselined ${n} keys`);
}

const enumV = det.enumDrift(files.filter((f) => f.endsWith('.schema.ts')));
console.log('enumDrift (hardened): ' + enumV.length + ' -> baselined ' + writeBaseline('enum-drift-baseline.json', enumV.map((x) => x.key)));
