/**
 * Garment photo thumbnails — `/uploads/styles/<file>?thumb=1`.
 *
 * Every list that shows a style's photo (cutting, stitching, finishing, work orders, sale orders…)
 * asks for it with `?thumb=1` (frontend StyleThumbnail). Originals are up to 5 MB; a 100-row list
 * of them is hundreds of MB. This answers with a small WebP instead, made on first request and
 * cached beside the originals in `uploads/styles/.thumbs/` (rebuilt when the original is newer).
 *
 * It degrades, never fails: without `sharp` installed, for a file it cannot read, or for anything
 * that is not a plain image in uploads/styles, it calls next() and express.static serves the
 * original (the query string is ignored there). Mounted after the file-access guard, so it adds no
 * new way to read a file.
 */

import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { logWarn } from '../utils/logger';

/** Longest side of a thumbnail, in px — 2× the largest list size (md, 64px) plus the hover preview. */
export const THUMB_SIZE = 240;
const THUMB_DIR_NAME = '.thumbs';
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

type SharpFactory = (input: string) => {
  rotate(): ReturnType<SharpFactory>;
  resize(w: number, h: number, opts: { fit: 'inside'; withoutEnlargement: boolean }): ReturnType<SharpFactory>;
  webp(opts: { quality: number }): ReturnType<SharpFactory>;
  toFile(out: string): Promise<unknown>;
};

let sharpLoader: Promise<SharpFactory | null> | null = null;

/** `sharp` is optional: load it once; null when it is not installed. */
function loadSharp(): Promise<SharpFactory | null> {
  if (!sharpLoader) {
    const moduleName = 'sharp'; // a variable, so the build does not require the package to exist
    sharpLoader = import(moduleName)
      .then((mod) => (mod.default ?? mod) as SharpFactory)
      .catch(() => {
        logWarn('Style thumbnails: sharp is not installed — lists load the original photos');
        return null;
      });
  }
  return sharpLoader;
}

/** Test hook: forget the loaded `sharp` (or inject a fake). */
export function __setSharpForTests(factory: SharpFactory | null | undefined): void {
  sharpLoader = factory === undefined ? null : Promise.resolve(factory);
}

function mtimeMs(file: string): number | null {
  try {
    const stat = fs.statSync(file);
    return stat.isFile() ? stat.mtimeMs : null;
  } catch {
    return null;
  }
}

/** One build per thumbnail at a time — a list asks for the same photo from many rows at once. */
const inFlight = new Map<string, Promise<boolean>>();

async function ensureThumb(sharp: SharpFactory, source: string, thumb: string): Promise<boolean> {
  const sourceTime = mtimeMs(source);
  if (sourceTime === null) return false;
  const thumbTime = mtimeMs(thumb);
  if (thumbTime !== null && thumbTime >= sourceTime) return true;

  let job = inFlight.get(thumb);
  if (!job) {
    job = (async () => {
      try {
        fs.mkdirSync(path.dirname(thumb), { recursive: true });
        const tmp = `${thumb}.${process.pid}.${Date.now()}.tmp`;
        await sharp(source)
          .rotate() // honour the phone camera's EXIF orientation
          .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 78 })
          .toFile(tmp);
        fs.renameSync(tmp, thumb); // never serve a half-written file
        return true;
      } catch (error) {
        logWarn('Style thumbnail could not be made — serving the original', {
          file: path.basename(source),
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      } finally {
        inFlight.delete(thumb);
      }
    })();
    inFlight.set(thumb, job);
  }
  return job;
}

/**
 * @param stylesDir absolute path of uploads/styles
 */
export function createStyleThumbnailMiddleware(stylesDir: string) {
  const root = path.resolve(stylesDir);
  const thumbDir = path.join(root, THUMB_DIR_NAME);

  return async function styleThumbnail(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (req.method !== 'GET' || req.query.thumb === undefined) return next();

    // req.path is relative to the mount point: "/style-123.jpg". Only a plain file in the folder.
    let name: string;
    try {
      name = decodeURIComponent(req.path.replace(/^\/+/, ''));
    } catch {
      return next();
    }
    if (!name || name !== path.basename(name) || !IMAGE_EXT.test(name)) return next();

    const source = path.join(root, name);
    if (path.dirname(source) !== root) return next();

    const sharp = await loadSharp();
    if (!sharp) return next();

    const thumb = path.join(thumbDir, `${name}.webp`);
    if (!(await ensureThumb(sharp, source, thumb))) return next();

    // dotfiles: the cache folder is `.thumbs`, which send() refuses by default.
    res.sendFile(thumb, { maxAge: '7d', dotfiles: 'allow', headers: { 'Content-Type': 'image/webp' } }, (err) => {
      if (err && !res.headersSent) next();
    });
  };
}
