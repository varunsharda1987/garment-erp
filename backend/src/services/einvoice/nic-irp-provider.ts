/**
 * NIC IRP adapter — implements the government e-Invoice API crypto envelope.
 *
 * Auth (eivital v1.04): password + AppKey are individually RSA-encrypted with the
 * NIC public key; the response SEK (session encryption key) is AES-256-ECB
 * encrypted with the AppKey. All core-API payloads travel AES-256-ECB encrypted
 * with the SEK, base64 encoded. Sandbox tokens last ~60 min, production ~360 min.
 *
 * The auth body assembly lives in buildAuthBody() alone — NIC doc versions vary
 * subtly, so any variant fix during sandbox testing is a one-function change.
 */

import crypto from 'crypto';
import { EInvoiceSettings, einvoiceSettingsService } from '../einvoice-settings.service';
import { resolveNicPublicKey } from '../../config/einvoice-keys';
import { logError, logInfo } from '../../utils/logger';
import type { Inv01Payload } from './einvoice-payload.builder';
import type { CancelResult, IrnResult, IrpProvider, TestAuthResult } from './irp-provider';

const AUTH_PATH = '/eivital/v1.04/auth';
const INVOICE_PATH = '/eicore/v1.03/Invoice';
const CANCEL_PATH = '/eicore/v1.03/Invoice/Cancel';
const GET_IRN_PATH = '/eicore/v1.03/Invoice/irn';

const REQUEST_TIMEOUT_MS = 30000;
const TOKEN_REFRESH_MARGIN_MS = 10 * 60 * 1000; // refresh when <10 min validity left

interface TokenCache {
  authToken: string;
  sek: Buffer;
  expiresAt: number;
  fingerprint: string;
}

let tokenCache: TokenCache | null = null;

/** Test-only escape hatch (settings changes also invalidate via fingerprint). */
export function invalidateNicTokenCache(): void {
  tokenCache = null;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

interface NicEnvelope {
  Status?: number | string;
  Data?: unknown;
  ErrorDetails?: unknown;
  InfoDtls?: unknown;
  [key: string]: unknown;
}

function parseErrorDetails(raw: unknown): { code: string; message: string }[] {
  let details = raw;
  if (typeof details === 'string') {
    const text = details.trim();
    // Sometimes a base64-encoded JSON string, sometimes plain JSON, sometimes plain text
    try {
      details = JSON.parse(text);
    } catch {
      try {
        details = JSON.parse(Buffer.from(text, 'base64').toString('utf8'));
      } catch {
        return [{ code: '', message: text }];
      }
    }
  }
  if (Array.isArray(details)) {
    return details.map((d) => ({
      code: String((d as Record<string, unknown>)?.ErrorCode ?? (d as Record<string, unknown>)?.error_cd ?? ''),
      message: String(
        (d as Record<string, unknown>)?.ErrorMessage ?? (d as Record<string, unknown>)?.message ?? JSON.stringify(d)
      ),
    }));
  }
  if (details && typeof details === 'object') {
    const obj = details as Record<string, unknown>;
    return [{ code: String(obj.ErrorCode ?? ''), message: String(obj.ErrorMessage ?? JSON.stringify(obj)) }];
  }
  return [{ code: '', message: 'Unknown IRP error' }];
}

export class NicIrpError extends Error {
  readonly errors: { code: string; message: string }[];
  readonly infoDtls: unknown;

  constructor(errors: { code: string; message: string }[], infoDtls?: unknown) {
    super(errors.map((e) => (e.code ? `${e.code}: ${e.message}` : e.message)).join('; '));
    this.name = 'NicIrpError';
    this.errors = errors;
    this.infoDtls = infoDtls;
  }

  hasCode(code: string): boolean {
    return this.errors.some((e) => e.code === code);
  }
}

export class NicIrpProvider implements IrpProvider {
  constructor(private readonly settings: EInvoiceSettings) {}

  private get baseUrl(): string {
    return einvoiceSettingsService.getResolvedBaseUrl(this.settings);
  }

  private get fingerprint(): string {
    const s = this.settings;
    return [s.einvMode, s.einvGstin, s.einvApiUsername, s.einvClientId, this.baseUrl, s.updatedAt.toISOString()].join(
      '|'
    );
  }

  // ── Crypto primitives ────────────────────────────────────────────────────

  private rsaEncrypt(plaintext: string): string {
    const publicKey = resolveNicPublicKey(this.settings);
    const encrypted = crypto.publicEncrypt(
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(plaintext, 'utf8')
    );
    return encrypted.toString('base64');
  }

  private aesEncrypt(plaintext: string, key: Buffer): string {
    const cipher = crypto.createCipheriv('aes-256-ecb', key, null);
    return Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]).toString('base64');
  }

  private aesDecrypt(base64Cipher: string, key: Buffer): Buffer {
    const decipher = crypto.createDecipheriv('aes-256-ecb', key, null);
    return Buffer.concat([decipher.update(Buffer.from(base64Cipher, 'base64')), decipher.final()]);
  }

  // ── Auth ─────────────────────────────────────────────────────────────────

  /**
   * NIC doc versions differ on the exact auth body shape — keep every variant
   * decision inside this one function.
   */
  private buildAuthBody(appKey: string): Record<string, unknown> {
    return {
      Data: {
        UserName: this.settings.einvApiUsername,
        Password: this.rsaEncrypt(this.settings.einvApiPassword),
        AppKey: this.rsaEncrypt(appKey),
        ForceRefreshAccessToken: false,
      },
    };
  }

  private async authenticate(): Promise<TokenCache> {
    // 32-character random app key; its UTF-8 bytes double as the AES-256 key for SEK decryption
    const appKey = crypto.randomBytes(16).toString('hex');

    const envelope = await this.postJson(`${this.baseUrl}${AUTH_PATH}`, this.buildAuthBody(appKey), {
      client_id: this.settings.einvClientId,
      client_secret: this.settings.einvClientSecret,
      Gstin: this.settings.einvGstin,
    });

    const data = envelope.Data as Record<string, unknown> | undefined;
    const authToken = data?.AuthToken as string | undefined;
    const sekEncrypted = data?.Sek as string | undefined;
    const tokenExpiry = data?.TokenExpiry as string | undefined;
    if (!authToken || !sekEncrypted) {
      throw new Error('IRP auth succeeded but returned no AuthToken/Sek — unexpected response shape.');
    }

    const sek = this.aesDecrypt(sekEncrypted, Buffer.from(appKey, 'utf8'));
    if (sek.length !== 32) {
      throw new Error(`Decrypted SEK has unexpected length ${sek.length} (expected 32 bytes).`);
    }

    // TokenExpiry "yyyy-MM-dd HH:mm:ss" (IST, matches server locale); fall back to 50 min
    const parsedExpiry = tokenExpiry ? new Date(tokenExpiry.replace(' ', 'T')).getTime() : NaN;
    const expiresAt = Number.isFinite(parsedExpiry) ? parsedExpiry : Date.now() + 50 * 60 * 1000;

    logInfo(`IRP auth OK (${this.settings.einvMode}), token expires ${tokenExpiry ?? 'unknown'}`);
    return { authToken, sek, expiresAt, fingerprint: this.fingerprint };
  }

  private async getSession(): Promise<TokenCache> {
    if (
      tokenCache &&
      tokenCache.fingerprint === this.fingerprint &&
      Date.now() < tokenCache.expiresAt - TOKEN_REFRESH_MARGIN_MS
    ) {
      return tokenCache;
    }
    tokenCache = await this.authenticate();
    return tokenCache;
  }

  // ── Transport ────────────────────────────────────────────────────────────

  private async postJson(
    url: string,
    body: unknown,
    headers: Record<string, string>,
    method: 'POST' | 'GET' = 'POST'
  ): Promise<NicEnvelope> {
    let res: Response;
    try {
      res = await fetchWithTimeout(
        url,
        {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
          body: method === 'GET' ? undefined : JSON.stringify(body),
        },
        REQUEST_TIMEOUT_MS
      );
    } catch {
      throw new Error(
        `Could not reach the e-Invoice portal at ${this.baseUrl}. ` +
          'Check the internet connection and that the portal is up (sandbox has maintenance windows).'
      );
    }

    let envelope: NicEnvelope;
    try {
      envelope = (await res.json()) as NicEnvelope;
    } catch {
      throw new Error(`e-Invoice portal returned HTTP ${res.status} with a non-JSON body.`);
    }

    const status = Number(envelope.Status);
    if (status !== 1) {
      throw new NicIrpError(parseErrorDetails(envelope.ErrorDetails), envelope.InfoDtls);
    }
    return envelope;
  }

  /** POST an SEK-encrypted payload to a core API and return the decrypted Data JSON. */
  private async callCoreApi(path: string, payload: unknown | null, method: 'POST' | 'GET' = 'POST'): Promise<unknown> {
    const attempt = async (): Promise<unknown> => {
      const session = await this.getSession();
      const headers: Record<string, string> = {
        client_id: this.settings.einvClientId,
        client_secret: this.settings.einvClientSecret,
        Gstin: this.settings.einvGstin,
        user_name: this.settings.einvApiUsername,
        AuthToken: session.authToken,
      };
      const body = payload === null ? undefined : { Data: this.aesEncrypt(JSON.stringify(payload), session.sek) };
      const envelope = await this.postJson(`${this.baseUrl}${path}`, body, headers, method);

      if (typeof envelope.Data === 'string' && envelope.Data.length > 0) {
        const decrypted = this.aesDecrypt(envelope.Data, session.sek).toString('utf8');
        return JSON.parse(decrypted);
      }
      return envelope.Data ?? envelope;
    };

    try {
      return await attempt();
    } catch (err) {
      // Token invalid/expired (e.g. codes 1005/1006 or explicit message) → re-auth once
      const message = err instanceof Error ? err.message : String(err);
      const tokenProblem =
        err instanceof NicIrpError &&
        (err.hasCode('1005') || err.hasCode('1006') || /auth\s*token|token.*(invalid|expired)/i.test(message));
      if (tokenProblem) {
        logInfo('IRP token rejected — re-authenticating once');
        tokenCache = null;
        return attempt();
      }
      throw err;
    }
  }

  // ── IrpProvider implementation ───────────────────────────────────────────

  async testAuth(): Promise<TestAuthResult> {
    try {
      tokenCache = null; // force a fresh round-trip so the test is honest
      const session = await this.getSession();
      return {
        ok: true,
        tokenExpiry: new Date(session.expiresAt).toISOString(),
        message: `Authenticated with the ${this.settings.einvMode === 'PRODUCTION' ? 'production' : 'sandbox'} e-Invoice portal.`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError('IRP auth test failed', err instanceof Error ? err : new Error(message));
      return { ok: false, message };
    }
  }

  async generateIrn(payload: Inv01Payload): Promise<IrnResult> {
    const data = (await this.callCoreApi(INVOICE_PATH, payload)) as Record<string, unknown>;
    const irn = data?.Irn as string | undefined;
    if (!irn) {
      throw new Error('IRP generate returned success but no IRN — unexpected response shape.');
    }
    return {
      irn,
      ackNo: String(data.AckNo ?? ''),
      ackDt: String(data.AckDt ?? ''),
      signedInvoice: (data.SignedInvoice as string) || undefined,
      signedQrCode: String(data.SignedQRCode ?? ''),
      status: String(data.Status ?? 'ACT'),
    };
  }

  async cancelIrn(irn: string, reason: string, remarks: string): Promise<CancelResult> {
    const data = (await this.callCoreApi(CANCEL_PATH, {
      Irn: irn,
      CnlRsn: reason,
      CnlRem: remarks,
    })) as Record<string, unknown>;
    return {
      irn: String(data?.Irn ?? irn),
      cancelDate: String(data?.CancelDate ?? ''),
    };
  }

  async getIrnDetails(irn: string): Promise<IrnResult | null> {
    try {
      const data = (await this.callCoreApi(`${GET_IRN_PATH}/${encodeURIComponent(irn)}`, null, 'GET')) as Record<
        string,
        unknown
      >;
      if (!data?.Irn) return null;
      return {
        irn: String(data.Irn),
        ackNo: String(data.AckNo ?? ''),
        ackDt: String(data.AckDt ?? ''),
        signedInvoice: (data.SignedInvoice as string) || undefined,
        signedQrCode: String(data.SignedQRCode ?? ''),
        status: String(data.Status ?? 'ACT'),
      };
    } catch (err) {
      logError('IRP get-IRN-details failed', err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  }
}
