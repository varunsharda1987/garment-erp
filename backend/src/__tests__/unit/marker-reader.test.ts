/**
 * The CAD marker reader (services/marker-reader.service.ts → backend/ocr/read_marker.py).
 * The real-read cases run only where backend/ocr/setup.ps1 has made the Python env.
 */
import fs from 'fs';
import path from 'path';
import { markerFilePath, normalizeReading, readMarkerFile } from '../../services/marker-reader.service';

const FIXTURES = path.join(__dirname, '../fixtures/markers');
const VENV_PYTHON = path.join(__dirname, '../../../ocr/.venv/Scripts/python.exe');
const readerInstalled = fs.existsSync(VENV_PYTHON);

describe('normalizeReading', () => {
  it('keeps well-formed values and adds up the pieces', () => {
    const r = normalizeReading({
      status: 'READ',
      lengthM: 3.59,
      widthIn: 52,
      efficiencyPct: 68.12,
      placed: 26,
      total: 26,
      sizes: [{ sizeName: 'l', quantity: 2 }],
      title: 'Nest EXPERT - GRAIN NEW - L(x2)*',
    });
    expect(r).toMatchObject({ status: 'READ', lengthM: 3.59, widthIn: 52, placed: 26, total: 26, pieces: 2 });
    expect(r.sizes).toEqual([{ sizeName: 'L', quantity: 2 }]);
    expect(r.sizesFrom).toBe('title');
  });

  it('says where the sizes came from: the piece table only when the reader says so, none without sizes', () => {
    const sizes = [{ sizeName: 'S', quantity: 1 }];
    expect(normalizeReading({ status: 'READ', sizes, sizesFrom: 'pieces' }).sizesFrom).toBe('pieces');
    expect(normalizeReading({ status: 'READ', sizes, sizesFrom: 'somewhere' }).sizesFrom).toBe('title');
    expect(normalizeReading({ status: 'PARTIAL', sizes: [], sizesFrom: 'pieces' }).sizesFrom).toBeNull();
  });

  it('never trusts what it cannot check', () => {
    const r = normalizeReading({ status: 'GREAT', lengthM: '8,29', sizes: [{ sizeName: 'S', quantity: 0 }, 'M'] });
    expect(r.status).toBe('UNREADABLE');
    expect(r.lengthM).toBeNull();
    expect(r.sizes).toEqual([]);
    expect(r.pieces).toBeNull();
  });
});

describe('markerFilePath', () => {
  it('resolves an uploaded CAD image inside the uploads folder', () => {
    expect(markerFilePath('/uploads/cad-files/cad-1.png')).toMatch(/uploads[\\/]cad-files[\\/]cad-1\.png$/);
  });

  it('refuses a path that climbs out of it', () => {
    expect(markerFilePath('/uploads/../src/app.ts')).toBeNull();
    expect(markerFilePath('/uploads/cad-files/../../.env')).toBeNull();
  });
});

describe('readMarkerFile', () => {
  const saved = process.env.MARKER_READER_DISABLED;
  afterEach(() => {
    if (saved === undefined) delete process.env.MARKER_READER_DISABLED;
    else process.env.MARKER_READER_DISABLED = saved;
  });

  it('answers READER_UNAVAILABLE, not an error, when the reader is off', async () => {
    process.env.MARKER_READER_DISABLED = '1';
    const r = await readMarkerFile(path.join(FIXTURES, 'roxie-l-x2.jpeg'));
    expect(r.status).toBe('READER_UNAVAILABLE');
    expect(r.error).toMatch(/switched off/);
  });

  (readerInstalled ? it : it.skip)(
    'reads a Nest EXPERT screenshot and a photo that is not one',
    async () => {
      delete process.env.MARKER_READER_DISABLED;
      const [marker, photo] = await Promise.all([
        readMarkerFile(path.join(FIXTURES, 'ip00138-pant-s-to-xxl.png')),
        readMarkerFile(path.join(FIXTURES, 'garment-photo-not-a-marker.jpeg')),
      ]);
      expect(marker).toMatchObject({ status: 'READ', lengthM: 8.29, widthIn: 52, efficiencyPct: 89.05, pieces: 5 });
      expect(marker.sizes.map((s) => s.sizeName)).toEqual(['S', 'M', 'L', 'XL', 'XXL']);
      expect(photo.status).toBe('UNREADABLE');
      expect(photo.lengthM).toBeNull();
    },
    120_000
  );

  // LNG129 (29-Sep): the screenshot begins below the title bar — the sizes come from the piece table
  (readerInstalled && fs.existsSync(path.join(FIXTURES, 'lng129-title-cut-off.png')) ? it : it.skip)(
    'reads the sizes from the piece table when the title bar is not in the screenshot',
    async () => {
      delete process.env.MARKER_READER_DISABLED;
      const r = await readMarkerFile(path.join(FIXTURES, 'lng129-title-cut-off.png'));
      expect(r).toMatchObject({ status: 'READ', lengthM: 11.05, widthIn: 52, placed: 60, total: 60, pieces: 5 });
      expect(r.sizes.map((s) => s.sizeName)).toEqual(['S', 'M', 'L', 'XL', 'XXL']);
      expect(r.sizesFrom).toBe('pieces');
      expect(r.title).toBeNull();
    },
    120_000
  );
});
