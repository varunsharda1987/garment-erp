const { execSync } = require('child_process');

// Set environment variable
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/garment_erp';

console.log('Running Prisma migration with local database...');
console.log('DATABASE_URL:', process.env.DATABASE_URL);

try {
  execSync('npx prisma migrate dev --name add_financial_masters', {
    stdio: 'inherit',
    env: process.env
  });
  console.log('\n✅ Migration completed successfully!');
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
}
