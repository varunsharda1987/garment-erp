const { execSync } = require('child_process');

// Set environment variable
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/garment_erp';

console.log('Creating Prisma migration file with local database...');
console.log('DATABASE_URL:', process.env.DATABASE_URL);

try {
  execSync('npx prisma migrate dev --name add_financial_masters --create-only', {
    stdio: 'inherit',
    env: process.env
  });
  console.log('\n✅ Migration file created successfully!');
  console.log('\nTo apply the migration, run:');
  console.log('node apply-migration.js');
} catch (error) {
  console.error('\n❌ Migration creation failed:', error.message);
  process.exit(1);
}
