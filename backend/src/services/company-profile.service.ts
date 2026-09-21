/**
 * Company Profile — the single source of truth for who we are on a document.
 *
 * Replaces four scattered sources (COMPANY_CONFIG, the frontend's copy of it,
 * COMPANY_STATE_ID, and seed-script literals). Every masthead, letterhead and
 * CGST/SGST-vs-IGST decision resolves through here.
 *
 * MULTI-ENTITY: several rows may exist; exactly one has isDefault = true and that one is
 * used everywhere. Nothing selects an entity per transaction.
 *
 * Two-tier cache, because the callers are split:
 *   - async callers (gst.service, company-block, e-invoice) await getDefault()
 *   - SYNC callers (document-generator's PDFKit render helpers, which take (doc, y) and
 *     cannot be made async without rippling through the whole generator) read the snapshot
 *
 * The snapshot is last-known-good and NEVER expires; the TTL only decides when a read
 * refreshes it. That is deliberate: a document must never render a blank or stale-empty
 * letterhead because a cache entry aged out mid-request.
 */
import prisma from '../config/database';
import type { company_profile } from '@prisma/client';
import { COMPANY_CONFIG } from '../config/company.config';
import { NotFoundError, ValidationError } from '../errors';
import { logInfo, logError } from '../utils/logger';

/**
 * What a document actually needs. Identity fields are non-optional here because a document
 * that cannot name the seller is not a document.
 */
export interface CompanySnapshot {
  id: string;
  name: string;
  legalName: string;
  gstin: string;
  pan: string | null;
  msmeNumber: string | null;
  cin: string | null;
  iec: string | null;
  tan: string | null;
  stateCode: string;
  stateName: string;
  stateId: string | null;
  address: string;
  city: string;
  pincode: string;
  addressLine: string;
  /** Accounts-side contact — what invoices, POs and challans print. */
  phone: string | null;
  email: string | null;
  /** The named lab/TRF contact, with their own number. Not the accounts contact. */
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  website: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  bankIfscCode: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  tagline: string;
  invoiceTerms: string | null;
  jurisdiction: string | null;
  brandColors: {
    primary: string;
    accent: string;
    header: string;
    text: string;
    muted: string;
  };
}

/**
 * Thrown when a statutory document is built before the profile cache is warm. Callers must
 * NOT catch this and substitute config values — printing the wrong GSTIN invalidates an
 * invoice, so failing loudly is the correct behaviour.
 */
export class CompanyProfileNotLoadedError extends Error {
  constructor() {
    super(
      'Company profile is not loaded yet — cannot build a document. ' +
        'Check that companyProfileService.ensureSeededAndWarm() ran at boot, ' +
        'or configure the company under Settings → Company Profile.'
    );
    this.name = 'CompanyProfileNotLoadedError';
  }
}

const DEFAULT_TAGLINE = 'Proprietorship · Contract & Private Label Manufacturing';

export interface CompanyProfileCreateInput {
  name: string;
  legalName: string;
  gstin: string;
  pan?: string | null;
  msmeNumber?: string | null;
  cin?: string | null;
  iec?: string | null;
  tan?: string | null;
  stateCode: string;
  stateName: string;
  stateId?: string | null;
  address: string;
  city: string;
  pincode: string;
  phone?: string | null;
  email?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  website?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountNumber?: string | null;
  bankIfscCode?: string | null;
  tagline?: string | null;
  invoiceTerms?: string | null;
  jurisdiction?: string | null;
  brandColorPrimary?: string | null;
  brandColorAccent?: string | null;
  brandColorHeader?: string | null;
  brandColorText?: string | null;
  brandColorMuted?: string | null;
  isActive?: boolean;
}

export type CompanyProfileUpdateInput = Partial<CompanyProfileCreateInput>;

class CompanyProfileService {
  /** Last-known-good. Never cleared once set — only replaced by a successful read. */
  private snapshot: CompanySnapshot | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 60 * 1000;

  // ───────────────────────────── reads ─────────────────────────────

  /**
   * The default entity's row. Throws if none exists — callers that can tolerate absence
   * should use ensureSeededAndWarm() at boot instead of defending here.
   */
  async getDefaultRow(): Promise<company_profile> {
    const row = await prisma.company_profile.findFirst({ where: { isDefault: true } });
    if (!row) {
      throw new NotFoundError('No default company profile is configured');
    }
    return row;
  }

  /** Async accessor. Refreshes the snapshot when the TTL has lapsed. */
  async getDefault(): Promise<CompanySnapshot> {
    if (this.snapshot && Date.now() < this.cacheExpiresAt) {
      return this.snapshot;
    }
    try {
      const row = await prisma.company_profile.findFirst({ where: { isDefault: true } });
      if (row) {
        this.setSnapshot(row);
        return this.snapshot as CompanySnapshot;
      }
    } catch (error) {
      // A transient DB blip must not discard a good snapshot — fall through and reuse it.
      logError('Company profile refresh failed; reusing last-known-good snapshot', error);
    }
    if (this.snapshot) return this.snapshot;
    throw new CompanyProfileNotLoadedError();
  }

  /**
   * Synchronous accessor for PDFKit render helpers.
   * THROWS when cold rather than falling back to COMPANY_CONFIG: a silent fallback is how a
   * superseded GSTIN reaches a printed tax invoice.
   */
  getCompanySync(): CompanySnapshot {
    if (!this.snapshot) throw new CompanyProfileNotLoadedError();
    return this.snapshot;
  }

  /** For cosmetic, non-statutory callers only (e.g. a WhatsApp share message). */
  getCompanySyncOrNull(): CompanySnapshot | null {
    return this.snapshot;
  }

  async list(): Promise<company_profile[]> {
    return prisma.company_profile.findMany({
      orderBy: [{ isDefault: 'desc' }, { isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async getById(id: string): Promise<company_profile> {
    const row = await prisma.company_profile.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Company profile not found');
    return row;
  }

  // ───────────────────────────── writes ─────────────────────────────

  async create(data: CompanyProfileCreateInput): Promise<company_profile> {
    await this.assertGstinFree(data.gstin);
    // The very first entity must be the default, or nothing can render a document.
    const isFirst = (await prisma.company_profile.count()) === 0;

    const row = await prisma.company_profile.create({
      data: {
        // Required — listed explicitly so Prisma type-checks them rather than trusting a spread.
        name: data.name,
        legalName: data.legalName,
        gstin: data.gstin,
        stateCode: data.stateCode,
        stateName: data.stateName,
        address: data.address,
        city: data.city,
        pincode: data.pincode,
        // Optional
        ...this.toWriteData({
          pan: data.pan,
          msmeNumber: data.msmeNumber,
          cin: data.cin,
          iec: data.iec,
          tan: data.tan,
          stateId: data.stateId,
          phone: data.phone,
          email: data.email,
          contactPerson: data.contactPerson,
          contactPhone: data.contactPhone,
          contactEmail: data.contactEmail,
          website: data.website,
          bankName: data.bankName,
          bankBranch: data.bankBranch,
          bankAccountNumber: data.bankAccountNumber,
          bankIfscCode: data.bankIfscCode,
          tagline: data.tagline,
          invoiceTerms: data.invoiceTerms,
          jurisdiction: data.jurisdiction,
          brandColorPrimary: data.brandColorPrimary,
          brandColorAccent: data.brandColorAccent,
          brandColorHeader: data.brandColorHeader,
          brandColorText: data.brandColorText,
          brandColorMuted: data.brandColorMuted,
          isActive: data.isActive,
        }),
        isDefault: isFirst,
      },
    });

    await this.warm();
    return row;
  }

  async update(id: string, data: CompanyProfileUpdateInput): Promise<company_profile> {
    const existing = await this.getById(id);
    if (data.gstin && data.gstin !== existing.gstin) {
      await this.assertGstinFree(data.gstin, id);
    }
    // Archiving the entity every document depends on would leave the system with no default.
    if (data.isActive === false && existing.isDefault) {
      throw new ValidationError('Cannot archive the default company entity. Make another entity the default first.');
    }

    const row = await prisma.company_profile.update({
      where: { id },
      data: this.toWriteData(data),
    });

    await this.warm();
    return row;
  }

  /**
   * Demote-then-promote in one transaction. The partial unique index
   * `company_profile_single_default` is the backstop if this is ever bypassed.
   */
  async setDefault(id: string): Promise<company_profile> {
    const target = await this.getById(id);
    if (!target.isActive) {
      throw new ValidationError('Cannot make an archived entity the default. Reactivate it first.');
    }
    if (target.isDefault) return target;

    const [, promoted] = await prisma.$transaction([
      prisma.company_profile.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      }),
      prisma.company_profile.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    await this.warm();
    logInfo(`Default company entity switched to ${promoted.name} (${promoted.gstin})`);
    return promoted;
  }

  // ───────────────────────── boot / cache ─────────────────────────

  /**
   * Boot hook. Mirrors PermissionService.ensureSeeded() — self-heals rather than refusing to
   * start, so a missing row can never take the API down on a shared PM2 box.
   *
   * Seeds row #1 from COMPANY_CONFIG when the table is empty, promotes an orphaned row when
   * nothing is default, then warms the snapshot so the sync accessor is never cold.
   */
  async ensureSeededAndWarm(): Promise<void> {
    try {
      const total = await prisma.company_profile.count();

      if (total === 0) {
        const created = await prisma.company_profile.create({
          data: {
            name: COMPANY_CONFIG.name,
            legalName: COMPANY_CONFIG.name,
            gstin: COMPANY_CONFIG.gstin,
            pan: COMPANY_CONFIG.panNumber ?? null,
            msmeNumber: COMPANY_CONFIG.msmeNumber ?? null,
            cin: COMPANY_CONFIG.cinNumber ?? null,
            stateCode: COMPANY_CONFIG.stateCode,
            stateName: COMPANY_CONFIG.state,
            address: COMPANY_CONFIG.address,
            city: COMPANY_CONFIG.city,
            pincode: COMPANY_CONFIG.pincode,
            phone: COMPANY_CONFIG.phone,
            email: COMPANY_CONFIG.email,
            website: COMPANY_CONFIG.website ?? null,
            tagline: DEFAULT_TAGLINE,
            brandColorPrimary: COMPANY_CONFIG.brandColors?.primary ?? null,
            brandColorAccent: COMPANY_CONFIG.brandColors?.accent ?? null,
            brandColorHeader: COMPANY_CONFIG.brandColors?.header ?? null,
            brandColorText: COMPANY_CONFIG.brandColors?.text ?? null,
            brandColorMuted: COMPANY_CONFIG.brandColors?.muted ?? null,
            isActive: true,
            isDefault: true,
          },
        });
        logInfo(`Seeded company profile from config: ${created.name} (${created.gstin})`);
      } else {
        const hasDefault = await prisma.company_profile.count({ where: { isDefault: true } });
        if (hasDefault === 0) {
          const oldest = await prisma.company_profile.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
          });
          if (oldest) {
            await prisma.company_profile.update({
              where: { id: oldest.id },
              data: { isDefault: true },
            });
            logInfo(`Promoted ${oldest.name} to default company entity`);
          }
        }
      }

      await this.warm();
      const snap = this.snapshot;
      if (snap) {
        logInfo(`🏢 Company profile loaded: ${snap.name} — GSTIN ${snap.gstin} (state ${snap.stateCode})`);
      } else {
        logError('Company profile could not be loaded — documents will refuse to render until it is set');
      }
    } catch (error) {
      // allow-swallow — deliberate, and the ONLY swallow in this service.
      //
      // This runs at boot on a PM2 daemon shared with three other businesses, so a bad company
      // row must not take the API down and keep it down. The failure is not hidden: it is
      // logged at error level, and because the snapshot stays cold, getCompanySync() throws
      // CompanyProfileNotLoadedError on the first document anyone tries to render — loud at
      // the point where it actually matters, instead of a silent wrong GSTIN.
      // Every other write path (create/update/setDefault) propagates normally.
      logError(
        'Company profile boot seed/warm FAILED — the API is up, but every document will refuse ' +
          'to render until a default company entity exists. Fix it under Settings → Company Profile.',
        error
      );
    }
  }

  /** Force-refresh the snapshot from the DB. */
  async warm(): Promise<void> {
    const row = await prisma.company_profile.findFirst({ where: { isDefault: true } });
    if (row) this.setSnapshot(row);
  }

  private setSnapshot(row: company_profile): void {
    this.snapshot = this.toSnapshot(row);
    this.cacheExpiresAt = Date.now() + this.CACHE_TTL_MS;
  }

  /**
   * Row → snapshot.
   *
   * MERGE RULE: identity fields (name, legalName, gstin, pan, msme, cin, iec, tan, state,
   * address, city, pincode) come from the DB row ONLY — never from COMPANY_CONFIG. Once a row
   * exists it is authoritative, so a stale constant can't reach a statutory document.
   * Only cosmetic fields (tagline, brand colours) fall back.
   */
  private toSnapshot(row: company_profile): CompanySnapshot {
    return {
      id: row.id,
      name: row.name,
      legalName: row.legalName,
      gstin: row.gstin,
      pan: row.pan,
      msmeNumber: row.msmeNumber,
      cin: row.cin,
      iec: row.iec,
      tan: row.tan,
      stateCode: row.stateCode,
      stateName: row.stateName,
      stateId: row.stateId,
      address: row.address,
      city: row.city,
      pincode: row.pincode,
      addressLine: `${row.address}, ${row.city} ${row.pincode}`,
      phone: row.phone,
      email: row.email,
      contactPerson: row.contactPerson,
      contactPhone: row.contactPhone,
      contactEmail: row.contactEmail,
      website: row.website,
      bankName: row.bankName,
      bankBranch: row.bankBranch,
      bankAccountNumber: row.bankAccountNumber,
      bankIfscCode: row.bankIfscCode,
      logoUrl: row.logoUrl,
      signatureUrl: row.signatureUrl,
      tagline: row.tagline ?? DEFAULT_TAGLINE,
      invoiceTerms: row.invoiceTerms,
      jurisdiction: row.jurisdiction,
      brandColors: {
        primary: row.brandColorPrimary ?? COMPANY_CONFIG.brandColors?.primary ?? '#B85C38',
        accent: row.brandColorAccent ?? COMPANY_CONFIG.brandColors?.accent ?? '#C49A2A',
        header: row.brandColorHeader ?? COMPANY_CONFIG.brandColors?.header ?? '#C4522A',
        text: row.brandColorText ?? COMPANY_CONFIG.brandColors?.text ?? '#1C1A15',
        muted: row.brandColorMuted ?? COMPANY_CONFIG.brandColors?.muted ?? '#6B665E',
      },
    };
  }

  private async assertGstinFree(gstin: string, exceptId?: string): Promise<void> {
    const clash = await prisma.company_profile.findUnique({ where: { gstin } });
    if (clash && clash.id !== exceptId) {
      throw new ValidationError(`Another company entity already uses GSTIN ${gstin}`);
    }
  }

  /** Strips undefined so a partial update never nulls a field the client didn't send. */
  private toWriteData(data: CompanyProfileUpdateInput): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) out[key] = value;
    }
    return out;
  }

  /** Logo / signature paths are written by the upload route, not by the update schema. */
  async setAssetUrl(id: string, field: 'logoUrl' | 'signatureUrl', url: string): Promise<company_profile> {
    const row = await prisma.company_profile.update({
      where: { id },
      data: { [field]: url },
    });
    await this.warm();
    return row;
  }
}

export const companyProfileService = new CompanyProfileService();
