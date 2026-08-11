/**
 * NIC e-Invoice RSA public key resolution.
 *
 * The NIC sandbox/production public keys are downloadable only AFTER logging in
 * to the respective portal (einv-apisandbox.nic.in → API Credentials → Public Key),
 * so no key is bundled here. Paste the downloaded PEM into
 * Settings → GST e-Invoice → "NIC Public Key" (einvPublicKeyPem).
 */

import { EInvoiceSettings } from '../services/einvoice-settings.service';

export const BUNDLED_SANDBOX_KEY: string | null = null;

export function resolveNicPublicKey(settings: EInvoiceSettings): string {
  const pem = settings.einvPublicKeyPem?.trim() || BUNDLED_SANDBOX_KEY;
  if (!pem) {
    throw new Error(
      'NIC public key is not set. Log in to the e-Invoice portal ' +
        (settings.einvMode === 'PRODUCTION' ? '(einvoice1.gst.gov.in)' : '(einv-apisandbox.nic.in)') +
        ', download the Public Key, and paste it in Settings → GST e-Invoice.'
    );
  }
  // Accept a bare base64 key (portal sometimes serves .txt without PEM armor)
  if (!pem.includes('BEGIN')) {
    const wrapped = pem
      .replace(/\s+/g, '')
      .replace(/(.{64})/g, '$1\n')
      .trim();
    return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----`;
  }
  return pem;
}
