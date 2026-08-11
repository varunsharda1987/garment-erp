import prisma from '../config/database';
import { tally_settings } from '@prisma/client';
import { logInfo } from '../utils/logger';

const SINGLETON_ID = 'singleton';

export type TallySettings = tally_settings;

export interface TallySettingsUpdateInput {
  tallyEnabled?: boolean;
  tallyHost?: string;
  tallyPort?: number;
  tallyCompanyName?: string | null;
  tallyPartyGroup?: string;
  tallyVoucherType?: string;
  tallySalesLedgerIntra?: string;
  tallySalesLedgerInter?: string;
  tallyCgstLedger?: string;
  tallySgstLedger?: string;
  tallyIgstLedger?: string;
  tallyCgstLedger18?: string;
  tallySgstLedger18?: string;
  tallyIgstLedger18?: string;
  tallyRoundOffLedger?: string;
  tallyFreightLedger?: string;
  tallyGodownName?: string;
  tallyStockUnit?: string;
}

class TallySettingsService {
  private cachedSettings: TallySettings | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 60 * 1000; // 1 minute

  async get(): Promise<TallySettings> {
    if (this.cachedSettings && Date.now() < this.cacheExpiresAt) {
      return this.cachedSettings;
    }

    let settings = await prisma.tally_settings.findUnique({
      where: { id: SINGLETON_ID },
    });

    if (!settings) {
      settings = await prisma.tally_settings.create({
        data: { id: SINGLETON_ID },
      });
      logInfo('Created default Tally settings row');
    }

    this.cachedSettings = settings;
    this.cacheExpiresAt = Date.now() + this.CACHE_TTL_MS;

    return settings;
  }

  async update(input: TallySettingsUpdateInput): Promise<TallySettings> {
    const settings = await prisma.tally_settings.upsert({
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
    return settings.tallyEnabled;
  }

  async getConnectionConfig(): Promise<{ host: string; port: number; company: string | null }> {
    const settings = await this.get();
    return {
      host: settings.tallyHost,
      port: settings.tallyPort,
      company: settings.tallyCompanyName,
    };
  }

  async ensureCompanyConfigured(): Promise<void> {
    const settings = await this.get();
    if (!settings.tallyCompanyName?.trim()) {
      throw new Error(
        'Tally company name is not configured. Set it in Settings → Tally to avoid pushing to the wrong company.'
      );
    }
  }

  private invalidateCache(): void {
    this.cachedSettings = null;
    this.cacheExpiresAt = 0;
  }
}

export const tallySettingsService = new TallySettingsService();
