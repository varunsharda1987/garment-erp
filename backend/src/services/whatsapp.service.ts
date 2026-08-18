/**
 * Per-user WhatsApp Web integration (whatsapp-web.js).
 *
 * Ported from the Kasya B2B sales app, but with ONE key difference: instead of a single
 * shared business account, EVERY user links their OWN WhatsApp by scanning a QR once, and
 * every message they send goes out through THEIR OWN linked session. We therefore keep a
 * registry of sessions keyed by userId (a `Map<userId, Session>`) rather than the B2B
 * module-level singletons.
 *
 * This is UNOFFICIAL (it automates WhatsApp Web in a headless Chromium) — keep volumes
 * human-scale. Each linked user = one Chromium process, so we start sessions lazily (only
 * when a user is active) and tear idle ones down (keeping the on-disk session so no re-scan
 * is needed). There is no API key / webhook — the "credential" is the QR-scanned session,
 * persisted on disk under WHATSAPP_SESSION_DIR/session-<userId>.
 */
import fs from 'fs';
import path from 'path';
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import { ValidationError } from '../errors';
import { logInfo, logWarn, logError } from '../utils/logger';

export type WaState = 'disconnected' | 'initializing' | 'qr' | 'authenticated' | 'ready';

interface Session {
  userId: string;
  client: Client | null;
  state: WaState;
  qrDataUrl: string | null;
  me: { name?: string; number?: string } | null;
  lastError: string | null;
  attention: string | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectDelayMs: number;
  readyTimer: ReturnType<typeof setTimeout> | null;
  readyRetries: number;
  resetting: Promise<void> | null;
  lastUsedAt: number;
}

// Auto-retry backoff for failed (re)connects: 15s after the first failure, doubling to a
// 5-min ceiling, reset once the link is back.
const RECONNECT_BASE_MS = 15_000;
const RECONNECT_MAX_MS = 5 * 60_000;

// Watchdog for the authenticated→ready transition: whatsapp-web.js occasionally authenticates
// (QR accepted) but never fires 'ready'. If 'ready' doesn't arrive within READY_TIMEOUT_MS,
// rebuild the page from the saved session (softReset), bounded by MAX_READY_RETRIES.
const READY_TIMEOUT_MS = 60_000;
const MAX_READY_RETRIES = 3;

// Idle teardown: destroy a linked user's Chromium after this long with no send/status, keeping
// the on-disk session so the next poll/send re-links transparently. Bounds concurrent browsers.
const IDLE_TEARDOWN_MS = 20 * 60_000;
const IDLE_SWEEP_MS = 5 * 60_000;

// Where each user's linked-device session lives (survives restarts so no re-scan is needed).
// LocalAuth stores under `<dataPath>/session-<clientId>`.
const sessionRootDir = process.env.WHATSAPP_SESSION_DIR || path.join(process.cwd(), '.wwebjs_auth');
// Optional system Chromium/Chrome/Edge path — set to skip Puppeteer's bundled download.
const browserPath = process.env.WHATSAPP_BROWSER_PATH || undefined;

const sessions = new Map<string, Session>();

function getOrCreateSession(userId: string): Session {
  let s = sessions.get(userId);
  if (!s) {
    s = {
      userId,
      client: null,
      state: 'disconnected',
      qrDataUrl: null,
      me: null,
      lastError: null,
      attention: null,
      reconnectTimer: null,
      reconnectDelayMs: RECONNECT_BASE_MS,
      readyTimer: null,
      readyRetries: 0,
      resetting: null,
      lastUsedAt: Date.now(),
    };
    sessions.set(userId, s);
  }
  return s;
}

function sessionFolder(userId: string): string {
  return path.join(sessionRootDir, `session-${userId}`);
}

// Whether a linked-device session is saved on disk for this user. Distinguishes "was linked
// but the browser is idle/dropped" (worth resuming) from "never linked" (leave alone).
function hasSavedSession(userId: string): boolean {
  try {
    const dir = sessionFolder(userId);
    return fs.existsSync(dir) && fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

function clearReadyWatchdog(s: Session): void {
  if (s.readyTimer) {
    clearTimeout(s.readyTimer);
    s.readyTimer = null;
  }
}

// Arm (or re-arm) the authenticated→ready watchdog. Called when 'authenticated' fires.
function armReadyWatchdog(userId: string): void {
  const s = sessions.get(userId);
  if (!s) return;
  clearReadyWatchdog(s);
  s.readyTimer = setTimeout(() => {
    s.readyTimer = null;
    if (s.state !== 'authenticated') return; // already became ready (or dropped)
    if (s.readyRetries >= MAX_READY_RETRIES) {
      s.lastError = 'WhatsApp stalled finishing sign-in. Please unlink and scan the QR again.';
      s.attention = s.lastError;
      logError(`WhatsApp stuck at "authenticated" for user ${userId} after ${MAX_READY_RETRIES} attempts — giving up`);
      return;
    }
    s.readyRetries += 1;
    logWarn(
      `WhatsApp stuck finishing sign-in for user ${userId} (attempt ${s.readyRetries}/${MAX_READY_RETRIES}) — rebuilding the page`
    );
    softReset(userId).catch(() => {
      /* failure surfaced via lastError */
    });
  }, READY_TIMEOUT_MS);
  s.readyTimer.unref();
}

// Recover from a transient drop / failed startup by re-linking from the persisted session.
// Conservative: skip logout/conflict (those need a fresh QR), at most one attempt in flight,
// and only if the on-disk session still exists (so a wiped session can't loop forever).
function scheduleReconnect(userId: string, reason: string): void {
  if (/logout|conflict/i.test(reason)) return;
  const s = sessions.get(userId);
  if (!s || s.reconnectTimer) return;
  const delay = s.reconnectDelayMs;
  s.reconnectDelayMs = Math.min(s.reconnectDelayMs * 2, RECONNECT_MAX_MS);
  s.reconnectTimer = setTimeout(() => {
    s.reconnectTimer = null;
    if (hasSavedSession(userId)) {
      logInfo(`WhatsApp attempting reconnect for user ${userId}…`);
      connectForUser(userId).catch(() => {
        /* error captured in lastError */
      });
    }
  }, delay);
  s.reconnectTimer.unref();
}

/**
 * Start (or resume) a user's WhatsApp Web session. Idempotent — a second call while
 * connecting/connected is a no-op. Resolves immediately; progress is observed via getStatus.
 */
export async function connectForUser(userId: string): Promise<void> {
  const s = getOrCreateSession(userId);
  if (s.client) return;
  s.lastError = null;
  s.state = 'initializing';
  s.lastUsedAt = Date.now();

  const c = new Client({
    authStrategy: new LocalAuth({ clientId: userId, dataPath: sessionRootDir }),
    puppeteer: {
      ...(browserPath ? { executablePath: browserPath } : {}),
      headless: true,
      // A slow WhatsApp Web load can trip the default CDP timeout — give it more room.
      protocolTimeout: 120_000,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  });
  s.client = c;

  c.on('qr', async (qr: string) => {
    s.state = 'qr';
    logInfo(`WhatsApp QR ready for user ${userId} — waiting for scan`);
    try {
      s.qrDataUrl = await QRCode.toDataURL(qr);
    } catch {
      s.qrDataUrl = null;
    }
  });
  c.on('loading_screen', (percent: number, message: string) => {
    logInfo(`WhatsApp loading ${percent}% ${message} [user ${userId}]`);
  });
  c.on('authenticated', () => {
    s.state = 'authenticated';
    s.qrDataUrl = null;
    logInfo(`WhatsApp authenticated for user ${userId} — finishing sign-in`);
    armReadyWatchdog(userId);
  });
  c.on('auth_failure', (m: string) => {
    s.state = 'disconnected';
    s.lastError = String(m);
    s.attention = 'WhatsApp rejected the saved session (auth failure). Re-scan the QR.';
    logError(`WhatsApp auth_failure for user ${userId}:`, m);
  });
  c.on('ready', () => {
    clearReadyWatchdog(s);
    s.readyRetries = 0;
    s.reconnectDelayMs = RECONNECT_BASE_MS;
    s.state = 'ready';
    s.qrDataUrl = null;
    s.attention = null;
    s.lastError = null;
    s.me = { name: c.info?.pushname, number: c.info?.wid?.user };
    s.lastUsedAt = Date.now();
    logInfo(`WhatsApp linked for user ${userId} as ${s.me.name || s.me.number}`);
  });
  c.on('disconnected', async (reason: string) => {
    logInfo(`WhatsApp disconnected for user ${userId}: ${reason}`);
    clearReadyWatchdog(s);
    s.state = 'disconnected';
    s.qrDataUrl = null;
    s.me = null;
    try {
      await c.destroy();
    } catch {
      /* ignore */
    }
    // Only null the client if a reconnect hasn't ALREADY replaced it during the await above —
    // otherwise we orphan the new client whose Chrome holds the LocalAuth profile lock.
    if (s.client === c) s.client = null;
    if (/logout|conflict/i.test(reason)) {
      s.attention = `WhatsApp was unlinked (${reason}). Re-scan the QR to reconnect.`;
    }
    scheduleReconnect(userId, reason);
  });

  c.initialize().catch(async (e: unknown) => {
    s.lastError = e instanceof Error ? e.message : String(e);
    s.state = 'disconnected';
    // initialize() can reject AFTER Chrome launched (e.g. WhatsApp Web page load timeout). If
    // we just null the client, that Chrome is leaked and keeps holding the profile lock, so the
    // NEXT connect fails with "browser is already running". Always tear it down here.
    try {
      await c.destroy();
    } catch {
      /* browser may not have launched — ignore */
    }
    if (s.client === c) s.client = null;
    logError(`WhatsApp initialize failed for user ${userId}:`, s.lastError);
    scheduleReconnect(userId, s.lastError || 'initialize failed');
  });
}

/**
 * Status for a user's session. Lazily resumes a saved-but-idle session in the background so
 * Chromiums start only for users actually using the app (not all at boot).
 */
export function getStatusForUser(userId: string) {
  const existing = sessions.get(userId);
  const saved = hasSavedSession(userId);

  // Lazy connect: a saved session but no live client → resume in the background.
  if (saved && (!existing || (!existing.client && existing.state === 'disconnected'))) {
    void connectForUser(userId);
  }

  const s = sessions.get(userId);
  if (s) s.lastUsedAt = Date.now();
  return {
    state: s?.state ?? 'disconnected',
    qr: s?.state === 'qr' ? s.qrDataUrl : null,
    me: s?.me ?? null,
    error: s?.lastError ?? null,
    attention: s?.attention ?? null,
    sessionSaved: saved,
  };
}

export function isReadyForUser(userId: string): boolean {
  const s = sessions.get(userId);
  return !!s && s.state === 'ready';
}

/** Unlink and forget a user's session (clears the stored credentials — forces a re-scan). */
export async function disconnectForUser(userId: string): Promise<void> {
  const s = sessions.get(userId);
  if (!s) return;
  const c = s.client;
  s.client = null;
  s.state = 'disconnected';
  s.qrDataUrl = null;
  s.me = null;
  s.attention = null;
  s.lastError = null;
  clearReadyWatchdog(s);
  s.readyRetries = 0;
  if (s.reconnectTimer) {
    clearTimeout(s.reconnectTimer);
    s.reconnectTimer = null;
  }
  s.reconnectDelayMs = RECONNECT_BASE_MS;
  if (!c) return;
  try {
    await c.logout();
  } catch {
    /* ignore */
  }
  try {
    await c.destroy();
  } catch {
    /* ignore */
  }
}

// Recoverable "the WhatsApp Web page silently reloaded" errors — no 'disconnected' event fires,
// so we rebuild the page from the saved session on the next lookup.
function isStalePageError(e: unknown): boolean {
  const m = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return (
    m.includes('detached frame') ||
    m.includes('execution context') ||
    m.includes('session closed') ||
    m.includes('target closed') ||
    m.includes('protocol error')
  );
}

async function waitForReady(userId: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = sessions.get(userId);
    if (s && s.state === 'ready' && s.client) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new ValidationError('WhatsApp is reconnecting — please try again in a moment.');
}

// Tear down the dead page WITHOUT logging out (keeps the session, so no QR re-scan), then
// re-link. Concurrent callers share the one in-flight reset.
async function softReset(userId: string): Promise<void> {
  const s = sessions.get(userId);
  if (!s) return;
  if (s.resetting) return s.resetting;
  s.resetting = (async () => {
    const c = s.client;
    s.client = null;
    s.state = 'disconnected';
    s.qrDataUrl = null;
    if (c) {
      try {
        await c.destroy();
      } catch {
        /* ignore */
      }
    }
    logWarn(`WhatsApp page was stale for user ${userId} — rebuilding the session`);
    await connectForUser(userId);
    await waitForReady(userId);
  })().finally(() => {
    s.resetting = null;
  });
  return s.resetting;
}

function assertLinked(userId: string): Client {
  const s = sessions.get(userId);
  if (!s || !s.client || s.state !== 'ready') {
    throw new ValidationError('Your WhatsApp isn’t linked. Open “My WhatsApp” and scan the QR first.');
  }
  return s.client;
}

// Resolve a send target — a phone number (digits + country code) or an already-serialized chat
// id (`…@g.us` group or `…@c.us` contact) — to a chat id, validating that a bare number is on
// WhatsApp. Requires a ready client.
async function resolveChatId(userId: string, target: string): Promise<string> {
  const t = (target || '').trim();
  if (!t) throw new ValidationError('No WhatsApp recipient provided.');
  if (/@(c|g)\.us$/i.test(t)) return t;
  const s = sessions.get(userId);
  if (!s || !s.client) throw new ValidationError('Your WhatsApp isn’t linked. Scan the QR first.');
  const digits = t.replace(/\D/g, '');
  if (!digits) throw new ValidationError('No WhatsApp number provided.');
  const numberId = await s.client.getNumberId(digits);
  if (!numberId) throw new ValidationError(`${target} is not on WhatsApp.`);
  return numberId._serialized;
}

// Resolve the target's chat id, recovering ONCE from a stale WhatsApp Web page. This is the ONLY
// part of a send safe to auto-retry: it's a pre-send, idempotent lookup. sendMessage is
// deliberately NOT retried — a stale-page error can fire AFTER delivery, so a blind retry would
// double-send. On a send-time stale error we fail and let the user re-send by hand.
async function resolveChatIdWithRecovery(userId: string, target: string): Promise<string> {
  assertLinked(userId);
  try {
    return await resolveChatId(userId, target);
  } catch (e) {
    if (!isStalePageError(e)) throw e;
    await softReset(userId);
    assertLinked(userId);
    return await resolveChatId(userId, target);
  }
}

/** Send a plain text message through a user's own linked WhatsApp. */
export async function sendTextForUser(userId: string, target: string, text: string): Promise<{ to: string }> {
  const s = getOrCreateSession(userId);
  s.lastUsedAt = Date.now();
  const chatId = await resolveChatIdWithRecovery(userId, target);
  await assertLinked(userId).sendMessage(chatId, text); // NOT retried on a stale page (avoids double-send)
  return { to: chatId };
}

/** Send a PDF (Buffer) through a user's own linked WhatsApp. */
export async function sendPdfForUser(
  userId: string,
  target: string,
  caption: string,
  pdf: Buffer,
  filename: string
): Promise<{ to: string }> {
  const s = getOrCreateSession(userId);
  s.lastUsedAt = Date.now();
  const chatId = await resolveChatIdWithRecovery(userId, target);
  const media = new MessageMedia('application/pdf', pdf.toString('base64'), filename);
  await assertLinked(userId).sendMessage(chatId, media, { caption }); // NOT retried on a stale page
  return { to: chatId };
}

/**
 * List the user's WhatsApp groups (id + name), for the recipient picker when sharing
 * documents (e.g. job work orders). Ported from the Kasya B2B sales app. A read-only,
 * idempotent lookup — safe to retry ONCE through a stale-page soft reset (unlike sends).
 */
export async function listGroupsForUser(userId: string): Promise<Array<{ id: string; name: string }>> {
  const s = getOrCreateSession(userId);
  s.lastUsedAt = Date.now();
  const run = async () => {
    const chats = await assertLinked(userId).getChats();
    return chats
      .filter((c) => c.isGroup)
      .map((c) => ({ id: c.id._serialized, name: c.name || c.id.user }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };
  try {
    return await run();
  } catch (e) {
    if (!isStalePageError(e)) throw e;
    await softReset(userId);
    return await run();
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

let sweepTimer: ReturnType<typeof setInterval> | null = null;

/** Start the idle-teardown sweep (call once at boot). Destroys idle browsers, keeps sessions. */
export function startIdleSweep(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const s of sessions.values()) {
      if (s.client && s.state === 'ready' && now - s.lastUsedAt > IDLE_TEARDOWN_MS) {
        logInfo(`WhatsApp idle teardown for user ${s.userId} (keeping saved session)`);
        const c = s.client;
        s.client = null;
        s.state = 'disconnected';
        s.qrDataUrl = null;
        s.me = null;
        clearReadyWatchdog(s);
        // destroy WITHOUT logout so the session survives on disk for a lazy re-link.
        void (async () => {
          try {
            await c.destroy();
          } catch {
            /* ignore */
          }
        })();
      }
    }
  }, IDLE_SWEEP_MS);
  sweepTimer.unref();
}

/** Graceful shutdown: destroy every live browser WITHOUT logout (keeps sessions clean). */
export async function shutdownAll(): Promise<void> {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
  const all = [...sessions.values()];
  await Promise.all(
    all.map(async (s) => {
      const c = s.client;
      s.client = null;
      s.state = 'disconnected';
      clearReadyWatchdog(s);
      if (s.reconnectTimer) {
        clearTimeout(s.reconnectTimer);
        s.reconnectTimer = null;
      }
      if (!c) return;
      try {
        await c.destroy();
      } catch {
        /* ignore */
      }
    })
  );
}
