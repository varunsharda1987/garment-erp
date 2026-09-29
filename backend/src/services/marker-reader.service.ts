/**
 * The CAD marker reader — reads a Nest EXPERT marker image (screenshot or PDF export) into numbers.
 *
 * The work is done by backend/ocr/read_marker.py (PaddleOCR's PP-OCR models via RapidOCR, on the CPU),
 * run from the Python env that backend/ocr/setup.ps1 makes once on the PC serving the API. It is read
 * straight from this folder, like backend/templates, so deploys never have to carry it.
 *
 * This service never throws for a bad image or a missing reader: it answers READER_UNAVAILABLE or
 * UNREADABLE, and the marker rule (helpers/cad-marker.helper.ts) turns that into "not checked — give a
 * reason". A marker is read in ~5–10 s (up to ~25 s when its sizes have to come from the piece table because
 * the screenshot begins below the title bar); reads run ONE AT A TIME because the PC also serves other apps.
 */
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logInfo, logWarn } from '../utils/logger';

export type MarkerReadStatus = 'READ' | 'PARTIAL' | 'UNREADABLE' | 'READER_UNAVAILABLE';

export interface MarkerSize {
  sizeName: string;
  quantity: number;
}

export interface MarkerReading {
  status: MarkerReadStatus;
  /** Marker (layer) length in metres, as printed: "Length 8,29 m" */
  lengthM: number | null;
  /** Marker width in inches: "Width: 52,00 inch" */
  widthIn: number | null;
  /** "Eff 89,05%" */
  efficiencyPct: number | null;
  /** "Placed 135/135" — pieces placed / pieces in the marker */
  placed: number | null;
  total: number | null;
  /** From the title's size list ("L(x2)" is one entry with quantity 2) — or, when the screenshot begins below
   *  the title bar, from the piece table under the toolbar (kept only when it adds up to the piece total) */
  sizes: MarkerSize[];
  /** Where the sizes were read: 'title', 'pieces' (the piece table), null = none read */
  sizesFrom: 'title' | 'pieces' | null;
  /** Garments in the marker (sum of the size quantities), null when no sizes were read */
  pieces: number | null;
  title: string | null;
  text: string | null;
  ms: number | null;
  readerVersion: string | null;
  error?: string;
}

/** backend/ — the same anchor upload.middleware.ts uses (src/services or dist/services → ../..) */
const BACKEND_ROOT = path.join(__dirname, '../..');
const OCR_DIR = path.join(BACKEND_ROOT, 'ocr');
const SCRIPT = path.join(OCR_DIR, 'read_marker.py');
const UPLOADS_DIR = path.join(BACKEND_ROOT, 'uploads');
const TIMEOUT_MS = 60_000;

function pythonPath(): string {
  if (process.env.MARKER_READER_PYTHON) return process.env.MARKER_READER_PYTHON;
  const windows = path.join(OCR_DIR, '.venv', 'Scripts', 'python.exe');
  return fs.existsSync(windows) ? windows : path.join(OCR_DIR, '.venv', 'bin', 'python');
}

function unavailable(error: string): MarkerReading {
  return {
    status: 'READER_UNAVAILABLE',
    lengthM: null,
    widthIn: null,
    efficiencyPct: null,
    placed: null,
    total: null,
    sizes: [],
    sizesFrom: null,
    pieces: null,
    title: null,
    text: null,
    ms: null,
    readerVersion: null,
    error,
  };
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const int = (v: unknown): number | null => (Number.isInteger(v) ? (v as number) : null);

/** The reader's JSON, checked field by field — nothing it prints is trusted as-is */
export function normalizeReading(raw: unknown): MarkerReading {
  const r = (raw ?? {}) as Record<string, unknown>;
  const status: MarkerReadStatus =
    r.status === 'READ' || r.status === 'PARTIAL' || r.status === 'UNREADABLE' ? r.status : 'UNREADABLE';
  const sizes: MarkerSize[] = Array.isArray(r.sizes)
    ? (r.sizes as Array<Record<string, unknown>>)
        .filter((s) => typeof s?.sizeName === 'string' && Number.isInteger(s.quantity) && (s.quantity as number) > 0)
        .map((s) => ({ sizeName: String(s.sizeName).toUpperCase(), quantity: s.quantity as number }))
    : [];
  const pieces = sizes.length > 0 ? sizes.reduce((sum, s) => sum + s.quantity, 0) : null;
  return {
    status,
    lengthM: num(r.lengthM),
    widthIn: num(r.widthIn),
    efficiencyPct: num(r.efficiencyPct),
    placed: int(r.placed),
    total: int(r.total),
    sizes,
    sizesFrom: sizes.length === 0 ? null : r.sizesFrom === 'pieces' ? 'pieces' : 'title',
    pieces,
    title: typeof r.title === 'string' ? r.title.slice(0, 500) : null,
    text: typeof r.text === 'string' ? r.text.slice(0, 2000) : null,
    ms: int(r.ms),
    readerVersion: typeof r.readerVersion === 'string' ? r.readerVersion : null,
    ...(typeof r.error === 'string' ? { error: r.error.slice(0, 500) } : {}),
  };
}

/**
 * The file on disk behind an uploaded CAD image's URL ("/uploads/cad-files/cad-123.png"), or null when
 * the URL points anywhere outside the uploads folder.
 */
export function markerFilePath(fileUrl: string): string | null {
  const relative = fileUrl.replace(/^\/+uploads\/+/, '');
  const full = path.resolve(UPLOADS_DIR, relative);
  return full.startsWith(path.resolve(UPLOADS_DIR) + path.sep) ? full : null;
}

function runReader(filePath: string): Promise<MarkerReading> {
  if (process.env.MARKER_READER_DISABLED === '1') {
    return Promise.resolve(unavailable('The marker reader is switched off (MARKER_READER_DISABLED)'));
  }
  const python = pythonPath();
  if (!fs.existsSync(python)) {
    return Promise.resolve(unavailable('The marker reader is not installed on the server (run backend/ocr/setup.ps1)'));
  }
  return new Promise((resolve) => {
    execFile(
      python,
      [SCRIPT, filePath],
      { timeout: TIMEOUT_MS, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          logWarn('Marker reader failed', { filePath, error: error.message });
          resolve(unavailable(error.killed ? 'The marker reader took too long' : 'The marker reader failed'));
          return;
        }
        try {
          const reading = normalizeReading(JSON.parse(String(stdout).trim().split('\n').pop() || '{}'));
          logInfo('Marker read', { filePath, status: reading.status, lengthM: reading.lengthM, ms: reading.ms });
          resolve(reading);
        } catch {
          logWarn('Marker reader printed something that is not a reading', { filePath });
          resolve(unavailable('The marker reader gave no reading'));
        }
      }
    );
  });
}

let queue: Promise<unknown> = Promise.resolve();

/** Read one marker image (absolute path). One read at a time, whoever asks. */
export function readMarkerFile(filePath: string): Promise<MarkerReading> {
  const run = queue.then(() => runReader(filePath));
  queue = run.catch(() => undefined);
  return run;
}
