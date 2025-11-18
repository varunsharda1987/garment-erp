@echo off
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/garment_erp
echo Starting backend server with local database...
npm run dev
