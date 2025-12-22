const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function configureCompanyState() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║         Configure Company State for GST Calculations                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  try {
    // Show popular states
    const popularStates = ['Tamil Nadu', 'Maharashtra', 'Gujarat', 'Karnataka', 'Delhi', 'Haryana'];
    const states = await prisma.indian_states.findMany({
      where: {
        stateName: {
          in: popularStates
        }
      },
      orderBy: { stateName: 'asc' }
    });

    console.log('📌 POPULAR GARMENT MANUFACTURING STATES:\n');
    states.forEach((state, index) => {
      console.log(`  ${index + 1}. ${state.stateCode} - ${state.stateName}`);
    });

    console.log('\n  0. View all states');
    console.log('  X. Exit without configuring\n');

    const choice = await question('Select your company state (enter number): ');

    if (choice.toUpperCase() === 'X') {
      console.log('\n👋 Exiting without changes.\n');
      rl.close();
      await prisma.$disconnect();
      return;
    }

    let selectedState;

    if (choice === '0') {
      // Show all states
      const allStates = await prisma.indian_states.findMany({
        orderBy: { stateName: 'asc' }
      });

      console.log('\n📍 ALL STATES/UTs:\n');
      allStates.forEach((state, index) => {
        console.log(`  ${(index + 1).toString().padStart(2)}. ${state.stateCode} - ${state.stateName}`);
      });

      const stateChoice = await question('\nEnter state number: ');
      const stateIndex = parseInt(stateChoice) - 1;

      if (stateIndex >= 0 && stateIndex < allStates.length) {
        selectedState = allStates[stateIndex];
      } else {
        console.log('\n❌ Invalid selection.\n');
        rl.close();
        await prisma.$disconnect();
        return;
      }
    } else {
      const choiceIndex = parseInt(choice) - 1;
      if (choiceIndex >= 0 && choiceIndex < states.length) {
        selectedState = states[choiceIndex];
      } else {
        console.log('\n❌ Invalid selection.\n');
        rl.close();
        await prisma.$disconnect();
        return;
      }
    }

    // Confirm selection
    console.log(`\n✓ Selected: ${selectedState.stateName} (GST Code: ${selectedState.stateCode})`);
    console.log(`  State ID: ${selectedState.id}\n`);

    const confirm = await question('Confirm and update .env file? (y/n): ');

    if (confirm.toLowerCase() !== 'y') {
      console.log('\n👋 Cancelled. No changes made.\n');
      rl.close();
      await prisma.$disconnect();
      return;
    }

    // Update .env file
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Replace the COMPANY_STATE_ID line
    const oldLine = /COMPANY_STATE_ID=".*?"/;
    const newLine = `COMPANY_STATE_ID="${selectedState.id}"`;

    if (oldLine.test(envContent)) {
      envContent = envContent.replace(oldLine, newLine);
    } else {
      // Add it if it doesn't exist
      envContent += `\n# GST Configuration\nCOMPANY_STATE_ID="${selectedState.id}"\n`;
    }

    fs.writeFileSync(envPath, envContent, 'utf8');

    console.log('\n✅ SUCCESS!\n');
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

    rl.close();
    await prisma.$disconnect();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    rl.close();
    await prisma.$disconnect();
    process.exit(1);
  }
}

configureCompanyState();
