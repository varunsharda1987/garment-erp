import prisma from '../config/database';
import { einvoice_settings } from '@prisma/client';
import { logInfo } from '../utils/logger';

const SINGLETON_ID = 'singleton';

const SANDBOX_BASE_URL = 'https://einv-apisandbox.nic.in';
const PRODUCTION_BASE_URL = 'https://einvoice1.gst.gov.in';

export type EInvoiceSettings = einvoice_settings;

export interface EInvoiceSettingsUpdateInput {
  einvEnabled?: boolean;
  einvMode?: string;
  einvProvider?: string;
  einvBaseUrl?: string | null;
  einvClientId?: string;
  einvClientSecret?: string;
  einvApiUsername?: string;
  einvApiPassword?: string;
  einvGstin?: string;
  einvPublicKeyPem?: string | null;
  einvAutoGenerateOnCreate?: boolean;
}

class EInvoiceSettingsService {
  private cachedSettings: EInvoiceSettings | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 60 * 1000; // 1 minute

  async get(): Promise<EInvoiceSettings> {
    if (this.cachedSettings && Date.now() < this.cacheExpiresAt) {
      return this.cachedSettings;
    }

    let settings = await prisma.einvoice_settings.findUnique({
      where: { id: SINGLETON_ID },
    });

    if (!settings) {
      settings = await prisma.einvoice_settings.create({
        data: { id: SINGLETON_ID },
      });
      logInfo('Created default e-Invoice settings row');
    }

    this.cachedSettings = settings;
    this.cacheExpiresAt = Date.now() + this.CACHE_TTL_MS;

    return settings;
  }

  async update(input: EInvoiceSettingsUpdateInput): Promise<EInvoiceSettings> {
    const settings = await prisma.einvoice_settings.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        ...input,
      },
      update: input,
    });

    this.invalidateCache();
    return settings;
  }

  async isEnabled(): Promise<boolean> {
    const settings = await this.get();
    return settings.einvEnabled;
  }

  getResolvedBaseUrl(settings: EInvoiceSettings): string {
    if (settings.einvBaseUrl?.trim()) return settings.einvBaseUrl.trim().replace(/\/+$/, '');
    return settings.einvMode === 'PRODUCTION' ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;
  }

  async ensureConfigured(): Promise<EInvoiceSettings> {
    const settings = await this.get();
    if (!settings.einvEnabled) {
      throw new Error('e-Invoicing is disabled. Enable it in Settings → GST e-Invoice.');
    }
    const missing: string[] = [];
    if (!settings.einvClientId.trim()) missing.push('Client ID');
    if (!settings.einvClientSecret.trim()) missing.push('Client Secret');
    if (!settings.einvApiUsername.trim()) missing.push('API Username');
    if (!settings.einvApiPassword.trim()) missing.push('API Password');
    if (!settings.einvGstin.trim()) missing.push('Seller GSTIN');
    if (missing.length > 0) {
      throw new Error(
        `e-Invoice credentials incomplete: ${missing.join(', ')} not set. Configure them in Settings → GST e-Invoice.`
      );
    }
    return settings;
  }

  private invalidateCache(): void {
    this.cachedSettings = null;
    this.cacheExpiresAt = 0;
  }
}

export const einvoiceSettingsService = new EInvoiceSettingsService();
