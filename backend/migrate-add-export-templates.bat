@echo off
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/garment_erp
echo Running Prisma migration for export_templates...
npx prisma migrate dev --name add_export_templates
