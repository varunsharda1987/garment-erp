import ExcelJS from 'exceljs';
import exportService, { type ExportColumn } from '../../services/export.service';
import importService from '../../services/import.service';
import { formatDate } from '../../utils/date';

/**
 * Round-trip guard on the export/import date path.
 *
 * Exports are the one phase of the date standardisation that can CORRUPT DATA rather than
 * just look wrong: `new Date("05/03/2026")` silently reads as May 3rd, so a 5-March row
 * exported and re-imported used to come back as 3 May with nothing to see.
 *
 * Two separate contracts are asserted here, and they are deliberately different:
 *   - XLSX carries a REAL date cell (numFmt dd-mmm-yyyy) so it sorts chronologically.
 *     A pre-formatted string would display correctly and sort alphabetically — Apr before Jan.
 *   - CSV is text, so it carries `19-Sep-2026`, which re-parses unambiguously because
 *     `Sep` has no MM/DD reading.
 */
describe('export/import date round-trip', () => {
  const columns: ExportColumn[] = [
    { fieldName: 'orderNumber', displayName: 'Order Number', width: 20 },
    { fieldName: 'orderDate', displayName: 'Order Date', width: 15, format: 'date' },
    { fieldName: 'amount', displayName: 'Amount', width: 15, format: 'currency' },
  ];
  // 19-Sep-2026 in IST (20:00Z on the 18th is 01:30 IST on the 19th)
  const orderDate = new Date('2026-09-18T20:00:00Z');
  const data = [{ orderNumber: 'ORD-1', orderDate, amount: 1234.5 }];

  describe('XLSX', () => {
    let sheet: ExcelJS.Worksheet;

    beforeAll(async () => {
      const buffer = await exportService.exportToExcel({ columns, data, filename: 'test.xlsx' });
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
      sheet = wb.worksheets[0];
    });

    /** The data row — the sheet may carry a title row above the header. */
    const dateCell = (s: ExcelJS.Worksheet) => {
      let found: ExcelJS.Cell | null = null;
      s.eachRow((row) => {
        row.eachCell((cell) => {
          if (cell.value instanceof Date) found = cell;
        });
      });
      return found as ExcelJS.Cell | null;
    };

    it('writes a REAL date cell, not a string', () => {
      const cell = dateCell(sheet);
      expect(cell).not.toBeNull();
      expect(cell!.value).toBeInstanceOf(Date);
    });

    it('stamps dd-mmm-yyyy on that cell so it displays as 19-Sep-2026', () => {
      expect(dateCell(sheet)!.numFmt).toBe('dd-mmm-yyyy');
    });

    it('does not let the Date pin the column to the 50-char cap', () => {
      // A Date stringifies to ~45 chars ("Sat Sep 19 2026 00:00:00 GMT+0530 ..."), which
      // would blow the column out even though it RENDERS as 11 characters.
      const col = sheet.getColumn(2);
      expect(col.width).toBeLessThan(20);
    });
  });

  describe('CSV', () => {
    let csv: string;

    beforeAll(async () => {
      csv = await exportService.exportToCSV({ columns, data, filename: 'test.csv' });
    });

    it('emits the one format', () => {
      expect(csv).toContain('19-Sep-2026');
    });

    it('never emits a raw ISO timestamp or a locale-dependent numeric date', () => {
      expect(csv).not.toContain('2026-09-18T20:00:00');
      expect(csv).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    it('still honours the other column formats', () => {
      expect(csv).toContain('₹1234.50');
    });
  });

  describe('the two formatter contracts', () => {
    // Exercised through a cast because these are the private seam between the
    // three export paths — and getting them the wrong way round is silent:
    // a raw Date reaching a TEXT path prints 45 characters of
    // "Sat Sep 19 2026 00:00:00 GMT+0530 (India Standard Time)".
    const svc = exportService as unknown as {
      formatValue(v: unknown, f?: string): unknown;
      formatValueForCsv(v: unknown, f?: string): unknown;
    };

    it('formatValue hands a Date through untouched — the EXCEL cell', () => {
      expect(svc.formatValue(orderDate, 'date')).toBeInstanceOf(Date);
    });

    it('formatValueForCsv renders text — used by CSV *and* the PDF table', () => {
      expect(svc.formatValueForCsv(orderDate, 'date')).toBe('19-Sep-2026');
    });

    it('formatValueForCsv catches a Date even when the column declares no format', () => {
      expect(svc.formatValueForCsv(orderDate)).toBe('19-Sep-2026');
    });

    it('neither formatter mangles money', () => {
      expect(svc.formatValue(1234.5, 'currency')).toBe('₹1234.50');
      expect(svc.formatValueForCsv(1234.5, 'currency')).toBe('₹1234.50');
    });
  });

  describe('PDF', () => {
    it('renders the date as text, not as a 45-character Date.toString()', async () => {
      const buffer = await exportService.exportToPDF({ columns, data, filename: 'test.pdf' });
      expect(buffer.length).toBeGreaterThan(0);
      // PDFKit compresses its content streams, so assert the contract at the seam the
      // PDF table actually uses rather than grepping the bytes.
      const svc = exportService as unknown as { formatValueForCsv(v: unknown, f?: string): unknown };
      expect(svc.formatValueForCsv(orderDate, 'date')).not.toContain('GMT');
    });
  });

  describe('re-import', () => {
    const asFile = (text: string) =>
      ({
        buffer: Buffer.from(text, 'utf8'),
        size: Buffer.byteLength(text),
        originalname: 'round-trip.csv',
      }) as unknown as Express.Multer.File;

    const importColumns = [
      { fieldName: 'orderNumber', displayName: 'Order Number', required: true },
      { fieldName: 'orderDate', displayName: 'Order Date', type: 'date' as const },
    ];

    it('round-trips an exported date back to the same day', async () => {
      const csv = await exportService.exportToCSV({ columns, data, filename: 'x.csv' });
      const result = await importService.importFromCSV({ columns: importColumns, file: asFile(csv) });

      expect(result.invalidRows).toBe(0);
      const back = result.data![0].orderDate as Date;
      expect(back).toBeInstanceOf(Date);
      expect(formatDate(back)).toBe('19-Sep-2026');
      expect(formatDate(back)).toBe(formatDate(orderDate));
    });

    it('reads DD/MM/YYYY day-first — the silent-corruption case', async () => {
      // `new Date("05/03/2026")` is May 3rd. Day-first, this is 5 March.
      const csv = 'Order Number,Order Date\nORD-2,05/03/2026';
      const result = await importService.importFromCSV({ columns: importColumns, file: asFile(csv) });

      expect(formatDate(result.data![0].orderDate as Date)).toBe('05-Mar-2026');
    });

    it('still accepts an ISO date, which must not be read day-first', async () => {
      const csv = 'Order Number,Order Date\nORD-3,2026-09-19';
      const result = await importService.importFromCSV({ columns: importColumns, file: asFile(csv) });

      expect(formatDate(result.data![0].orderDate as Date)).toBe('19-Sep-2026');
    });

    it('rejects an impossible day rather than rolling it into the next month', async () => {
      const csv = 'Order Number,Order Date\nORD-4,31/02/2026';
      const result = await importService.importFromCSV({ columns: importColumns, file: asFile(csv) });

      // parseDMY refuses 31 February, so the row never becomes 3 March by accident —
      // it surfaces to the user as a rejected row instead.
      expect(result.success).toBe(false);
      expect(result.invalidRows).toBeGreaterThan(0);
      expect(result.data ?? []).toHaveLength(0);
    });
  });
});
