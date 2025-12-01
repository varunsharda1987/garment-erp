/**
 * Migration Script: Update existing customer codes to new format
 * New Format: CUST-{B2B/B2C}-{INT/DOM}-XXX
 *
 * This script will:
 * 1. Fetch all existing customers
 * 2. Group them by businessType and market
 * 3. Assign sequential numbers within each group
 * 4. Update customer codes in the database
 */

import prisma from '../config/database';
import { logInfo, logError, logWarn } from '../utils/logger';

interface CustomerUpdate {
  id: string;
  oldCode: string;
  newCode: string;
  businessType: string;
  market: string;
}

async function migrateCustomerCodes() {
  try {
    logInfo('Starting customer code migration...');

    // Fetch all customers
    const customers = await prisma.customers.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        businessType: true,
        market: true,
      },
      orderBy: {
        createdAt: 'asc', // Maintain creation order for numbering
      },
    });

    logInfo(`Found ${customers.length} customers to migrate`);

    if (customers.length === 0) {
      logInfo('No customers to migrate');
      return;
    }

    // Group customers by businessType and market
    const groups: Record<string, typeof customers> = {};

    for (const customer of customers) {
      const businessType = customer.businessType || 'B2B';
      const market = customer.market || 'DOMESTIC';
      const marketCode = market === 'INTERNATIONAL' ? 'INT' : 'DOM';
      const key = `${businessType}-${marketCode}`;

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(customer);
    }

    logInfo(`Grouped customers into ${Object.keys(groups).length} categories`);

    // Prepare updates
    const updates: CustomerUpdate[] = [];

    for (const [groupKey, groupCustomers] of Object.entries(groups)) {
      const [businessType, marketCode] = groupKey.split('-');

      logInfo(`Processing ${groupKey}: ${groupCustomers.length} customers`);

      groupCustomers.forEach((customer, index) => {
        const sequentialNumber = (index + 1).toString().padStart(3, '0');
        const newCode = `CUST-${businessType}-${marketCode}-${sequentialNumber}`;

        // Only update if the code is different
        if (customer.code !== newCode) {
          updates.push({
            id: customer.id,
            oldCode: customer.code,
            newCode: newCode,
            businessType: businessType,
            market: marketCode,
          });
        }
      });
    }

    logInfo(`Prepared ${updates.length} customer code updates`);

    if (updates.length === 0) {
      logInfo('All customer codes are already in the correct format');
      return;
    }

    // Display preview
    console.log('\n=== MIGRATION PREVIEW ===');
    console.log('The following customer codes will be updated:\n');
    updates.slice(0, 10).forEach((update) => {
      console.log(`${update.oldCode} → ${update.newCode}`);
    });

    if (updates.length > 10) {
      console.log(`... and ${updates.length - 10} more`);
    }
    console.log('\n=========================\n');

    // Execute updates in a transaction
    logInfo('Starting database updates...');

    let successCount = 0;
    let errorCount = 0;

    for (const update of updates) {
      try {
        await prisma.customers.update({
          where: { id: update.id },
          data: { code: update.newCode },
        });
        successCount++;

        if (successCount % 10 === 0) {
          logInfo(`Updated ${successCount}/${updates.length} customers...`);
        }
      } catch (error: unknown) {
        errorCount++;
        logError(`Failed to update customer ${update.oldCode}:`, error);
      }
    }

    logInfo(`\n=== MIGRATION COMPLETE ===`);
    logInfo(`Successfully updated: ${successCount} customers`);
    if (errorCount > 0) {
      logWarn(`Failed to update: ${errorCount} customers`);
    }
    logInfo(`==========================\n`);

    // Summary by group
    const summary: Record<string, number> = {};
    for (const update of updates) {
      const key = `${update.businessType}-${update.market}`;
      summary[key] = (summary[key] || 0) + 1;
    }

    console.log('\n=== UPDATED CUSTOMERS BY CATEGORY ===');
    for (const [category, count] of Object.entries(summary)) {
      console.log(`${category}: ${count} customers`);
    }
    console.log('=====================================\n');

  } catch (error) {
    logError('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
if (require.main === module) {
  migrateCustomerCodes()
    .then(() => {
      console.log('Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export default migrateCustomerCodes;
