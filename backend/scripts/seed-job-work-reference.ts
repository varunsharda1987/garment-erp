/**
 * Job Work Reference Data Seed Script
 * Phase 0-1 of Job Work Consolidation
 *
 * Seeds:
 * 1. company_profile - Kashaya Fabs identity (singleton)
 * 2. process_type_master - SAC codes and GST rates for job work
 *
 * GST Rates:
 * - DYEING/PRINTING: NULL (pending CA sign-off on 5% vs 18% — blocks doc generation per R1)
 * - All other job work on textiles: 5% (SAC 9988xx)
 *
 * SAC Codes (from gst-job-work.md):
 * - 998821: Dyeing, printing, embroidery, finishing
 * - 998822: Garment making (stitching, smocking, cutting, washing)
 *
 * Reference: docs/files (2)/kf-documents/kf-documents/references/gst-job-work.md
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ProcessTypeData {
  code: string;
  name: string;
  description: string;
  sacCode: string;
  gstRate: number | null; // null = TBD, blocks document generation
  unitOfMeasure: string;
  processCategory: string; // FABRIC (meters) or GARMENT (pieces)
  tolerancePercent: number;
}

const COMPANY_PROFILE = {
  name: 'KASHAYA FABS',
  legalName: 'Kashaya Fabs (Proprietorship)',
  gstin: '08DCDPS0146D1ZU',
  pan: 'DCDPS0146D',
  stateCode: '08',
  stateName: 'Rajasthan',
  address: 'H1-51, Riico Industrial Area, Mansarovar',
  city: 'Jaipur',
  pincode: '302020',
  phone: null,
  email: null,
  website: null,
  bankName: null,
  bankBranch: null,
  bankAccountNumber: null,
  bankIfscCode: null,
  logoUrl: null,
  signatureUrl: null,
};

const PROCESS_TYPES: ProcessTypeData[] = [
  // FABRIC processing (meters) - SAC 998821
  {
    code: 'DYEING',
    name: 'Dyeing',
    description: 'Fabric dyeing services - solid color application',
    sacCode: '998821',
    gstRate: null, // NULL pending CA sign-off (5% vs 18% unresolved) - blocks doc generation per R1
    unitOfMeasure: 'MTR',
    processCategory: 'FABRIC',
    tolerancePercent: 3.0,
  },
  {
    code: 'PRINTING',
    name: 'Printing',
    description: 'Fabric printing services - pigment, procian, discharge',
    sacCode: '998821',
    gstRate: null, // NULL pending CA sign-off (5% vs 18% unresolved) - blocks doc generation per R1
    unitOfMeasure: 'MTR',
    processCategory: 'FABRIC',
    tolerancePercent: 3.0,
  },
  {
    code: 'FINISHING',
    name: 'Finishing',
    description: 'Fabric finishing treatments',
    sacCode: '998821', // Finishing is 998821, not 998823
    gstRate: 5.0,
    unitOfMeasure: 'MTR',
    processCategory: 'FABRIC',
    tolerancePercent: 2.0,
  },

  // GARMENT processing (pieces) - SAC 998822
  {
    code: 'WASHING',
    name: 'Washing',
    description: 'Garment washing services',
    sacCode: '998822', // Garment-stage service
    gstRate: 5.0,
    unitOfMeasure: 'PCS',
    processCategory: 'GARMENT',
    tolerancePercent: 1.0,
  },
  {
    code: 'EMBROIDERY',
    name: 'Embroidery',
    description: 'Machine and hand embroidery on fabric/garments',
    sacCode: '998821', // Embroidery is 998821
    gstRate: 5.0,
    unitOfMeasure: 'PCS',
    processCategory: 'GARMENT',
    tolerancePercent: 1.5,
  },
  {
    code: 'STITCHING',
    name: 'Stitching / CMT',
    description: 'Cut-Make-Trim garment stitching services',
    sacCode: '998822', // Garment making is 998822
    gstRate: 5.0,
    unitOfMeasure: 'PCS',
    processCategory: 'GARMENT',
    tolerancePercent: 1.0,
  },
  {
    code: 'SMOCKING',
    name: 'Smocking',
    description: 'Smocking embroidery technique',
    sacCode: '998822', // Garment-stage decorative is 998822
    gstRate: 5.0,
    unitOfMeasure: 'PCS',
    processCategory: 'GARMENT',
    tolerancePercent: 1.5,
  },
  {
    code: 'HANDWORK',
    name: 'Handwork',
    description: 'Hand embroidery, sequin work, bead work',
    sacCode: '998821', // Embroidery/decorative is 998821
    gstRate: 5.0,
    unitOfMeasure: 'PCS',
    processCategory: 'GARMENT',
    tolerancePercent: 2.0,
  },
  {
    code: 'CUTTING',
    name: 'Cutting',
    description: 'Fabric cutting services',
    sacCode: '998822', // Garment making is 998822
    gstRate: 5.0,
    unitOfMeasure: 'PCS',
    processCategory: 'GARMENT',
    tolerancePercent: 0.5,
  },
  {
    code: 'KAAJ_BUTTON',
    name: 'Kaaj-Button (Buttonhole & Attachment)',
    description: 'Buttonhole making (kaaj) and button attachment services - outsourced',
    sacCode: '998822', // Garment making/finishing is 998822
    gstRate: 5.0,
    unitOfMeasure: 'PCS',
    processCategory: 'GARMENT',
    tolerancePercent: 0.0, // Piece-based, no shrinkage
  },
  {
    code: 'TRANSPORTATION',
    name: 'Transportation',
    description: 'Goods transportation services for job work',
    sacCode: '996511', // Transportation of goods by road
    gstRate: 5.0, // 5% for GTA services
    unitOfMeasure: 'TRIP',
    processCategory: 'SERVICE',
    tolerancePercent: 0.0, // N/A for transport
  },
];

async function seedCompanyProfile() {
  console.log('Seeding company_profile...');

  const existing = await prisma.company_profile.findFirst({
    where: { isActive: true },
  });

  if (existing) {
    console.log('  Company profile already exists:', existing.gstin);
    return existing;
  }

  const profile = await prisma.company_profile.create({
    data: {
      ...COMPANY_PROFILE,
      isActive: true,
    },
  });

  console.log('  Created company profile:', profile.gstin);
  return profile;
}

async function seedProcessTypes() {
  console.log('Seeding process_type_master...');

  let created = 0;
  let updated = 0;

  for (const processType of PROCESS_TYPES) {
    const existing = await prisma.process_type_master.findUnique({
      where: { code: processType.code },
    });

    if (existing) {
      // Update if different
      await prisma.process_type_master.update({
        where: { id: existing.id },
        data: {
          name: processType.name,
          description: processType.description,
          sacCode: processType.sacCode,
          gstRate: processType.gstRate,
          unitOfMeasure: processType.unitOfMeasure,
          processCategory: processType.processCategory,
          tolerancePercent: processType.tolerancePercent,
        },
      });
      updated++;
    } else {
      await prisma.process_type_master.create({
        data: {
          code: processType.code,
          name: processType.name,
          description: processType.description,
          sacCode: processType.sacCode,
          gstRate: processType.gstRate,
          unitOfMeasure: processType.unitOfMeasure,
          processCategory: processType.processCategory,
          tolerancePercent: processType.tolerancePercent,
          isActive: true,
        },
      });
      created++;
    }
  }

  console.log(`  Process types: ${created} created, ${updated} updated`);
}

async function main() {
  console.log('=== Job Work Reference Data Seed ===\n');

  try {
    await seedCompanyProfile();
    await seedProcessTypes();

    console.log('\n=== Seed Complete ===');

    // Print summary
    const companyCount = await prisma.company_profile.count({ where: { isActive: true } });
    const processTypeCount = await prisma.process_type_master.count({ where: { isActive: true } });
    const fabricCount = await prisma.process_type_master.count({
      where: { isActive: true, processCategory: 'FABRIC' },
    });
    const garmentCount = await prisma.process_type_master.count({
      where: { isActive: true, processCategory: 'GARMENT' },
    });

    console.log(`\nSummary:`);
    console.log(`  Company profiles: ${companyCount}`);
    console.log(`  Process types: ${processTypeCount} (${fabricCount} FABRIC, ${garmentCount} GARMENT)`);
    console.log(`  DYEING/PRINTING: GST rate NULL (pending CA sign-off)`);
    console.log(`  Other processes: 5% GST`);

  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
