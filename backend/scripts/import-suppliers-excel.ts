/**
 * Supplier Excel Import Script
 * Imports/updates suppliers from Excel file with GST, bank details, and categories
 */

import { PrismaClient, SupplierCategory } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

// GST State Code to State Name mapping
const GST_STATE_MAP: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

// Excel category to SupplierCategory enum mapping
const CATEGORY_MAP: Record<string, SupplierCategory> = {
  'greige': SupplierCategory.GREIGE_SUPPLIER,
  'dyer': SupplierCategory.DYEING_PRINTING,
  'dyer & printer': SupplierCategory.DYEING_PRINTING,
  'printer': SupplierCategory.DYEING_PRINTING,
  'lace': SupplierCategory.LACE_SUPPLIER,
  'accessories': SupplierCategory.TRIMS_SUPPLIER,
  'label': SupplierCategory.TRIMS_SUPPLIER,
  'packging items': SupplierCategory.PACKAGING_SUPPLIER,
  'packaging items': SupplierCategory.PACKAGING_SUPPLIER,
  'embroidry': SupplierCategory.EMBROIDERY,
  'embroidery': SupplierCategory.EMBROIDERY,
  'electric items': SupplierCategory.OTHER_SERVICES,
  'chemicals': SupplierCategory.OTHER_SERVICES,
  'finishing contractor': SupplierCategory.FINISHING_CONTRACTOR,
  'raffu': SupplierCategory.OTHER_SERVICES,
  'kaj button': SupplierCategory.OTHER_SERVICES,
  'smoking': SupplierCategory.SMOCKING,
  'denim wash': SupplierCategory.WASHING,
  'handwork': SupplierCategory.HAND_WORK,
  'dori & pipin': SupplierCategory.DORI_PIPING_CONTRACTOR,
  'dori & piping': SupplierCategory.DORI_PIPING_CONTRACTOR,
  'machine parts': SupplierCategory.MACHINE_PARTS_SUPPLIER,
  'press parts': SupplierCategory.MACHINE_PARTS_SUPPLIER,
  'stitching contractor': SupplierCategory.STITCHING_CONTRACTOR,
  'threads': SupplierCategory.THREAD_SUPPLIER,
};

interface ExcelRow {
  'Sr. No.': number;
  'Vendor': string;
  'GST No.': string;
  'Address': string;
  'Contact No.': string | number;
  'Supply ': string; // Note: trailing space in Excel
  'Account No.': string | number;
  'Ifsc Code': string;
}

interface ImportResult {
  created: string[];
  updated: string[];
  skipped: string[];
  errors: string[];
}

async function generateSupplierCode(): Promise<string> {
  const lastSupplier = await prisma.suppliers.findFirst({
    where: { code: { startsWith: 'SUP' } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  if (!lastSupplier) {
    return 'SUP00000001';
  }

  const lastNumber = parseInt(lastSupplier.code.replace('SUP', ''), 10) || 0;
  return `SUP${String(lastNumber + 1).padStart(8, '0')}`;
}

async function findSupplierByName(name: string) {
  // Case-insensitive search, handles trailing commas
  const normalizedName = name.trim().replace(/,+$/, '');

  const suppliers = await prisma.suppliers.findMany({
    where: {
      OR: [
        { name: { equals: name, mode: 'insensitive' } },
        { name: { equals: normalizedName, mode: 'insensitive' } },
        { name: { equals: `${normalizedName},`, mode: 'insensitive' } },
      ],
    },
    include: {
      gst_numbers: true,
    },
  });

  return suppliers;
}

async function getStateIdByCode(stateCode: string): Promise<string | null> {
  const state = await prisma.indian_states.findFirst({
    where: { stateCode },
    select: { id: true },
  });
  return state?.id || null;
}

async function importSuppliers(filePath: string): Promise<ImportResult> {
  const result: ImportResult = {
    created: [],
    updated: [],
    skipped: [],
    errors: [],
  };

  // Read Excel file
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet);

  console.log(`\n📊 Found ${rows.length} rows in Excel\n`);

  // Get admin user for createdById
  const adminUser = await prisma.users.findFirst({
    where: { email: 'admin@kasya.in' },
    select: { id: true },
  });

  if (!adminUser) {
    throw new Error('Admin user not found');
  }

  for (const row of rows) {
    const vendorName = row['Vendor']?.toString().trim();
    if (!vendorName) {
      result.skipped.push(`Row ${row['Sr. No.']}: No vendor name`);
      continue;
    }

    try {
      // Find existing supplier(s)
      const existingSuppliers = await findSupplierByName(vendorName);

      // Parse Excel data
      const gstNumber = row['GST No.']?.toString().trim() || '';
      const phone = row['Contact No.']?.toString().trim() || '';
      const bankAccount = row['Account No.']?.toString().trim() || '';
      const ifscCode = row['Ifsc Code']?.toString().trim() || '';
      const categoryText = row['Supply ']?.toString().trim().toLowerCase() || '';
      const category = CATEGORY_MAP[categoryText];

      // Extract state info from GST
      const gstStateCode = gstNumber ? gstNumber.substring(0, 2) : '';
      const stateName = gstStateCode ? GST_STATE_MAP[gstStateCode] : '';
      const stateId = gstStateCode ? await getStateIdByCode(gstStateCode) : null;

      if (existingSuppliers.length === 0) {
        // CREATE new supplier
        const newCode = await generateSupplierCode();

        const newSupplier = await prisma.suppliers.create({
          data: {
            code: newCode,
            name: vendorName,
            phone: phone || null,
            bankAccountNumber: bankAccount || null,
            ifscCode: ifscCode || null,
            supplierCategories: category ? [category] : [],
            isActive: true,
            createdById: adminUser.id,
            gst_numbers: gstNumber && stateName ? {
              create: {
                gstNumber,
                stateCode: gstStateCode,
                stateName,
                stateId,
                isPrimary: true,
              },
            } : undefined,
          },
        });

        result.created.push(`${vendorName} (${newCode})`);
        console.log(`✅ CREATED: ${vendorName} (${newCode})`);
      } else {
        // UPDATE existing supplier(s)
        for (const supplier of existingSuppliers) {
          const updates: any = {};
          const updateDetails: string[] = [];

          // Update phone if provided and missing
          if (phone && !supplier.phone) {
            updates.phone = phone;
            updateDetails.push('phone');
          }

          // Update bank details if provided and missing
          if (bankAccount && !supplier.bankAccountNumber) {
            updates.bankAccountNumber = bankAccount;
            updateDetails.push('bank');
          }
          if (ifscCode && !supplier.ifscCode) {
            updates.ifscCode = ifscCode;
            updateDetails.push('IFSC');
          }

          // Add category if not already present
          if (category && !supplier.supplierCategories.includes(category)) {
            updates.supplierCategories = [...supplier.supplierCategories, category];
            updateDetails.push(`category:${category}`);
          }

          // Update supplier if there are changes
          if (Object.keys(updates).length > 0) {
            await prisma.suppliers.update({
              where: { id: supplier.id },
              data: updates,
            });
          }

          // Add GST if provided and not exists
          if (gstNumber && stateName) {
            const existingGst = supplier.gst_numbers.find((g: { gstNumber: string }) => g.gstNumber === gstNumber);
            if (!existingGst) {
              await prisma.supplier_gst_numbers.create({
                data: {
                  supplierId: supplier.id,
                  gstNumber,
                  stateCode: gstStateCode,
                  stateName,
                  stateId,
                  isPrimary: supplier.gst_numbers.length === 0,
                },
              });
              updateDetails.push('GST');
            }
          }

          if (updateDetails.length > 0) {
            result.updated.push(`${vendorName}: ${updateDetails.join(', ')}`);
            console.log(`📝 UPDATED: ${vendorName} - ${updateDetails.join(', ')}`);
          } else {
            result.skipped.push(`${vendorName}: No updates needed`);
            console.log(`⏭️  SKIPPED: ${vendorName} (no updates needed)`);
          }
        }
      }
    } catch (error: any) {
      result.errors.push(`${vendorName}: ${error.message}`);
      console.error(`❌ ERROR: ${vendorName} - ${error.message}`);
    }
  }

  return result;
}

async function main() {
  const filePath = path.join('C:', 'Users', 'NEW', 'Downloads', 'Supplier List.xlsx');

  console.log('🚀 Starting Supplier Import...');
  console.log(`📁 File: ${filePath}\n`);

  // Pre-import stats
  const preStats = {
    totalSuppliers: await prisma.suppliers.count({ where: { isActive: true } }),
    withGst: await prisma.suppliers.count({
      where: { isActive: true, gst_numbers: { some: {} } }
    }),
    withBank: await prisma.suppliers.count({
      where: { isActive: true, bankAccountNumber: { not: null } }
    }),
    withEmptyCategory: await prisma.suppliers.count({
      where: { isActive: true, supplierCategories: { isEmpty: true } }
    }),
  };

  console.log('📊 PRE-IMPORT STATS:');
  console.log(`   Total active suppliers: ${preStats.totalSuppliers}`);
  console.log(`   With GST: ${preStats.withGst}`);
  console.log(`   With bank details: ${preStats.withBank}`);
  console.log(`   With empty categories: ${preStats.withEmptyCategory}`);
  console.log('');

  const result = await importSuppliers(filePath);

  // Post-import stats
  const postStats = {
    totalSuppliers: await prisma.suppliers.count({ where: { isActive: true } }),
    withGst: await prisma.suppliers.count({
      where: { isActive: true, gst_numbers: { some: {} } }
    }),
    withBank: await prisma.suppliers.count({
      where: { isActive: true, bankAccountNumber: { not: null } }
    }),
    withEmptyCategory: await prisma.suppliers.count({
      where: { isActive: true, supplierCategories: { isEmpty: true } }
    }),
  };

  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Created: ${result.created.length}`);
  result.created.forEach(s => console.log(`   - ${s}`));

  console.log(`\n📝 Updated: ${result.updated.length}`);
  result.updated.forEach(s => console.log(`   - ${s}`));

  console.log(`\n⏭️  Skipped: ${result.skipped.length}`);

  if (result.errors.length > 0) {
    console.log(`\n❌ Errors: ${result.errors.length}`);
    result.errors.forEach(s => console.log(`   - ${s}`));
  }

  console.log('\n📊 POST-IMPORT STATS:');
  console.log(`   Total active suppliers: ${preStats.totalSuppliers} → ${postStats.totalSuppliers} (+${postStats.totalSuppliers - preStats.totalSuppliers})`);
  console.log(`   With GST: ${preStats.withGst} → ${postStats.withGst} (+${postStats.withGst - preStats.withGst})`);
  console.log(`   With bank details: ${preStats.withBank} → ${postStats.withBank} (+${postStats.withBank - preStats.withBank})`);
  console.log(`   With empty categories: ${preStats.withEmptyCategory} → ${postStats.withEmptyCategory} (${postStats.withEmptyCategory - preStats.withEmptyCategory})`);

  console.log('\n✅ Import complete!');
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
