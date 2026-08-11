/**
 * HTML → PDF renderer (kf-documents design system).
 *
 * Drives the Chrome that is ALREADY on this box (whatsapp-web.js pulled in
 * puppeteer-core and downloaded chrome-headless-shell to ~/.cache/puppeteer) —
 * no new browser install. Lifecycle is tuned for a low-RAM Windows host:
 *
 *  - lazy singleton browser, launched only when a document is rendered
 *  - `pipe: true` transport: Chrome dies with this node process no matter how
 *    the process dies (the primary orphan defense on this PC)
 *  - single-flight mutex: one page renders at a time (caps transient RAM)
 *  - 120s idle teardown (same pattern as whatsapp.service startIdleSweep)
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import puppeteer, { Browser } from 'puppeteer-core';
import logger from '../utils/logger';

export class RendererUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RendererUnavailableError';
  }
}

const IDLE_TEARDOWN_MS = 120_000;
const DEFAULT_RENDER_TIMEOUT_MS = 30_000;

/** Newest versioned executable under a puppeteer cache root, or null. */
function newestCacheExecutable(root: string, exeRelPaths: string[]): string | null {
  try {
    if (!fs.existsSync(root)) return null;
    const versions = fs
      .readdirSync(root)
      .filter((d) => fs.statSync(path.join(root, d)).isDirectory())
      .sort()
      .reverse();
    for (const v of versions) {
      for (const rel of exeRelPaths) {
        const exe = path.join(root, v, rel);
        if (fs.existsSync(exe)) return exe;
      }
    }
  } catch {
    // unreadable cache — fall through to the next candidate
  }
  return null;
}

/**
 * Chrome discovery order: CHROME_PATH env → puppeteer-cached headless-shell
 * (smallest RAM footprint) → puppeteer-cached Chrome for Testing → system Chrome.
 * Deliberately independent from the WhatsApp browser config.
 */
export function resolveChromePath(): string | null {
  const envPath = process.env.CHROME_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const cacheBase = path.join(os.homedir(), '.cache', 'puppeteer');
  const headlessShell = newestCacheExecutable(path.join(cacheBase, 'chrome-headless-shell'), [
    path.join('chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
  ]);
  if (headlessShell) return headlessShell;

  const cachedChrome = newestCacheExecutable(path.join(cacheBase, 'chrome'), [path.join('chrome-win64', 'chrome.exe')]);
  if (cachedChrome) return cachedChrome;

  const systemCandidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];
  for (const candidate of systemCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

let browserPromise: Promise<Browser> | null = null;
let lastUsedAt = 0;
let idleSweep: NodeJS.Timeout | null = null;
// Promise-chain mutex: renders queue behind each other (one page at a time)
let renderChain: Promise<unknown> = Promise.resolve();

async function launchBrowser(): Promise<Browser> {
  const executablePath = resolveChromePath();
  if (!executablePath) {
    throw new RendererUnavailableError(
      'PDF renderer unavailable: Chrome not found. Set CHROME_PATH in backend/.env to a chrome.exe or chrome-headless-shell.exe'
    );
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    pipe: true, // Chrome exits when the pipe closes — dies with this process
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions'],
    userDataDir: path.join(os.tmpdir(), 'kf-pdf-profile'),
  });

  browser.on('disconnected', () => {
    browserPromise = null;
  });

  if (!idleSweep) {
    idleSweep = setInterval(() => {
      if (browserPromise && Date.now() - lastUsedAt > IDLE_TEARDOWN_MS) {
        void closeBrowser();
      }
    }, 30_000);
    idleSweep.unref();
  }

  logger.info(`[HtmlRenderer] Chrome launched: ${executablePath}`);
  return browser;
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  const pending = browserPromise;
  browserPromise = null;
  if (pending) {
    try {
      const browser = await pending;
      await browser.close();
      logger.info('[HtmlRenderer] Chrome closed (idle/shutdown)');
    } catch {
      // already dead — nothing to do
    }
  }
}

async function renderOnce(html: string, timeoutMs: number, baseDir?: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  // Chrome refuses file:// subresources from setContent (about:blank origin), so
  // the HTML is written next to its assets and navigated to as a real file URL —
  // relative CSS/font/image paths then load natively.
  const dir = baseDir ?? os.tmpdir();
  const tmpFile = path.join(dir, `.render-${crypto.randomUUID()}.html`);
  try {
    fs.writeFileSync(tmpFile, html, 'utf8');
    page.setDefaultTimeout(timeoutMs);
    await page.goto(pathToFileURL(tmpFile).href, { waitUntil: 'load', timeout: timeoutMs });
    // Local woff2 loads in ms; the await guarantees glyphs are ready before pdf.
    // (string-form evaluate: backend tsconfig has no DOM lib)
    await page.evaluate('document.fonts.ready');
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }, // print CSS carries its own 10mm padding
      timeout: timeoutMs,
    });
    return Buffer.from(pdf);
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // temp file already gone
    }
    try {
      await page.close();
    } catch {
      // page/browser already gone — the disconnect handler resets state
    }
  }
}

/**
 * Render an HTML string to a PDF buffer. Serialized via a mutex; one automatic
 * relaunch retry if Chrome crashed between renders.
 */
export async function htmlToPdf(html: string, opts?: { timeoutMs?: number; baseDir?: string }): Promise<Buffer> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS;
  const task = renderChain.then(async () => {
    lastUsedAt = Date.now();
    try {
      return await renderOnce(html, timeoutMs, opts?.baseDir);
    } catch (err) {
      if (err instanceof RendererUnavailableError) throw err;
      // one retry with a fresh browser (covers Chrome crash / stale pipe)
      logger.warn('[HtmlRenderer] render failed, relaunching Chrome for one retry', { error: String(err) });
      await closeBrowser();
      return await renderOnce(html, timeoutMs, opts?.baseDir);
    } finally {
      lastUsedAt = Date.now();
    }
  });
  // keep the chain alive even when a render rejects
  renderChain = task.catch(() => undefined);
  return task;
}
