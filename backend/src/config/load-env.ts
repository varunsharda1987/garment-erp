/**
 * Load backend/.env.local, then backend/.env, BEFORE any module reads process.env.
 *
 * Import this FIRST in server.ts. server.ts imports ./config/database — which checks DATABASE_URL the
 * moment it loads — before ./app, which until 2026-09-26 was the only place .env was read. So the
 * API only ever started when PM2 happened to hand it the variables in its stored environment. On
 * 26-Sep a restart replaced that environment and every boot died on "DATABASE_URL environment
 * variable is not set!" until this file existed.
 *
 * ONLY backend/.env — the values the running API has always used. backend/.env.local carries a
 * DIFFERENT JWT_SECRET and FRONTEND_URL; loading it first (the first version of this file did) signed
 * everyone out and broke the AI settings' decryption. dotenv never overwrites a key already set, so a
 * variable PM2 does pass still wins; app.ts's own later .env.local call only fills keys .env lacks.
 */
import path from 'path';
import dotenv from 'dotenv';

// __dirname is backend/src/config (ts-node) or backend/dist/config (built) — .env sits in backend/
dotenv.config({ path: path.join(__dirname, '../../.env'), quiet: true });
