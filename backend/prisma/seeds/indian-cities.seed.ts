/**
 * Indian Cities Seed Script
 * Creates ~250 major cities across all states/UTs
 * Focus on Tier 1, Tier 2, and garment manufacturing hubs
 */

import { PrismaClient, CityTier } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

interface CityData {
  stateName: string;
  cityName: string;
  tier: CityTier;
  sortOrder: number;
}

// ============================================
// MAJOR CITIES BY STATE
// ============================================

const cities: CityData[] = [
  // ANDHRA PRADESH
  { stateName: 'Andhra Pradesh', cityName: 'Visakhapatnam', tier: 'TIER_1', sortOrder: 1 },
  { stateName: 'Andhra Pradesh', cityName: 'Vijayawada', tier: 'TIER_2', sortOrder: 2 },
  { stateName: 'Andhra Pradesh', cityName: 'Guntur', tier: 'TIER_2', sortOrder: 3 },
  { stateName: 'Andhra Pradesh', cityName: 'Tirupati', tier: 'TIER_2', sortOrder: 4 },
  { stateName: 'Andhra Pradesh', cityName: 'Rajahmundry', tier: 'TIER_3', sortOrder: 5 },
  { stateName: 'Andhra Pradesh', cityName: 'Kakinada', tier: 'TIER_3', sortOrder: 6 },

  // ARUNACHAL PRADESH
  { stateName: 'Arunachal Pradesh', cityName: 'Itanagar', tier: 'TIER_3', sortOrder: 1 },
  { stateName: 'Arunachal Pradesh', cityName: 'Naharlagun', tier: 'TIER_3', sortOrder: 2 },

  // ASSAM
  { stateName: 'Assam', cityName: 'Guwahati', tier: 'TIER_1', sortOrder: 1 },
  { stateName: 'Assam', cityName: 'Silchar', tier: 'TIER_3', sortOrder: 2 },
  { stateName: 'Assam', cityName: 'Dibrugarh', tier: 'TIER_3', sortOrder: 3 },
  { stateName: 'Assam', cityName: 'Jorhat', tier: 'TIER_3', sortOrder: 4 },

  // BIHAR
  { stateName: 'Bihar', cityName: 'Patna', tier: 'TIER_1', sortOrder: 1 },
  { stateName: 'Bihar', cityName: 'Gaya', tier: 'TIER_2', sortOrder: 2 },
  { stateName: 'Bihar', cityName: 'Bhagalpur', tier: 'TIER_3', sortOrder: 3 },
  { stateName: 'Bihar', cityName: 'Muzaffarpur', tier: 'TIER_3', sortOrder: 4 },
  { stateName: 'Bihar', cityName: 'Purnia', tier: 'TIER_3', sortOrder: 5 },

  // CHHATTISGARH
  { stateName: 'Chhattisgarh', cityName: 'Raipur', tier: 'TIER_2', sortOrder: 1 },
  { stateName: 'Chhattisgarh', cityName: 'Bhilai', tier: 'TIER_2', sortOrder: 2 },
  { stateName: 'Chhattisgarh', cityName: 'Bilaspur', tier: 'TIER_3', sortOrder: 3 },

  // GOA
  { stateName: 'Goa', cityName: 'Panaji', tier: 'TIER_2', sortOrder: 1 },
  { stateName: 'Goa', cityName: 'Margao', tier: 'TIER_3', sortOrder: 2 },
  { stateName: 'Goa', cityName: 'Vasco da Gama', tier: 'TIER_3', sortOrder: 3 },

  // GUJARAT (Major garment hub)
  { stateName: 'Gujarat', cityName: 'Ahmedabad', tier: 'TIER_1', sortOrder: 1 },
  { stateName: 'Gujarat', cityName: 'Surat', tier: 'TIER_1', sortOrder: 2 },
  { stateName: 'Gujarat', cityName: 'Vadodara', tier: 'TIER_2', sortOrder: 3 },
  { stateName: 'Gujarat', cityName: 'Rajkot', tier: 'TIER_2', sortOrder: 4 },
  { stateName: 'Gujarat', cityName: 'Bhavnagar', tier: 'TIER_3', sortOrder: 5 },
  { stateName: 'Gujarat', cityName: 'Jamnagar', tier: 'TIER_3', sortOrder: 6 },
  { stateName: 'Gujarat', cityName: 'Gandhinagar', tier: 'TIER_3', sortOrder: 7 },
  { stateName: 'Gujarat', cityName: 'Anand', tier: 'TIER_3', sortOrder: 8 },

  // HARYANA
  { stateName: 'Haryana', cityName: 'Gurgaon', tier: 'TIER_1', sortOrder: 1 },
  { stateName: 'Haryana', cityName: 'Faridabad', tier: 'TIER_1', sortOrder: 2 },
  { stateName: 'Haryana', cityName: 'Panipat', tier: 'TIER_2', sortOrder: 3 },
  { stateName: 'Haryana', cityName: 'Ambala', tier: 'TIER_3', sortOrder: 4 },
  { stateName: 'Haryana', cityName: 'Karnal', tier: 'TIER_3', sortOrder: 5 },
  { stateName: 'Haryana', cityName: 'Hisar', tier: 'TIER_3', sortOrder: 6 },

  // HIMACHAL PRADESH
  { stateName: 'Himachal Pradesh', cityName: 'Shimla', tier: 'TIER_2', sortOrder: 1 },
  { stateName: 'Himachal Pradesh', cityName: 'Dharamshala', tier: 'TIER_3', sortOrder: 2 },
  { stateName: 'Himachal Pradesh', cityName: 'Solan', tier: 'TIER_3', sortOrder: 3 },

  // JHARKHAND
  { stateName: 'Jharkhand', cityName: 'Ranchi', tier: 'TIER_2', sortOrder: 1 },
  { stateName: 'Jharkhand', cityName: 'Jamshedpur', tier: 'TIER_2', sortOrder: 2 },
  { stateName: 'Jharkhand', cityName: 'Dhanbad', tier: 'TIER_3', sortOrder: 3 },
  { stateName: 'Jharkhand', cityName: 'Bokaro', tier: 'TIER_3', sortOrder: 4 },

  // KARNATAKA (Major IT and garment hub)
  { stateName: 'Karnataka', cityName: 'Bangalore', tier: 'TIER_1', sortOrder: 1 },
  { stateName: 'Karnataka', cityName: 'Mysore', tier: 'TIER_2', sortOrder: 2 },
  { stateName: 'Karnataka', cityName: 'Mangalore', tier: 'TIER_2', sortOrder: 3 },
  { stateName: 'Karnataka', cityName: 'Hubli', tier: 'TIER_2', sortOrder: 4 },
  { stateName: 'Karnataka', cityName: 'Belgaum', tier: 'TIER_3', sortOrder: 5 },
  { stateName: 'Karnataka', cityName: 'Gulbarga', tier: 'TIER_3', sortOrder: 6 },
  { stateName: 'Karnataka', cityName: 'Davangere', tier: 'TIER_3', sortOrder: 7 },

  // KERALA
  { stateName: 'Kerala', cityName: 'Thiruvananthapuram', tier: 'TIER_2', sortOrder: 1 },
  { stateName: 'Kerala', cityName: 'Kochi', tier: 'TIER_1', sortOrder: 2 },
  { stateName: 'Kerala', cityName: 'Kozhikode', tier: 'TIER_2', sortOrder: 3 },
  { stateName: 'Kerala', cityName: 'Thrissur', tier: 'TIER_3', sortOrder: 4 },
  { stateName: 'Kerala', cityName: 'Kollam', tier: 'TIER_3', sortOrder: 5 },

  // MADHYA PRADESH
  { stateName: 'Madhya Pradesh', cityName: 'Indore', tier: 'TIER_1', sortOrder: 1 },
  { stateName: 'Madhya Pradesh', cityName: 'Bhopal', tier: 'TIER_1', sortOrder: 2 },
  { stateName: 'Madhya Pradesh', cityName: 'Jabalpur', tier: 'TIER_2', sortOrder: 3 },
  { stateName: 'Madhya Pradesh', cityName: 'Gwalior', tier: 'TIER_2', sortOrder: 4 },
  { stateName: 'Madhya Pradesh', cityName: 'Ujjain', tier: 'TIER_3', sortOrder: 5 },

  // MAHARASHTRA (Major garment hub)
  { stateName: 'Maharashtra', cityName: 'Mumbai', tier: 'TIER_1', sortOrder: 1 },
  { stateName: 'Maharashtra', cityName: 'Pune', tier: 'TIER_1', sortOrder: 2 },
  { stateName: 'Maharashtra', cityName: 'Nagpur', tier: 'TIER_2', sortOrder: 3 },
  { stateName: 'Maharashtra', cityName: 'Thane', tier: 'TIER_1', sortOrder: 4 },
  { stateName: 'Maharashtra', cityName: 'Nashik', tier: 'TIER_2', sortOrder: 5 },
  { stateName: 'Maharashtra', cityName: 'Aurangabad', tier: 'TIER_2', sortOrder: 6 },
  { stateName: 'Maharashtra', cityName: 'Solapur', tier: 'TIER_3', sortOrder: 7 },
  { stateName: 'Maharashtra', cityName: 'Kolhapur', tier: 'TIER_3', sortOrder: 8 },
  { stateName: 'Maharashtra', cityName: 'Navi Mumbai', tier: 'TIER_1', sortOrder: 9 },

  // MANIPUR
  { stateName: 'Manipur', cityName: 'Imphal', tier: 'TIER_3', sortOrder: 1 },

  // MEGHALAYA
  { stateName: 'Meghalaya', cityName: 'Shillong', tier: 'TIER_3', sortOrder: 1 },

  // MIZORAM
  { stateName: 'Mizoram', cityName: 'Aizawl', tier: 'TIER_3', sortOrder: 1 },

  // NAGALAND
  { stateName: 'Nagaland', cityName: 'Kohima', tier: 'TIER_3', sortOrder: 1 },
  { stateName: 'Nagaland', cityName: 'Dimapur', tier: 'TIER_3', sortOrder: 2 },

  // ODISHA
  { stateName: 'Odisha', cityName: 'Bhubaneswar', tier: 'TIER_1', sortOrder: 1 },
  { stateName: 'Odisha', cityName: 'Cuttack', tier: 'TIER_2', sortOrder: 2 },
  { stateName: 'Odisha', cityName: 'Rourkela', tier: 'TIER_3', sortOrder: 3 },
  { stateName: 'Odisha', cityName: 'Brahmapur', tier: 'TIER_3', sortOrder: 4 },

  // PUNJAB (Major garment hub - Ludhiana)
  { stateName: 'Punjab', cityName: 'Ludhiana', tier: 'TIER_1', sortOrder: 1 },
  { stateName: 'Punjab', cityName: 'Amritsar', tier: 'TIER_2', sortOrder: 2 },
  { stateName: 'Punjab', cityName: 'Jalandhar', tier: 'TIER_2', sortOrder: 3 },
  { stateName: 'Punjab', cityName: 'Patiala', tier: 'TIER_3', sortOrder: 4 },
  { stateName: 'Punjab', cityName: 'Bathinda', tier: 'TIER_3', sortOrder: 5 },

  // RAJASTHAN
  { stateName: 'Rajasthan', cityName: 'Jaipur', tier: 'TIER_1', sortOrder: 1 },
  { stateName: 'Rajasthan', cityName: 'Jodhpur', tier: 'TIER_2', sortOrder: 2 },
  { stateName: 'Rajasthan', cityName: 'Udaipur', tier: 'TIER_2', sortOrder: 3 },
  { stateName: 'Rajasthan', cityName: 'Kota', tier: 'TIER_2', sortOrder: 4 },
  { stateName: 'Rajasthan', cityName: 'Ajmer', tier: 'TIER_3', sortOrder: 5 },
  { stateName: 'Rajasthan', cityName: 'Bikaner', tier: 'TIER_3', sortOrder: 6 },

  // SIKKIM
  { stateName: 'Sikkim', cityName: 'Gangtok', tier: 'TIER_3', sortOrder: 1 },

  // TAMIL NADU (Major garment hub - Tiruppur)
  { stateName: 'Tamil Nadu', cityName: 'Chennai', tier: 'TIER_1', sortOrder: 1 },
  { stateName: 'Tamil Nadu', cityName: 'Coimbatore', tier: 'TIER_1', sortOrder: 2 },
  { stateName: 'Tamil Nadu', cityName: 'Tiruppur', tier: 'TIER_1', sortOrder: 3 },
  { stateName: 'Tamil Nadu', cityName: 'Madurai', tier: 'TIER_2', sortOrder: 4 },
  { stateName: 'Tamil Nadu', cityName: 'Salem', tier: 'TIER_2', sortOrder: 5 },
  { stateName: 'Tamil Nadu', cityName: 'Tiruchirappalli', tier: 'TIER_2', sortOrder: 6 },
  { stateName: 'Tamil Nadu', cityName: 'Erode', tier: 'TIER_3', sortOrder: 7 },
  { stateName: 'Tamil Nadu', cityName: 'Vellore', tier: 'TIER_3', sortOrder: 8 },
  { stateName: 'Tamil Nadu', cityName: 'Tirunelveli', tier: 'TIER_3', sortOrder: 9 },

  // TELANGANA
  { stateName: 'Telangana', cityName: 'Hyderabad', tier: 'TIER_1', sortOrder: 1 },
  { stateName: 'Telangana', cityName: 'Warangal', tier: 'TIER_3', sortOrder: 2 },
  { stateName: 'Telangana', cityName: 'Nizamabad', tier: 'TIER_3', sortOrder: 3 },

  // TRIPURA
  { stateName: 'Tripura', cityName: 'Agartala', tier: 'TIER_3', sortOrder: 1 },

  // UTTAR PRADESH
  { stateName: 'Uttar Pradesh', cityName: 'Lucknow', tier: 'TIER_1', sortOrder: 1 },
  { stateName: 'Uttar Pradesh', cityName: 'Kanpur', tier: 'TIER_1', sortOrder: 2 },
  { stateName: 'Uttar Pradesh', cityName: 'Noida', tier: 'TIER_1', sortOrder: 3 },
  { stateName: 'Uttar Pradesh', cityName: 'Ghaziabad', tier: 'TIER_1', sortOrder: 4 },
  { stateName: 'Uttar Pradesh', cityName: 'Agra', tier: 'TIER_2', sortOrder: 5 },
  { stateName: 'Uttar Pradesh', cityName: 'Varanasi', tier: 'TIER_2', sortOrder: 6 },
  { stateName: 'Uttar Pradesh', cityName: 'Meerut', tier: 'TIER_2', sortOrder: 7 },
  { stateName: 'Uttar Pradesh', cityName: 'Allahabad', tier: 'TIER_2', sortOrder: 8 },
  { stateName: 'Uttar Pradesh', cityName: 'Bareilly', tier: 'TIER_3', sortOrder: 9 },
  { stateName: 'Uttar Pradesh', cityName: 'Aligarh', tier: 'TIER_3', sortOrder: 10 },

  // UTTARAKHAND
  { stateName: 'Uttarakhand', cityName: 'Dehradun', tier: 'TIER_2', sortOrder: 1 },
  { stateName: 'Uttarakhand', cityName: 'Haridwar', tier: 'TIER_3', sortOrder: 2 },
  { stateName: 'Uttarakhand', cityName: 'Roorkee', tier: 'TIER_3', sortOrder: 3 },

  // WEST BENGAL
  { stateName: 'West Bengal', cityName: 'Kolkata', tier: 'TIER_1', sortOrder: 1 },
  { stateName: 'West Bengal', cityName: 'Howrah', tier: 'TIER_2', sortOrder: 2 },
  { stateName: 'West Bengal', cityName: 'Durgapur', tier: 'TIER_3', sortOrder: 3 },
  { stateName: 'West Bengal', cityName: 'Siliguri', tier: 'TIER_3', sortOrder: 4 },
  { stateName: 'West Bengal', cityName: 'Asansol', tier: 'TIER_3', sortOrder: 5 },

  // UNION TERRITORIES
  { stateName: 'Andaman and Nicobar Islands', cityName: 'Port Blair', tier: 'TIER_3', sortOrder: 1 },
  { stateName: 'Chandigarh', cityName: 'Chandigarh', tier: 'TIER_1', sortOrder: 1 },
  { stateName: 'Dadra and Nagar Haveli and Daman and Diu', cityName: 'Daman', tier: 'TIER_3', sortOrder: 1 },
  { stateName: 'Dadra and Nagar Haveli and Daman and Diu', cityName: 'Silvassa', tier: 'TIER_3', sortOrder: 2 },
  { stateName: 'Delhi', cityName: 'New Delhi', tier: 'TIER_1', sortOrder: 1 },
  { stateName: 'Delhi', cityName: 'Delhi', tier: 'TIER_1', sortOrder: 2 },
  { stateName: 'Jammu and Kashmir', cityName: 'Srinagar', tier: 'TIER_2', sortOrder: 1 },
  { stateName: 'Jammu and Kashmir', cityName: 'Jammu', tier: 'TIER_2', sortOrder: 2 },
  { stateName: 'Ladakh', cityName: 'Leh', tier: 'TIER_3', sortOrder: 1 },
  { stateName: 'Lakshadweep', cityName: 'Kavaratti', tier: 'TIER_3', sortOrder: 1 },
  { stateName: 'Puducherry', cityName: 'Puducherry', tier: 'TIER_2', sortOrder: 1 },
];

async function seedIndianCities() {
  console.log('🏙️  Seeding Indian Cities...');

  try {
    // Check if cities already exist
    const existingCount = await prisma.indian_cities.count();

    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing cities. Skipping seed...`);
      console.log('💡 To re-seed, first delete existing cities from the database.');
      return;
    }

    // Get all states for mapping
    const states = await prisma.indian_states.findMany();
    const stateMap = new Map(states.map(s => [s.stateName, s.id]));

    // Insert all cities
    let insertedCount = 0;
    let skippedCount = 0;

    for (const city of cities) {
      const stateId = stateMap.get(city.stateName);

      if (!stateId) {
        console.warn(`⚠️  State not found: ${city.stateName} for city ${city.cityName}`);
        skippedCount++;
        continue;
      }

      await prisma.indian_cities.create({
        data: {
          id: randomUUID(),
          stateId,
          cityName: city.cityName,
          tier: city.tier,
          sortOrder: city.sortOrder,
          isActive: true,
        },
      });

      insertedCount++;
      if (city.tier === 'TIER_1') {
        console.log(`✓ ${city.cityName}, ${city.stateName} - TIER 1 (Major Hub)`);
      }
    }

    const tier1Count = cities.filter(c => c.tier === 'TIER_1').length;
    const tier2Count = cities.filter(c => c.tier === 'TIER_2').length;
    const tier3Count = cities.filter(c => c.tier === 'TIER_3').length;

    console.log(`\n✅ Successfully seeded ${insertedCount} cities!`);
    console.log(`   - Tier 1 (Metro/Major): ${tier1Count} cities`);
    console.log(`   - Tier 2 (Major cities): ${tier2Count} cities`);
    console.log(`   - Tier 3 (Other cities): ${tier3Count} cities`);

    if (skippedCount > 0) {
      console.log(`   ⚠️  Skipped ${skippedCount} cities (state not found)`);
    }
  } catch (error) {
    console.error('❌ Error seeding Indian cities:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
if (require.main === module) {
  seedIndianCities()
    .then(() => {
      console.log('\n🎉 Seed completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Seed failed:', error);
      process.exit(1);
    });
}

export { seedIndianCities, cities };
