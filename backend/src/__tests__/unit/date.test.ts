import {
  EM_DASH,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatDateTime24,
  formatTime,
  parseDMY,
  toDateInputValue,
} from '../../utils/date';

/**
 * Guards on the project's only date format.
 *
 * Before this file there was NO test anywhere in the repo asserting a formatted date string, which
 * is how `document-data/format.ts` came to print "19 Sept 2026" on every PDF while the frontend
 * printed "19 Sep 2026" for the same record. Nobody chose that; ICU version skew did.
 *
 * The two tests that matter most are the "Sept" guard and the IST rollover guard — they are the
 * ones that fail if someone reintroduces `month: 'short'` or drops the pinned timezone.
 */
describe('date utility', () => {
  describe('formatDate', () => {
    it('formats as DD-Mon-YYYY', () => {
      expect(formatDate('2026-09-19T12:00:00Z')).toBe('19-Sep-2026');
    });

    it('never emits "Sept" — the ICU trap this helper exists to prevent', () => {
      // Node's own toLocaleDateString('en-IN', {month:'short'}) returns "Sept" here while Chrome
      // returns "Sep". Our month table means the runtime cannot influence this.
      expect(formatDate('2026-09-19T12:00:00Z')).toContain('Sep-');
      expect(formatDate('2026-09-19T12:00:00Z')).not.toContain('Sept');
    });

    it('renders in IST, so a late-evening UTC instant does not roll back a day', () => {
      // 20:00Z on the 19th is 01:30 IST on the 20th.
      expect(formatDate('2026-09-19T20:00:00Z')).toBe('20-Sep-2026');
    });

    it('keeps a date-only value on its own day (UTC midnight must not roll back)', () => {
      expect(formatDate('2026-03-15T00:00:00Z')).toBe('15-Mar-2026');
    });

    it('zero-pads the day', () => {
      expect(formatDate('2026-09-03T12:00:00Z')).toBe('03-Sep-2026');
    });

    it('accepts a Date, an ISO string and epoch millis alike', () => {
      const iso = '2026-01-05T12:00:00Z';
      expect(formatDate(new Date(iso))).toBe('05-Jan-2026');
      expect(formatDate(iso)).toBe('05-Jan-2026');
      expect(formatDate(new Date(iso).getTime())).toBe('05-Jan-2026');
    });

    it('covers every month name', () => {
      const names = Array.from(
        { length: 12 },
        (_, i) => formatDate(`2026-${String(i + 1).padStart(2, '0')}-15T12:00:00Z`).split('-')[1]
      );
      expect(names).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
    });
  });

  describe('missing values', () => {
    it('falls back to the em-dash for null, undefined, empty and unparseable input', () => {
      expect(formatDate(null)).toBe(EM_DASH);
      expect(formatDate(undefined)).toBe(EM_DASH);
      expect(formatDate('')).toBe(EM_DASH);
      expect(formatDate('garbage')).toBe(EM_DASH);
      expect(formatDate(NaN)).toBe(EM_DASH);
    });

    it('treats 0 as a real instant, not a missing value', () => {
      // Mirrors the repo's money rule: a real 0 is not nothing.
      expect(formatDate(0)).toBe('01-Jan-1970');
    });

    it('accepts a caller-supplied fallback for zero-visual-diff migration batches', () => {
      expect(formatDate(null, 'N/A')).toBe('N/A');
      expect(formatDateTime(null, '-')).toBe('-');
    });
  });

  describe('time formats', () => {
    it('formatTime renders lowercase 12-hour with a padded hour', () => {
      // 08:35Z -> 14:05 IST
      expect(formatTime('2026-09-19T08:35:00Z')).toBe('02:05 pm');
    });

    it('formatDateTime is the screen format', () => {
      expect(formatDateTime('2026-09-19T08:35:00Z')).toBe('19-Sep-2026 02:05 pm');
    });

    it('formatDateTime24 is the document format', () => {
      expect(formatDateTime24('2026-09-19T08:35:00Z')).toBe('19-Sep-2026 14:05');
    });

    it('renders midnight as 00:00, never 24:00', () => {
      // 18:30Z on the 18th is exactly 00:00 IST on the 19th.
      expect(formatDateTime24('2026-09-18T18:30:00Z')).toBe('19-Sep-2026 00:00');
    });

    it('renders noon and midnight correctly in 12-hour form', () => {
      expect(formatTime('2026-09-18T18:30:00Z')).toBe('12:00 am');
      expect(formatTime('2026-09-19T06:30:00Z')).toBe('12:00 pm');
    });
  });

  describe('formatDateRange', () => {
    it('joins two distinct days with an en dash', () => {
      expect(formatDateRange('2026-09-19T12:00:00Z', '2026-09-25T12:00:00Z')).toBe('19-Sep-2026 – 25-Sep-2026');
    });

    it('collapses to a single date when both ends are the same day', () => {
      expect(formatDateRange('2026-09-19T06:00:00Z', '2026-09-19T12:00:00Z')).toBe('19-Sep-2026');
    });

    it('formats whichever end exists when one is open', () => {
      expect(formatDateRange('2026-09-19T12:00:00Z', null)).toBe('19-Sep-2026');
      expect(formatDateRange(null, '2026-09-25T12:00:00Z')).toBe('25-Sep-2026');
    });

    it('falls back when both ends are missing', () => {
      expect(formatDateRange(null, null)).toBe(EM_DASH);
    });
  });

  describe('toDateInputValue', () => {
    it('produces an ISO date string in IST, not UTC', () => {
      expect(toDateInputValue('2026-09-19T12:00:00Z')).toBe('2026-09-19');
    });

    it('reports today, not yesterday, for an instant before 05:30 IST', () => {
      // This is the bug in the 72 `.toISOString().split('T')[0]` sites: 00:30Z on the 20th is
      // 06:00 IST on the 20th, but .toISOString() would also say the 20th — whereas 20:00Z on
      // the 19th is already the 20th in IST and .toISOString() would wrongly say the 19th.
      expect(toDateInputValue('2026-09-19T20:00:00Z')).toBe('2026-09-20');
      expect(new Date('2026-09-19T20:00:00Z').toISOString().split('T')[0]).toBe('2026-09-19');
    });

    it('returns an empty string for missing input, so it can seed a form field', () => {
      expect(toDateInputValue(null)).toBe('');
      expect(toDateInputValue('garbage')).toBe('');
    });

    it('round-trips through formatDate', () => {
      expect(formatDate(toDateInputValue('2026-09-19T12:00:00Z'))).toBe('19-Sep-2026');
    });
  });

  describe('parseDMY', () => {
    it('parses the format we emit', () => {
      const d = parseDMY('19-Sep-2026');
      expect(d).not.toBeNull();
      expect(formatDate(d)).toBe('19-Sep-2026');
    });

    it('parses numeric DD/MM/YYYY day-first — never as MM/DD', () => {
      // `new Date("05/03/2026")` silently reads this as May 3rd. That is the silent
      // export -> re-import corruption path this function exists to close.
      const d = parseDMY('05/03/2026');
      expect(formatDate(d)).toBe('05-Mar-2026');
    });

    it('accepts dash and slash separators and full month names', () => {
      expect(formatDate(parseDMY('19/09/2026'))).toBe('19-Sep-2026');
      expect(formatDate(parseDMY('19-09-2026'))).toBe('19-Sep-2026');
      expect(formatDate(parseDMY('19-September-2026'))).toBe('19-Sep-2026');
    });

    it('rejects impossible days rather than rolling them over', () => {
      expect(parseDMY('31/02/2026')).toBeNull();
      expect(parseDMY('32/01/2026')).toBeNull();
      expect(parseDMY('19/13/2026')).toBeNull();
    });

    it('rejects junk, two-digit years and missing input', () => {
      expect(parseDMY('garbage')).toBeNull();
      expect(parseDMY('19-Sep-26')).toBeNull();
      expect(parseDMY('')).toBeNull();
      expect(parseDMY(null)).toBeNull();
      expect(parseDMY(undefined)).toBeNull();
    });
  });
});
