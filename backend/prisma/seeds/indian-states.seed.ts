/**
 * Indian States and Union Territories Seed Script
 * Creates all 36 states/UTs with GST state codes
 */

import { PrismaClient, StateType } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

interface StateData {
  id: string;
  stateName: string;
  stateCode: string;
  stateType: StateType;
  sortOrder: number;
}

// ============================================
// All 28 States + 8 Union Territories
// ============================================
const states: StateData[] = [
  // STATES (28)
  { id: randomUUID(), stateName: 'Andhra Pradesh', stateCode: '37', stateType: 'STATE', sortOrder: 1 },
  { id: randomUUID(), stateName: 'Arunachal Pradesh', stateCode: '12', stateType: 'STATE', sortOrder: 2 },
  { id: randomUUID(), stateName: 'Assam', stateCode: '18', stateType: 'STATE', sortOrder: 3 },
  { id: randomUUID(), stateName: 'Bihar', stateCode: '10', stateType: 'STATE', sortOrder: 4 },
  { id: randomUUID(), stateName: 'Chhattisgarh', stateCode: '22', stateType: 'STATE', sortOrder: 5 },
  { id: randomUUID(), stateName: 'Goa', stateCode: '30', stateType: 'STATE', sortOrder: 6 },
  { id: randomUUID(), stateName: 'Gujarat', stateCode: '24', stateType: 'STATE', sortOrder: 7 },
  { id: randomUUID(), stateName: 'Haryana', stateCode: '06', stateType: 'STATE', sortOrder: 8 },
  { id: randomUUID(), stateName: 'Himachal Pradesh', stateCode: '02', stateType: 'STATE', sortOrder: 9 },
  { id: randomUUID(), stateName: 'Jharkhand', stateCode: '20', stateType: 'STATE', sortOrder: 10 },
  { id: randomUUID(), stateName: 'Karnataka', stateCode: '29', stateType: 'STATE', sortOrder: 11 },
  { id: randomUUID(), stateName: 'Kerala', stateCode: '32', stateType: 'STATE', sortOrder: 12 },
  { id: randomUUID(), stateName: 'Madhya Pradesh', stateCode: '23', stateType: 'STATE', sortOrder: 13 },
  { id: randomUUID(), stateName: 'Maharashtra', stateCode: '27', stateType: 'STATE', sortOrder: 14 },
  { id: randomUUID(), stateName: 'Manipur', stateCode: '14', stateType: 'STATE', sortOrder: 15 },
  { id: randomUUID(), stateName: 'Meghalaya', stateCode: '17', stateType: 'STATE', sortOrder: 16 },
  { id: randomUUID(), stateName: 'Mizoram', stateCode: '15', stateType: 'STATE', sortOrder: 17 },
  { id: randomUUID(), stateName: 'Nagaland', stateCode: '13', stateType: 'STATE', sortOrder: 18 },
  { id: randomUUID(), stateName: 'Odisha', stateCode: '21', stateType: 'STATE', sortOrder: 19 },
  { id: randomUUID(), stateName: 'Punjab', stateCode: '03', stateType: 'STATE', sortOrder: 20 },
  { id: randomUUID(), stateName: 'Rajasthan', stateCode: '08', stateType: 'STATE', sortOrder: 21 },
  { id: randomUUID(), stateName: 'Sikkim', stateCode: '11', stateType: 'STATE', sortOrder: 22 },
  { id: randomUUID(), stateName: 'Tamil Nadu', stateCode: '33', stateType: 'STATE', sortOrder: 23 },
  { id: randomUUID(), stateName: 'Telangana', stateCode: '36', stateType: 'STATE', sortOrder: 24 },
  { id: randomUUID(), stateName: 'Tripura', stateCode: '16', stateType: 'STATE', sortOrder: 25 },
  { id: randomUUID(), stateName: 'Uttar Pradesh', stateCode: '09', stateType: 'STATE', sortOrder: 26 },
  { id: randomUUID(), stateName: 'Uttarakhand', stateCode: '05', stateType: 'STATE', sortOrder: 27 },
  { id: randomUUID(), stateName: 'West Bengal', stateCode: '19', stateType: 'STATE', sortOrder: 28 },

  // UNION TERRITORIES (8)
  { id: randomUUID(), stateName: 'Andaman and Nicobar Islands', stateCode: '35', stateType: 'UNION_TERRITORY', sortOrder: 29 },
  { id: randomUUID(), stateName: 'Chandigarh', stateCode: '04', stateType: 'UNION_TERRITORY', sortOrder: 30 },
  { id: randomUUID(), stateName: 'Dadra and Nagar Haveli and Daman and Diu', stateCode: '26', stateType: 'UNION_TERRITORY', sortOrder: 31 },
  { id: randomUUID(), stateName: 'Delhi', stateCode: '07', stateType: 'UNION_TERRITORY', sortOrder: 32 },
  { id: randomUUID(), stateName: 'Jammu and Kashmir', stateCode: '01', stateType: 'UNION_TERRITORY', sortOrder: 33 },
  { id: randomUUID(), stateName: 'Ladakh', stateCode: '38', stateType: 'UNION_TERRITORY', sortOrder: 34 },
  { id: randomUUID(), stateName: 'Lakshadweep', stateCode: '31', stateType: 'UNION_TERRITORY', sortOrder: 35 },
  { id: randomUUID(), stateName: 'Puducherry', stateCode: '34', stateType: 'UNION_TERRITORY', sortOrder: 36 },
];

async function seedIndianStates() {
  console.log('🇮🇳 Seeding Indian States and Union Territories...');

  try {
    // Check if states already exist
    const existingCount = await prisma.indian_states.count();

    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing states. Skipping seed...`);
      console.log('💡 To re-seed, first delete existing states from the database.');
      return;
    }

    // Insert all states
    let insertedCount = 0;
    for (const state of states) {
      await prisma.indian_states.create({
        data: {
          id: state.id,
          stateName: state.stateName,
          stateCode: state.stateCode,
          stateType: state.stateType,
          sortOrder: state.sortOrder,
          isActive: true,
        },
      });
      insertedCount++;
      console.log(`✓ ${state.stateName} (${state.stateCode}) - ${state.stateType}`);
    }

    console.log(`\n✅ Successfully seeded ${insertedCount} states and union territories!`);
    console.log(`   - ${states.filter(s => s.stateType === 'STATE').length} States`);
    console.log(`   - ${states.filter(s => s.stateType === 'UNION_TERRITORY').length} Union Territories`);
  } catch (error) {
    console.error('❌ Error seeding Indian states:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
if (require.main === module) {
  seedIndianStates()
    .then(() => {
      console.log('\n🎉 Seed completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Seed failed:', error);
      process.exit(1);
    });
}

export { seedIndianStates, states };
