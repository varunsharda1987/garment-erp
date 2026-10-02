/**
 * Garment photo thumbnails (?thumb=1): a small cached WebP when sharp is there, the original
 * (next()) whenever it is not, and never a way to read a file outside uploads/styles.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Request, Response } from 'express';
import { createStyleThumbnailMiddleware, __setSharpForTests } from '../style-thumbnail.middleware';

function fakeSharp(calls: string[]) {
  return ((input: string) => {
    const chain = {
      rotate: () => chain,
      resize: () => chain,
      webp: () => chain,
      toFile: async (out: string) => {
        calls.push(input);
        fs.writeFileSync(out, 'thumb-of-' + path.basename(input));
      },
    };
    return chain;
  }) as unknown as Parameters<typeof __setSharpForTests>[0];
}

function run(mw: ReturnType<typeof createStyleThumbnailMiddleware>, url: string, query: Record<string, string> = { thumb: '1' }) {
  const sent: string[] = [];
  const next = jest.fn();
  const req = { method: 'GET', path: url, query } as unknown as Request;
  const res = {
    headersSent: false,
    sendFile: jest.fn((file: string, _opts: unknown, cb: (err?: Error) => void) => {
      sent.push(file);
      cb();
    }),
  } as unknown as Response;
  return mw(req, res, next).then(() => ({ next, sent }));
}

describe('style thumbnail middleware', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'thumbs-'));
    fs.writeFileSync(path.join(dir, 'style-1.jpg'), 'original');
  });
  afterEach(() => {
    __setSharpForTests(undefined);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('makes a cached WebP once and serves it', async () => {
    const calls: string[] = [];
    __setSharpForTests(fakeSharp(calls));
    const mw = createStyleThumbnailMiddleware(dir);

    const first = await run(mw, '/style-1.jpg');
    const second = await run(mw, '/style-1.jpg');

    const thumb = path.join(dir, '.thumbs', 'style-1.jpg.webp');
    expect(first.sent).toEqual([thumb]);
    expect(second.sent).toEqual([thumb]);
    expect(calls).toHaveLength(1); // the second request used the cache
    expect(first.next).not.toHaveBeenCalled();
  });

  it('serves the original when sharp is not installed', async () => {
    __setSharpForTests(null);
    const { next, sent } = await run(createStyleThumbnailMiddleware(dir), '/style-1.jpg');
    expect(next).toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it('leaves requests without ?thumb to the static server', async () => {
    __setSharpForTests(fakeSharp([]));
    const { next, sent } = await run(createStyleThumbnailMiddleware(dir), '/style-1.jpg', {});
    expect(next).toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it.each(['/../secret.jpg', '/%2e%2e%2fsecret.jpg', '/sub/style-1.jpg', '/notes.txt', '/missing.jpg'])(
    'never builds from %s',
    async (url) => {
      const calls: string[] = [];
      __setSharpForTests(fakeSharp(calls));
      const { next, sent } = await run(createStyleThumbnailMiddleware(dir), url);
      expect(next).toHaveBeenCalled();
      expect(sent).toEqual([]);
      expect(calls).toEqual([]);
    }
  );
});
