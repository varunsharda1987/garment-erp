@echo off
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/garment_erp
npx prisma migrate dev --name add_financial_masters
