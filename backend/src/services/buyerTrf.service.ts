/**
 * Buyer Test Requirement Form (TRF) — service.
 *
 * Two jobs: ordinary CRUD, and buildPrefill(), which is where the value of this module
 * actually lives. The prefill is the ONE authority for deriving a TRF from a style: the form
 * calls it to populate the screen, and create() calls the same function for anything the
 * client left undefined. Two implementations would let a merchant's edit be silently reverted
 * by a server-side default, which is precisely what must not happen to the fibre-content field.
 */

import prisma from '../config/database';
import logger from '../utils/logger';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../errors';
import { applySearch } from '../utils/search-filter';
import { generateAtomicMasterCode } from '../utils/atomicCodeGenerator';
import {
  CreateBuyerTrfInput,
  UpdateBuyerTrfInput,
  BuyerTrfQueryInput,
  BUYER_TRF_UPDATABLE_FIELDS,
} from '../schemas/buyerTrf.schema';
import { EASYBUY_TRF_DEFAULTS, TRF_BO_NUMBER_NOT_REQUIRED } from '../constants/buyer-trf.constants';
import { washCareService } from './washCare.service';
import { companyProfileService } from './company-profile.service';
import { LAB_ROUND_TEST_SELECT, latestRoundForSample, roundResult } from './helpers/lab-round.helper';
import { weaverLabel, type WeaverShare } from './helpers/weaver-lineage.helper';

/** Fields the list screen searches. Registered in listSearchCoverage.test.ts. */
const TRF_SEARCH_FIELDS = [
  'trfNumber',
  'styleNo',
  'buyerStyleRef',
  'orderNumber',
  'colour',
  'sampleDescription',
  'style.styleCode',
  'style.styleName',
  'customer.name',
] as const;

const LIST_INCLUDE = {
  style: { select: { id: true, styleCode: true, styleName: true } },
  customer: { select: { id: true, name: true, code: true } },
  testingLab: { select: { id: true, labName: true, labCode: true } },
  workOrder: { select: { id: true, workOrderNumber: true } },
  saleOrder: { select: { id: true, saleOrderNumber: true, buyerPoNumber: true } },
  sample: { select: { id: true, sampleNumber: true, sampleType: true, status: true } },
  // The lab round's results. Tests reach their sample only through this TRF (trfId is unique).
  fabricTest: { select: LAB_ROUND_TEST_SELECT },
  garmentTest: { select: LAB_ROUND_TEST_SELECT },
} satisfies Prisma.buyer_test_requirement_formsInclude;

/** Sample type -> the buyer sheet's two-value sample stage. Other types are left for the merchant. */
const SAMPLE_STAGE_BY_TYPE: Partial<Record<string, 'PP' | 'SHIPMENT'>> = {
  PP_SAMPLE: 'PP',
  SHIPMENT_SAMPLE: 'SHIPMENT',
};

/**
 * Printed labels pushed straight onto `missing` (not via note()), mapped to their field - so a retest
 * round that carries a value over from the previous sheet can drop the stale "missing" warning.
 */
const MISSING_LABEL_FIELD: Record<string, string> = {
  'End Use': 'endUse',
  'Season (buyer code)': 'season',
  'Wash Care Code': 'washCareCode',
  Buyer: 'customerId',
};

/** Never carried from one lab round to the next: the new round has its own date, status and anchor. */
const NOT_CARRIED_TO_RETEST = new Set([
  'status',
  'trfDate',
  'workOrderId',
  'saleOrderId',
  'packageType',
  'previousReportNo',
]);

/** Attach the round's verdict so no client re-derives it. */
function withLabResult<T extends Parameters<typeof roundResult>[0]>(
  trf: T
): T & { labResult: ReturnType<typeof roundResult> } {
  return { ...trf, labResult: roundResult(trf) };
}

export interface TrfPrefillResult {
  values: Record<string, unknown>;
  /** Printed labels of the fields that could not be derived. Drives the form's warning, and
   *  these print as a hand-fill hatch rather than as text. */
  missingFields: string[];
  /** Where each derived value came from, e.g. "greige Viscose Crepe 30×30 (CAD row)".
   *  Exists so a wrong prefill can be traced without re-running the queries by hand. */
  sources: Record<string, string>;
}

class BuyerTrfService {
  /* ───────────────────────────────── Prefill ───────────────────────────────── */

  /**
   * Derive everything a TRF can know from a style plus its anchor.
   *
   * Never throws on missing data beyond the style and anchor themselves. Most Easybuy styles
   * lack a colour (2 of 56 have one), all lack an ageGroup, and nearly all lack a season — a
   * TRF still has to be creatable for them, so gaps are reported, not enforced.
   */
  async buildPrefill(
    styleId: string,
    anchor: { workOrderId?: string; saleOrderId?: string },
    round: { sampleId?: string; retestOfTrfId?: string } = {}
  ): Promise<TrfPrefillResult> {
    const values: Record<string, unknown> = {};
    const sources: Record<string, string> = {};
    const missing: string[] = [];
    const labelField: Record<string, string> = { ...MISSING_LABEL_FIELD };

    const note = (field: string, value: unknown, source: string, label: string) => {
      labelField[label] = field;
      if (value === null || value === undefined || value === '') {
        missing.push(label);
        return;
      }
      values[field] = value;
      sources[field] = source;
    };

    /* ── Style ── */
    const style = await prisma.styles.findUnique({
      where: { id: styleId },
      include: {
        product_category: { include: { parent: { select: { name: true } } } },
        color: { select: { colorName: true } },
        color_options: { where: { isActive: true }, take: 1, select: { colorName: true } },
      },
    });
    if (!style) throw new NotFoundError('Style not found');

    note('styleNo', style.styleCode, 'styles.styleCode', 'Style No.');
    values.buyerStyleRef = style.buyerStyleRef ?? style.styleCode;
    note('brandName', style.brandName, 'styles.brandName', 'Brand Name');

    const category = style.product_category;
    note('sampleDescription', category?.name?.toUpperCase(), 'product category', 'Sample Description');
    // "TUNIC(TOP)" — the category inside its parent. With no parent there is no meaningful
    // End Use, and printing "TUNIC()" would be worse than leaving it for hand-fill.
    if (category?.name && category.parent?.name) {
      note(
        'endUse',
        `${category.name.toUpperCase()}(${category.parent.name.toUpperCase()})`,
        'product category + parent',
        'End Use'
      );
    } else {
      missing.push('End Use');
    }

    // gender is the one style field that is reliably filled (1001 of 1130 rows); ageGroup is
    // empty on every row, so it is deliberately not consulted.
    const GENDER_LABEL: Record<string, string> = {
      WOMEN: "WOMEN'S",
      MEN: "MEN'S",
      KIDS: 'KIDS',
      UNISEX: 'UNISEX',
    };
    note('ageRangeCategory', style.gender ? GENDER_LABEL[style.gender] : null, 'styles.gender', 'Age Range/Category');

    // Season is NOT derived: seasonId is set on 14 of 1130 styles, and the buyer's code
    // ("S10-26") is a different vocabulary from our SS26/AW26 anyway. Typed per form.
    missing.push('Season (buyer code)');

    /* ── Anchor → order number + customer ── */
    let customerId: string | null = null;

    if (anchor.saleOrderId) {
      const so = await prisma.sale_orders.findUnique({
        where: { id: anchor.saleOrderId },
        select: {
          saleOrderNumber: true,
          buyerPoNumber: true,
          customerId: true,
          items: {
            where: { styleId },
            select: { buyerStyleRef: true, color: { select: { colorName: true } } },
            take: 1,
          },
        },
      });
      if (!so) throw new NotFoundError('Sale order not found');
      customerId = so.customerId;
      note('orderNumber', so.buyerPoNumber?.trim(), `sale order ${so.saleOrderNumber}`, 'Order Number');
      const item = so.items[0];
      if (item?.buyerStyleRef) values.buyerStyleRef = item.buyerStyleRef;
      if (item?.color?.colorName) {
        values.colour = item.color.colorName;
        sources.colour = `sale order ${so.saleOrderNumber} line`;
      }
    } else if (anchor.workOrderId) {
      const wo = await prisma.work_orders.findUnique({
        where: { id: anchor.workOrderId },
        select: {
          workOrderNumber: true,
          styleId: true,
          orders: {
            select: {
              orderNumber: true,
              customerId: true,
              sale_orders: { select: { buyerPoNumber: true, saleOrderNumber: true } },
            },
          },
        },
      });
      if (!wo) throw new NotFoundError('Work order not found');
      // A work order for a different style would silently print the wrong garment's data.
      if (wo.styleId !== styleId) {
        throw new ValidationError('That work order belongs to a different style');
      }
      customerId = wo.orders?.customerId ?? null;
      const buyerPo = wo.orders?.sale_orders?.buyerPoNumber?.trim();
      note(
        'orderNumber',
        buyerPo || wo.orders?.orderNumber || wo.workOrderNumber,
        buyerPo ? 'buyer PO via work order' : `work order ${wo.workOrderNumber}`,
        'Order Number'
      );
    }

    // styles.customerId is null on all 1130 styles, so the denormalized name is the only
    // fallback — and the only path at all for the 20 Easybuy styles with no order yet.
    if (!customerId && style.customerName) {
      const byName = await prisma.customers.findFirst({
        where: { name: style.customerName, isActive: true },
        select: { id: true },
      });
      customerId = byName?.id ?? null;
    }

    if (customerId) {
      const customer = await prisma.customers.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          name: true,
          code: true,
          vendorCode: true,
          defaultTestingLabId: true,
          customer_contacts: {
            where: { isActive: true },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            take: 1,
            select: { name: true, email: true },
          },
        },
      });
      if (customer) {
        values.customerId = customer.id;
        sources.customerId = anchor.saleOrderId || anchor.workOrderId ? 'order' : 'styles.customerName';
        note('vendorCode', customer.vendorCode, `customer ${customer.name}`, 'Vendor Code');
        if (customer.defaultTestingLabId) values.testingLabId = customer.defaultTestingLabId;
        if (!values.brandName) values.brandName = customer.name;

        const contact = customer.customer_contacts[0];
        note('merchandiserName', contact?.name, 'customer contact', 'Buyer merchandiser name');
        note('merchandiserEmail', contact?.email, 'customer contact', 'Buyer merchandiser email');

        Object.assign(values, this.buyerDefaultsFor(customer.name));
      }
    } else {
      missing.push('Buyer');
    }

    /* ── Fabric, via the CAD row ── */
    Object.assign(values, await this.fabricPrefill(styleId, note));

    /* ── Us ── the DEFAULT entity, not just any active row.
       The buyer's lab rings the named TRF contact, NOT the accounts contact that invoices
       print — hence contactPhone/contactEmail rather than phone/email. The two shared one
       pair of columns until 2026-09-21. Falls back to the main contact if no lab contact is
       set, which is the behaviour these three fields had before the split. */
    const company = await companyProfileService.getDefault();
    values.manufacturerName = company.name;
    sources.manufacturerName = 'company profile';
    note('applicantContact', company.contactPerson, 'company profile', 'Our contact name');
    note('applicantPhone', company.contactPhone ?? company.phone, 'company profile', 'Our telephone');
    note('applicantEmail', company.contactEmail ?? company.email, 'company profile', 'Our email');

    if (values.boNumber === undefined) values.boNumber = TRF_BO_NUMBER_NOT_REQUIRED;

    /* ── Wash care: the pair (customer, fabric), never the fabric alone ──
       The same fabric carries different care codes for different customers, so this can only be
       resolved once BOTH are known — which is why it sits here rather than in fabricPrefill.
       No fabric-level fallback: with nothing recorded the field prints a hatched blank. */
    const washCustomerId = values.customerId as string | undefined;
    const washGreigeId = values.greigeId as string | undefined;
    if (washCustomerId && washGreigeId) {
      const row = await washCareService.resolve(washCustomerId, washGreigeId, null);
      note('washCareCode', row?.washCareCode, `${row?.customer?.name ?? 'customer'} + this fabric`, 'Wash Care Code');
    } else {
      missing.push('Wash Care Code');
    }

    /* -- The sample this round is for -- */
    if (round.sampleId) {
      const sample = await this.assertSampleFits(round.sampleId, styleId, values.customerId as string | undefined);
      values.sampleId = sample.id;
      sources.sampleId = `sample ${sample.sampleNumber}`;
      const stage = SAMPLE_STAGE_BY_TYPE[sample.sampleType];
      if (stage) {
        values.sampleStage = stage;
        sources.sampleStage = `sample ${sample.sampleNumber} (${sample.sampleType})`;
      }
    }

    /* -- A retest round: the previous sheet, carried over --
       The previous TRF already holds what the merchant corrected by hand ("100% RAYON", the buyer's
       season code, the ticked tests). Re-deriving would silently revert those, so its printed values
       win over the fresh derivation; only the round's own facts (date, status, anchor) are new. */
    if (round.retestOfTrfId) {
      const previous = await this.retestSource(round.retestOfTrfId, styleId);
      for (const [field, value] of Object.entries(this.pickWritableFields(previous.row))) {
        if (NOT_CARRIED_TO_RETEST.has(field) || value === null) continue;
        values[field] = value;
        sources[field] = `previous round ${previous.row.trfNumber}`;
      }
      values.packageType = 'RETEST';
      sources.packageType = `retest of ${previous.row.trfNumber}`;
      if (previous.reportNumber) {
        values.previousReportNo = previous.reportNumber;
        sources.previousReportNo = `lab report on ${previous.row.trfNumber}`;
      } else {
        missing.push('Previous report no.');
      }
    }

    const stillMissing = [...new Set(missing)].filter((label) => {
      const field = labelField[label];
      return !field || values[field] === undefined || values[field] === null || values[field] === '';
    });
    return { values, missingFields: stillMissing, sources };
  }

  /**
   * Fabric block: fibre content, count, construction, weight, processor, supplier.
   *
   * The CAD row is reached through a 3-path OR because a style's CAD rows hang off either
   * `costingStyleId` (legacy writer) or `styleFabricId` (modern writer) — see the same OR in
   * cutting.controller.ts. A single-path query finds nothing for a large share of styles.
   * The orderBy is what makes the choice deterministic: without it two identical requests can
   * pick different greiges and print different counts.
   */
  private async fabricPrefill(
    styleId: string,
    note: (field: string, value: unknown, source: string, label: string) => void
  ): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};

    const cadRows = await prisma.fabric_width_cad.findMany({
      where: {
        OR: [
          { costingStyleId: styleId },
          { styleFabric: { style_components: { styleId } } },
          { styleCosting: { styleId } },
        ],
      },
      include: {
        greige: {
          select: {
            id: true,
            greigeName: true,
            composition: true,
            yarnCount: true,
            construction: true,
            weaveType: true,
            gsmRange: true,
            supplierId: true,
          },
        },
        processor: { select: { name: true } },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });

    const row = cadRows.find((r) => r.greige) ?? cadRows[0];
    const greige = row?.greige;

    if (!greige) {
      for (const label of ['Fiber Content', 'Count', 'Construction', 'Fabric Weight', 'Wash Care Code']) {
        note('__missing__', null, '', label);
      }
      return out;
    }

    // Stored on the form so a code typed there can be remembered against (customer, fabric)
    // without re-walking the CAD chain, and so a reprint can say which fabric it described.
    out.greigeId = greige.id;

    const src = `greige ${greige.greigeName}`;
    note('fibreContent', greige.composition, src, 'Fiber Content');
    note('yarnCount', greige.yarnCount, src, 'Count');
    note('construction', greige.construction, src, 'Construction');
    note('fabricWeightGsm', greige.gsmRange, src, 'Fabric Weight');

    // Knit vs woven decides which Package box is ticked. Plain/twill/satin are wovens; the
    // buyer's sheet only offers the two, so anything that does not read as a knit stays WOVEN.
    if (greige.weaveType) {
      out.packageType = /knit|jersey|rib|interlock|fleece/i.test(greige.weaveType) ? 'KNIT' : 'WOVEN';
    }

    // Both houses default to the processor the CAD row was costed against. They are separate
    // editable fields because the processor changes lot to lot and dyeing is not always the
    // same vendor as finishing — the form records whoever it actually was.
    note('processingHouse', row?.processor?.name, 'CAD row processor', 'Processing House');

    // The greige's own supplier is the weaver. Fall back to whoever actually supplied it for
    // this style, since greige_master.supplierId is unset on most rows.
    let supplierName: string | null = null;
    if (greige.supplierId) {
      const s = await prisma.suppliers.findUnique({
        where: { id: greige.supplierId },
        select: { name: true },
      });
      supplierName = s?.name ?? null;
    }
    if (!supplierName) {
      const proc = await prisma.fabric_procurement.findFirst({
        where: { greigeId: greige.id, orderedForStyleId: styleId },
        orderBy: { createdAt: 'desc' },
        select: { supplier: { select: { name: true } } },
      });
      supplierName = proc?.supplier?.name ?? null;
    }
    // Last resort: the weaver of this style's own fabric (Phase 1b — the weaver lives on the lot, not
    // the greige master, whose retired weaver column is no longer read).
    let weaverName: string | null = null;
    if (!supplierName) {
      const lot = await prisma.fabric_stock.findFirst({
        where: { originStyleId: styleId, OR: [{ weaverId: { not: null } }, { weaverMix: { not: Prisma.DbNull } }] },
        orderBy: { receivedDate: 'desc' },
        select: { weaver: { select: { name: true } }, weaverMix: true },
      });
      weaverName = lot ? weaverLabel(lot.weaver?.name, lot.weaverMix as unknown as WeaverShare[] | null) : null;
    }
    note(
      'fabricSupplierName',
      supplierName ?? weaverName,
      supplierName ? 'greige supplier' : 'weaver of the style fabric',
      'Fabric Supplier Name'
    );

    return out;
  }

  /** Buyer-specific starting ticks. Easybuy's are the owner's (2026-09-19). */
  private buyerDefaultsFor(customerName: string): Record<string, unknown> {
    if (customerName.replace(/\s+/g, '').toLowerCase() !== 'easybuy') return {};
    return { ...EASYBUY_TRF_DEFAULTS };
  }

  /* ─────────────────────────────── Lab rounds ─────────────────────────────── */

  /**
   * A TRF may only name a sample of the same style and the same buyer - otherwise the sample page
   * would show another garment's lab result as its own. `customerId` is checked only when known.
   */
  private async assertSampleFits(sampleId: string, styleId: string, customerId: string | null | undefined) {
    const sample = await prisma.samples.findUnique({
      where: { id: sampleId },
      select: {
        id: true,
        sampleNumber: true,
        sampleType: true,
        styleId: true,
        customerId: true,
        styles: { select: { styleCode: true } },
      },
    });
    if (!sample) throw new ValidationError('That sample no longer exists');

    if (sample.styleId !== styleId) {
      const style = await prisma.styles.findUnique({ where: { id: styleId }, select: { styleCode: true } });
      throw new ValidationError(
        `Sample ${sample.sampleNumber} is for style ${sample.styles?.styleCode ?? '(none)'}, not ${style?.styleCode ?? 'the style on this form'}`
      );
    }
    if (customerId && sample.customerId !== customerId) {
      throw new ValidationError(`Sample ${sample.sampleNumber} belongs to a different buyer than this form`);
    }
    return sample;
  }

  /**
   * The round a retest follows. It must be this style's, it must have FAILED (a retest after a pass,
   * or before the result is in, is a mistake), and for a sample it must be the sample's latest round -
   * retesting an older round would fork the chain.
   */
  private async retestSource(trfId: string, styleId: string) {
    const row = await prisma.buyer_test_requirement_forms.findUnique({
      where: { id: trfId },
      include: { fabricTest: { select: LAB_ROUND_TEST_SELECT }, garmentTest: { select: LAB_ROUND_TEST_SELECT } },
    });
    if (!row || !row.isActive) throw new NotFoundError('Test requirement form to retest not found');
    if (row.styleId !== styleId) throw new ValidationError(`${row.trfNumber} is for a different style`);

    const result = roundResult(row);
    if (result !== 'FAIL') {
      throw new ValidationError(
        result === 'PASS'
          ? `${row.trfNumber} passed - a retest round follows a failed round`
          : `Record the lab result on ${row.trfNumber} before starting a retest round`
      );
    }
    if (row.sampleId) {
      const latest = await latestRoundForSample(row.sampleId);
      if (latest && latest.trfId !== row.id) {
        throw new ValidationError(`${latest.trfNumber} is this sample's latest round - start the retest from it`);
      }
    }
    return {
      row: row as unknown as Record<string, unknown> & { trfNumber: string },
      reportNumber: row.fabricTest?.testReportNumber ?? row.garmentTest?.testReportNumber ?? null,
    };
  }

  /* ───────────────────────────────── CRUD ───────────────────────────────── */

  async create(data: CreateBuyerTrfInput, userId: string) {
    const prefill = await this.buildPrefill(
      data.styleId,
      { workOrderId: data.workOrderId ?? undefined, saleOrderId: data.saleOrderId ?? undefined },
      { sampleId: data.sampleId ?? undefined }
    );

    // The client's values win; the prefill only fills what was left undefined. Anything the
    // merchant edited on screen therefore survives, including a fibre content changed from
    // "100% Viscose" to "100% RAYON".
    const merged: Record<string, unknown> = { ...prefill.values };
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) merged[key] = value;
    }

    const customerId = (merged.customerId as string | undefined) ?? undefined;
    if (!customerId) {
      throw new ValidationError('Could not work out which buyer this style belongs to — pick the customer on the form');
    }
    // Before the number is consumed, so a refused save does not burn a TRF number.
    if (merged.sampleId) await this.assertSampleFits(merged.sampleId as string, data.styleId, customerId);

    const trfNumber = await generateAtomicMasterCode('TRF', 4);

    const created = await prisma.buyer_test_requirement_forms.create({
      data: {
        ...(this.pickWritableFields(merged) as Prisma.buyer_test_requirement_formsCreateInput),
        trfNumber,
        styleId: data.styleId,
        customerId,
        createdById: userId,
      } as Prisma.buyer_test_requirement_formsUncheckedCreateInput,
      include: LIST_INCLUDE,
    });

    logger.info(`TRF ${created.trfNumber} created for style ${created.styleNo ?? data.styleId}`);

    // Learn the code for next time. Best-effort by design — failing to remember must never fail
    // the save the merchant actually asked for.
    void washCareService.rememberFromTrf(
      { customerId: created.customerId, greigeId: created.greigeId, washCareCode: created.washCareCode },
      userId
    );

    return withLabResult(created);
  }

  async getAll(params: BuyerTrfQueryInput) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const where: Prisma.buyer_test_requirement_formsWhereInput = {
      isActive: params.isActive ?? true,
      ...(params.status ? { status: params.status } : {}),
      ...(params.styleId ? { styleId: params.styleId } : {}),
      ...(params.customerId ? { customerId: params.customerId } : {}),
      ...(params.testingLabId ? { testingLabId: params.testingLabId } : {}),
      ...(params.sampleId ? { sampleId: params.sampleId } : {}),
      ...(params.sampleStage ? { sampleStage: params.sampleStage } : {}),
    };
    applySearch(where, params.search, TRF_SEARCH_FIELDS);

    const [data, total] = await Promise.all([
      prisma.buyer_test_requirement_forms.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { [params.sortBy ?? 'createdAt']: params.sortOrder ?? 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.buyer_test_requirement_forms.count({ where }),
    ]);

    return {
      data: data.map(withLabResult),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const trf = await prisma.buyer_test_requirement_forms.findUnique({
      where: { id },
      include: LIST_INCLUDE,
    });
    if (!trf) throw new NotFoundError('Test requirement form not found');
    return withLabResult(trf);
  }

  async update(id: string, data: UpdateBuyerTrfInput, userId?: string) {
    const existing = await prisma.buyer_test_requirement_forms.findUnique({
      where: { id },
      select: { id: true, workOrderId: true, saleOrderId: true, styleId: true, customerId: true, sampleId: true },
    });
    if (!existing) throw new NotFoundError('Test requirement form not found');

    // The merged anchor check. Zod validated the payload in isolation; only here can we see
    // that clearing saleOrderId on a row with no workOrderId would leave the TRF unanchored.
    const workOrderId = data.workOrderId !== undefined ? data.workOrderId : existing.workOrderId;
    const saleOrderId = data.saleOrderId !== undefined ? data.saleOrderId : existing.saleOrderId;
    const anchorCount = (workOrderId ? 1 : 0) + (saleOrderId ? 1 : 0);
    if (anchorCount !== 1) {
      throw new ValidationError(
        anchorCount === 0
          ? 'A TRF must stay linked to either a work order or a sale order'
          : 'A TRF can be linked to a work order or a sale order, not both'
      );
    }

    // The sample check on the MERGED row, for the same reason as the anchor check above.
    const sampleId = data.sampleId !== undefined ? data.sampleId : existing.sampleId;
    const customerId = data.customerId ?? existing.customerId;
    if (sampleId && (data.sampleId !== undefined || data.customerId !== undefined)) {
      await this.assertSampleFits(sampleId, existing.styleId, customerId);
    }

    const updated = await prisma.buyer_test_requirement_forms.update({
      where: { id },
      data: this.pickWritableFields(data) as Prisma.buyer_test_requirement_formsUpdateInput,
      include: LIST_INCLUDE,
    });

    // The form promises "remembered against this buyer and fabric when you save" - on an edit too,
    // not only on create. Best-effort, same as create.
    if (userId) {
      void washCareService.rememberFromTrf(
        { customerId: updated.customerId, greigeId: updated.greigeId, washCareCode: updated.washCareCode },
        userId
      );
    }
    return withLabResult(updated);
  }

  /** Soft delete — a TRF is a record of what was sent to a lab, so it is never hard-deleted. */
  async delete(id: string) {
    const existing = await prisma.buyer_test_requirement_forms.findUnique({
      where: { id },
      select: {
        id: true,
        trfNumber: true,
        fabricTest: { select: { testNumber: true } },
        garmentTest: { select: { testNumber: true } },
      },
    });
    if (!existing) throw new NotFoundError('Test requirement form not found');
    // A round with a lab result is evidence. Hiding it would also make the round BEFORE it the
    // sample's "latest", which can flip the Shipment Sample dispatch gate to an older pass.
    const linked = [existing.fabricTest?.testNumber, existing.garmentTest?.testNumber].filter(Boolean);
    if (linked.length > 0) {
      throw new ValidationError(
        `${existing.trfNumber} has a recorded lab result (${linked.join(', ')}) and cannot be removed`
      );
    }
    return prisma.buyer_test_requirement_forms.update({ where: { id }, data: { isActive: false } });
  }

  async recordPrint(id: string) {
    return prisma.buyer_test_requirement_forms.update({
      where: { id },
      data: { printCount: { increment: 1 }, lastPrintedAt: new Date() },
    });
  }

  /**
   * Narrow an arbitrary object to the columns that may be written.
   *
   * Iterating one shared list rather than hand-listing ~40 fields in two places is what stops
   * a field being accepted by the schema and silently dropped by the service.
   */
  private pickWritableFields(source: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of BUYER_TRF_UPDATABLE_FIELDS) {
      if (source[field] !== undefined) out[field] = source[field];
    }
    return out;
  }
}

export const buyerTrfService = new BuyerTrfService();
