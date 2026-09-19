/**
 * Buyer Test Requirement Form — document data.
 *
 * One query plus the print catalogue, flattened into exactly what buyer-trf.hbs renders.
 * No second fetch: if the template needs one, this adapter is wrong.
 *
 * The one judgement call worth stating. Most kf documents print an em-dash for an absent
 * value. This sheet must not: an em-dash in "Colour" reads to Intertek as "not applicable",
 * which is a different and wrong claim from "we did not record it". So a missing identity
 * value renders as the house diagonal hatch instead — the established signal that a human
 * completes this field after printing (base.css `.open` / `.open-box`).
 *
 * That is also why the ticks are NOT hatched. The design rule is "never hatch a
 * system-populated field", and a tick IS system-populated: the ERP knows Garment Wash is on.
 * Hatching them would invert the one rule the whole design system turns on.
 */

import prisma from '../../config/database';
import { NotFoundError } from '../../errors';
import { buildCompanyBlock, CompanyBlock } from './company-block';
import { fmtDate } from './format';
import {
  TRF_TESTS,
  TRF_BUYING_DEPARTMENTS,
  TRF_BUYING_SUB_CATEGORIES,
  TRF_FINISH_TYPES,
  TRF_PACKAGE_TYPES,
  TRF_SAMPLE_STAGES,
  TRF_SERVICE_LEVELS,
} from '../../constants/buyer-trf.constants';

/** A printed field: either a value, or a hatched blank for someone to complete by hand. */
interface PrintField {
  label: string;
  value: string | null;
  /** true → render the diagonal hatch instead of text. */
  hand: boolean;
}

/** A printed checkbox. `on` drives the filled square; the label is always shown. */
interface PrintTick {
  label: string;
  on: boolean;
}

export interface BuyerTrfDocData {
  company: CompanyBlock;
  docNo: string;
  docPill: string;
  trfDate: string;
  hideGstin: boolean;

  /**
   * Named fields, so the template can place each one in the exact cell the buyer's form
   * has it in. An array would only let us reflow them into a grid of our own choosing —
   * and the point of this sheet is that it reads like the form Intertek already knows.
   */
  f: Record<string, PrintField>;

  applicant: PrintField[];
  lab: PrintField[];
  identity: PrintField[];

  packageTicks: PrintTick[];
  previousReportNo: string | null;
  stageTicks: PrintTick[];
  finishTicks: PrintTick[];
  serviceTicks: PrintTick[];
  departmentTicks: PrintTick[];
  /** Three columns, matching the buyer's printed sub-grid. */
  subCategoryColumns: PrintTick[][];
  /** Three columns of 11, matching the buyer's printed test grid. */
  testColumns: PrintTick[][];

  yesNo: { label: string; yes: boolean; no: boolean }[];
  /** The same four, keyed, because each sits in its own cell of the buyer's table. */
  yn: Record<'contrast' | 'sets' | 'report' | 'return', { yes: boolean; no: boolean }>;
  remarks: string | null;
  /** Printed labels of everything left for hand-fill, for the footer note. */
  handFilled: string[];
}

const val = (label: string, value: unknown): PrintField => {
  const s = value === null || value === undefined ? '' : String(value).trim();
  return { label, value: s === '' ? null : s, hand: s === '' };
};

export async function buildBuyerTrfDocData(trfId: string): Promise<BuyerTrfDocData> {
  const trf = await prisma.buyer_test_requirement_forms.findUnique({
    where: { id: trfId },
    include: {
      style: { select: { styleCode: true, styleName: true } },
      customer: { select: { name: true } },
      testingLab: {
        select: { labName: true, address: true, city: true, state: true, pincode: true, contactEmail: true },
      },
      saleOrder: { select: { saleOrderNumber: true, buyerPoNumber: true } },
      workOrder: { select: { workOrderNumber: true } },
    },
  });
  if (!trf) throw new NotFoundError('Test requirement form not found');

  const company = await buildCompanyBlock();

  const applicant: PrintField[] = [
    val('Applicant Name & Billing', trf.manufacturerName ?? company.name),
    val('Address', company.addressLine),
    val('Contact Name', trf.applicantContact),
    val('Tel', trf.applicantPhone),
    val('Email', trf.applicantEmail),
    val("Manufacturer's Name", trf.manufacturerName ?? company.name),
  ];

  const labAddress = trf.testingLab
    ? [trf.testingLab.address, trf.testingLab.city, trf.testingLab.state, trf.testingLab.pincode]
        .filter(Boolean)
        .join(', ')
    : '';

  const lab: PrintField[] = [
    val('Testing Lab', trf.testingLab?.labName),
    val('Lab Address', labAddress),
    val('Easy Buy Merchandise', trf.merchandiserName),
    val("Merchandise E-Mail I'd", trf.merchandiserEmail),
  ];

  // Order exactly as the buyer's sheet reads, left to right then down.
  const identity: PrintField[] = [
    val('Sample Description', trf.sampleDescription),
    val('BO No', trf.boNumber),
    val('Style No.', trf.styleNo ?? trf.style?.styleCode),
    val('Color', trf.colour),
    val('Fiber Content', trf.fibreContent),
    val('Age Range/Category', trf.ageRangeCategory),
    val('End Use', trf.endUse),
    val('Order Number', trf.orderNumber),
    val('Fabric Weight', trf.fabricWeightGsm),
    val('Count', trf.yarnCount),
    val('Season', trf.season),
    val('Construction', trf.construction),
    val('Brand Name', trf.brandName ?? trf.customer?.name),
    val('Fabric Supplier Name', trf.fabricSupplierName),
    val('Dyeing House Name', trf.dyeingHouse),
    val('Vendor Code', trf.vendorCode),
    val('Processing House Name', trf.processingHouse),
    val('Wash Care Code', trf.washCareCode),
  ];

  const ticks = <T extends { code: string; label: string }>(
    catalogue: readonly T[],
    selected: string | string[] | null
  ): PrintTick[] => {
    const on = Array.isArray(selected) ? new Set<string>(selected) : new Set(selected ? [selected] : []);
    return catalogue.map((c) => ({ label: c.label, on: on.has(c.code) }));
  };

  const subByDepartment = (department: string) =>
    ticks(
      TRF_BUYING_SUB_CATEGORIES.filter((s) => s.department === department),
      trf.buyingSubCategories as unknown as string[]
    );

  const testColumns = ([1, 2, 3] as const).map((col) =>
    ticks(
      TRF_TESTS.filter((t) => t.column === col),
      trf.selectedTests as unknown as string[]
    )
  );

  // A tri-state null leaves BOTH boxes empty — the printed form then asks for a hand tick,
  // rather than asserting a NO nobody chose.
  const yesNo = [
    { label: 'Contrast/Trim Fabric is used within Garment', v: trf.contrastTrimUsed },
    { label: 'Style With Sets Packing Together with Different Color', v: trf.setsPackingDifferentColour },
    { label: 'Report Delivery Service', v: trf.reportDeliveryService },
    { label: 'Return Remained Sample', v: trf.returnRemainedSample },
  ].map((r) => ({ label: r.label, yes: r.v === true, no: r.v === false }));

  const tri = (v: boolean | null) => ({ yes: v === true, no: v === false });
  const yn = {
    contrast: tri(trf.contrastTrimUsed),
    sets: tri(trf.setsPackingDifferentColour),
    report: tri(trf.reportDeliveryService),
    return: tri(trf.returnRemainedSample),
  };

  const handFilled = [...applicant, ...lab, ...identity].filter((f) => f.hand).map((f) => f.label);

  // Keyed by the buyer's own field name, for exact placement in their table layout.
  const f: Record<string, PrintField> = {
    applicantName: val('Applicant Name & Billing Information', trf.manufacturerName ?? company.name),
    address: val('Address', company.addressLine),
    contactName: val('Contact Name', trf.applicantContact),
    tel: val('Tel', trf.applicantPhone),
    email: val('Email', trf.applicantEmail),
    merchandiserName: val('Name', trf.merchandiserName),
    merchandiserEmail: val("E-Mail I'd", trf.merchandiserEmail),
    sampleDescription: val('Sample Description', trf.sampleDescription),
    boNumber: val('BO No', trf.boNumber),
    styleNo: val('Style No.', trf.styleNo ?? trf.style?.styleCode),
    colour: val('Color', trf.colour),
    fibreContent: val('Fiber Content', trf.fibreContent),
    ageRangeCategory: val('Age Range/Category', trf.ageRangeCategory),
    endUse: val('End Use', trf.endUse),
    orderNumber: val('Order Number', trf.orderNumber),
    fabricWeight: val('Fabric Weight', trf.fabricWeightGsm),
    yarnCount: val('Count', trf.yarnCount),
    season: val('Season', trf.season),
    construction: val('Construction', trf.construction),
    manufacturerName: val("Manufacturer's Name", trf.manufacturerName ?? company.name),
    brandName: val('Brand Name', trf.brandName ?? trf.customer?.name),
    fabricSupplierName: val('Fabric Supplier Name', trf.fabricSupplierName),
    dyeingHouse: val('Dyeing House Name', trf.dyeingHouse),
    vendorCode: val('Vendor Code', trf.vendorCode),
    processingHouse: val('Processing House Name', trf.processingHouse),
    washCareCode: val('Wash Care Code', trf.washCareCode),
    labName: val('Testing Lab', trf.testingLab?.labName),
  };

  return {
    company,
    f,
    docNo: trf.trfNumber,
    docPill: [trf.customer?.name, trf.testingLab?.labName].filter(Boolean).join(' · '),
    trfDate: fmtDate(trf.trfDate),
    // Not a tax document, and the lab needs our contact rather than our GSTIN.
    hideGstin: true,

    applicant,
    lab,
    identity,

    packageTicks: ticks(TRF_PACKAGE_TYPES, trf.packageType),
    previousReportNo: trf.packageType === 'RETEST' ? trf.previousReportNo : null,
    stageTicks: ticks(TRF_SAMPLE_STAGES, trf.sampleStage),
    finishTicks: ticks(TRF_FINISH_TYPES, trf.finishType),
    serviceTicks: ticks(TRF_SERVICE_LEVELS, trf.serviceRequired),
    departmentTicks: ticks(TRF_BUYING_DEPARTMENTS, trf.buyingDepartment),
    subCategoryColumns: [subByDepartment('KIDS_WEAR'), subByDepartment('MENS_WEAR'), subByDepartment('WOMENS_WEAR')],
    testColumns,

    yesNo,
    yn,
    remarks: trf.remarks,
    handFilled,
  };
}
