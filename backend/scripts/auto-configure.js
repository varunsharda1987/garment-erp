const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function autoConfigureCompanyState() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║         Auto-Configure Company State for GST Calculations            ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  try {
    // Get state from command line argument or default to Maharashtra
    const stateArg = process.argv[2] || 'Maharashtra';

    console.log(`🔍 Looking for state: ${stateArg}...\n`);

    // Try to find state by name or code
    let selectedState = await prisma.indian_states.findFirst({
      where: {
        OR: [
          { stateName: { equals: stateArg, mode: 'insensitive' } },
          { stateCode: stateArg }
        ]
      }
    });

    if (!selectedState) {
      console.error(`❌ State "${stateArg}" not found in database.\n`);
      console.log('Available states:');
      const states = await prisma.indian_states.findMany({
        orderBy: { stateName: 'asc' }
      });
      states.forEach(s => console.log(`  - ${s.stateName} (Code: ${s.stateCode})`));
      console.log('\nUsage: node auto-configure.js [StateName or StateCode]');
      console.log('Example: node auto-configure.js Maharashtra');
      console.log('Example: node auto-configure.js 27\n');
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log(`✓ Found: ${selectedState.stateName} (GST Code: ${selectedState.stateCode})`);
    console.log(`  State ID: ${selectedState.id}\n`);

    // Update .env file
    const envPath = path.join(__dirname, '..', '.env');

    if (!fs.existsSync(envPath)) {
      console.error('❌ .env file not found at:', envPath);
      await prisma.$disconnect();
      process.exit(1);
    }

    let envContent = fs.readFileSync(envPath, 'utf8');

    // Create backup
    const backupPath = envPath + '.backup.' + Date.now();
    fs.writeFileSync(backupPath, envContent, 'utf8');
    console.log(`💾 Created backup: ${path.basename(backupPath)}\n`);

    // Replace the COMPANY_STATE_ID line
    const oldLine = /COMPANY_STATE_ID=".*?"/;
    const newLine = `COMPANY_STATE_ID="${selectedState.id}"`;

    if (oldLine.test(envContent)) {
      envContent = envContent.replace(oldLine, newLine);
      console.log('✓ Updated existing COMPANY_STATE_ID\n');
    } else {
      // Add it if it doesn't exist
      envContent += `\n# GST Configuration\nCOMPANY_STATE_ID="${selectedState.id}"\n`;
      console.log('✓ Added COMPANY_STATE_ID to .env\n');
    }

    fs.writeFileSync(envPath, envContent, 'utf8');

    console.log('✅ SUCCESS!\n');
    console.log('─'.repeat(70));
    console.log(`   Company State: ${selectedState.stateName}`);
    console.log(`   GST Code: ${selectedState.stateCode}`);
    console.log(`   State ID: ${selectedState.id}`);
    console.log('─'.repeat(70));
    console.log('\n📝 Configuration saved to backend/.env\n');
    console.log('⚠️  IMPORTANT: Restart your backend server for changes to take effect\n');
    console.log('NEXT STEPS:');
    console.log('  1. Restart backend: npm run dev');
    console.log('  2. Verify setup: node scripts/verify-setup.js');
    console.log('  3. Test APIs: See docs/GST_QUICK_START.md\n');

    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

autoConfigureCompanyState();
