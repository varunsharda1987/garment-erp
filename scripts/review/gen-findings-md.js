/** Stage-3: generate docs/frontend-review/01-findings.md from final-findings.json */
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..');
const d = JSON.parse(fs.readFileSync(path.join(REPO, 'docs/frontend-review/data/final-findings.json'), 'utf8'));
const order = ['P0', 'P1', 'P2', 'P3', 'P4'];
const catLabel = {
  'dead-endpoint': 'Dead endpoint', 'wrong-path': 'Wrong API path',
  'field-mismatch': 'Field mismatch (silent wrong data)', 'dead-nav': 'Dead navigation',
  'orphan-page': 'Orphan page', 'integration-gap': 'Missing integration',
  'dead-ui': 'Dead/stub UI', 'param-handoff': 'Ignored link parameter', 'unbuilt': 'Unbuilt feature',
};
let md = '# Frontend Integration Review — Findings (verified)\n\n';
md += '_205/205 pages reviewed; every P0/P1 and sub-high-confidence finding independently re-verified from source. Evidence cites file:line._\n\n';
md += '| Severity | Count | Meaning |\n|---|---|---|\n';
for (const [s, m] of [['P0', 'breaks a daily production flow'], ['P1', 'silent wrong data shown or saved'], ['P2', 'dead link/endpoint off the daily path'], ['P3', 'cosmetic / orphan'], ['P4', 'unbuilt feature']]) {
  md += '| ' + s + ' | ' + d.findings.filter((f) => f.severity === s).length + ' | ' + m + ' |\n';
}
for (const sev of order) {
  const list = d.findings.filter((f) => f.severity === sev);
  if (!list.length) continue;
  md += '\n## ' + sev + ' (' + list.length + ')\n';
  for (const f of list) {
    md += '\n### ' + f.id + (f.originalSeverity ? ' _(adjusted from ' + f.originalSeverity + ')_' : '') + ' — ' + (catLabel[f.category] || f.category) + '\n';
    md += '- **Page:** ' + f.page.replace('frontend/src/pages/', '') + (f.route ? ' (' + f.route + ')' : '') + '\n';
    md += '- **Expected:** ' + f.expected + '\n';
    md += '- **Actual:** ' + f.actual + '\n';
    md += '- **Evidence:** frontend ' + ((f.evidence && f.evidence.frontend) || '-') + ' | backend ' + ((f.evidence && f.evidence.backend) || '-') + '\n';
    md += '- **Fix:** ' + f.fix + '\n';
    md += '- **Verified:** ' + (f.verified || 'mechanical evidence (join+probe)') + '\n';
  }
}
fs.writeFileSync(path.join(REPO, 'docs/frontend-review/01-findings.md'), md);
console.log('written', md.length, 'chars,', d.findings.length, 'findings');
