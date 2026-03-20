import prisma from '../src/config/database';
import * as fs from 'fs';

async function run() {
  const sql = fs.readFileSync('prisma/migrations/20260320_add_job_work_than_fields_and_finished_fabric/migration.sql', 'utf8');
  const statements: string[] = [];
  let current = '';

  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--') || trimmed === '') continue;
    current += ' ' + trimmed;
    if (trimmed.endsWith(';')) {
      statements.push(current.trim());
      current = '';
    }
  }

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log('OK:', stmt.substring(0, 70));
    } catch (err: any) {
      console.log('SKIP:', err.meta?.message?.substring(0, 80) || 'error');
    }
  }

  await prisma.$disconnect();
  console.log('Done.');
}

run().catch(console.error);
