/**
 * Every list search that can find a style must also find it by the BUYER's code for that style.
 *
 * Buyers quote their own style number, not ours — it is the handle the factory is given on the
 * phone and on paperwork. Owner's rule, 2026-09-12: "All the searches should be possible with
 * buyer reference number". Searches were drifting into covering `styleCode` while quietly omitting
 * `buyerStyleRef`, which reads as "search is broken" to whoever is holding the buyer's PO.
 *
 * This scans the source rather than the running queries, so it also catches a search added to a
 * module nobody thought to write an integration test for.
 */

import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', '..');
const SCAN_DIRS = [path.join(SRC, 'services'), path.join(SRC, 'controllers')];

/** Where a search field list starts. */
const BLOCK_STARTS = [/applySearch\s*\(/g, /searchFields\s*(?::[^=]+)?=\s*\[/g, /where\.OR\s*=\s*\[/g];

/** Slice from `openIdx` to the matching close of whichever bracket opens first. */
function balancedSlice(source: string, openIdx: number): string {
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') {
      depth--;
      if (depth === 0) return source.slice(openIdx, i + 1);
    }
  }
  return source.slice(openIdx);
}

interface Offender {
  file: string;
  line: number;
  snippet: string;
}

function findSearchBlocksMissingBuyerRef(file: string): Offender[] {
  const source = fs.readFileSync(file, 'utf8');
  const offenders: Offender[] = [];

  for (const pattern of BLOCK_STARTS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source))) {
      // Step back to the bracket the match ends on, so the slice is balanced from there.
      const openIdx = source.lastIndexOf(match[0].trim().endsWith('[') ? '[' : '(', pattern.lastIndex);
      const block = balancedSlice(source, openIdx);

      if (!block.includes('styleCode') || block.includes('buyerStyleRef')) continue;

      offenders.push({
        file: path.relative(SRC, file).replace(/\\/g, '/'),
        line: source.slice(0, openIdx).split('\n').length,
        snippet: block.slice(0, 220).replace(/\s+/g, ' '),
      });
    }
  }

  return offenders;
}

describe('a search that finds a style must also find it by the buyer’s code', () => {
  const files = SCAN_DIRS.flatMap((dir) =>
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.service.ts') || f.endsWith('.controller.ts'))
      .map((f) => path.join(dir, f))
  );

  it('scans a meaningful number of files (guards against the glob silently breaking)', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('finds no search block mentioning styleCode without buyerStyleRef', () => {
    const offenders = files.flatMap(findSearchBlocksMissingBuyerRef);

    // Asserted as text so a failure prints the offending file, line and snippet rather than an
    // object diff — the point is to show exactly where to add the missing path.
    const report = offenders.length
      ? `Searches that find a style by OUR code but not the BUYER's — add the matching ` +
        `'…buyerStyleRef' path beside the styleCode one:` +
        offenders.map((o) => `\n  ${o.file}:${o.line}\n    ${o.snippet}`).join('')
      : '';

    expect(report).toBe('');
  });
});
