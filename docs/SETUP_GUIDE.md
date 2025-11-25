# Kashaya Fabs ERP - Complete Setup Guide

**Last Updated:** November 25, 2025
**Version:** 2.0.0

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Security Configuration](#security-configuration)
5. [Monitoring & Observability](#monitoring--observability)
6. [API Documentation](#api-documentation)
7. [Production Deployment](#production-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 15+
- Git

### Development Setup

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd garment-erp

   # Setup Backend
   cd backend
   cp .env.example .env
   npm install
   npx prisma generate
   npx prisma migrate dev
   npm run dev

   # Setup Frontend (new terminal)
   cd frontend
   cp .env.example .env
   npm install
   npm run dev
   ```

2. **Access Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000
   - API Health: http://localhost:5000/health
   - API Docs: http://localhost:5000/api-docs

For detailed setup instructions for Indian compliance, see [docs/setup/](setup/) directory.

---

## Environment Configuration

### Backend Environment Variables

**Location:** `backend/.env`

#### Required Variables

```bash
# Database connection (PostgreSQL)
DATABASE_URL="postgresql://username:password@localhost:5432/garment_erp"

# JWT authentication (MUST be secure in production!)
JWT_SECRET="your-super-secret-key-min-64-characters"
JWT_EXPIRES_IN="7d"

# Server configuration
PORT=5000
NODE_ENV="development"

# CORS configuration
FRONTEND_URL="http://localhost:5173"
```

#### Optional Variables

```bash
# Debugging
DEBUG_TRANSFORM="true"  # Enable request/response transformation logs

# Sentry Error Tracking
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% of transactions
SENTRY_PROFILES_SAMPLE_RATE=0.1  # 10% profiling

# AI Features (optional)
AI_ENABLED="true"
AI_PROVIDER="ollama"  # Options: openai, anthropic, google, ollama
AI_API_KEY=""  # Required for cloud providers
AI_MODEL="llama3"
AI_BASE_URL="http://localhost:11434"  # For Ollama
```

### Frontend Environment Variables

**Location:** `frontend/.env`

```bash
# Backend API URL
VITE_API_URL=http://localhost:5000/api

# Sentry Configuration (optional)
VITE_SENTRY_DSN=https://your-frontend-dsn@sentry.io/project-id
```

### Root Environment Variables

**Location:** `.env` (root directory)

```bash
# Database URL for Prisma tools (Studio, migrations)
DATABASE_URL="postgresql://username:password@localhost:5432/garment_erp"
```

---

## Database Setup

### 1. Install PostgreSQL

**Windows:**
```bash
# Download from https://www.postgresql.org/download/windows/
# Or use chocolatey:
choco install postgresql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE garment_erp;

# Create dedicated user (production recommended)
CREATE USER erp_user WITH ENCRYPTED PASSWORD 'strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE garment_erp TO erp_user;
```

### 3. Update Connection String

```bash
# Development (postgres user)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/garment_erp"

# Production (dedicated user)
DATABASE_URL="postgresql://erp_user:strong_password@localhost:5432/garment_erp?sslmode=require"
```

### 4. Run Migrations

```bash
cd backend

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database (optional)
npm run seed
```

### Database Tools

```bash
# Open Prisma Studio (database GUI)
npx prisma studio

# Create new migration
npx prisma migrate dev --name migration_name

# Reset database (DESTRUCTIVE!)
npx prisma migrate reset

# View migration status
npx prisma migrate status
```

---

## Security Configuration

### 1. JWT Secret Generation

**CRITICAL:** Never use default JWT secrets in production!

Generate a strong secret:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Using OpenSSL
openssl rand -hex 64

# Using PowerShell
[Convert]::ToBase64String((1..64|%{Get-Random -Max 256}))
```

Update `backend/.env`:
```bash
JWT_SECRET="<your-generated-secret-here>"
```

### 2. Database Security Best Practices

**Development:**
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/garment_erp"
```

**Production:**
```bash
DATABASE_URL="postgresql://prod_user:strong_password@db.example.com:5432/garment_erp?sslmode=require"
```

**Checklist:**
- [ ] Use strong, unique passwords (min 16 characters)
- [ ] Create dedicated database user with minimal permissions
- [ ] Enable SSL/TLS for database connections
- [ ] Restrict database access by IP address
- [ ] Enable database audit logging
- [ ] Setup regular automated backups

### 3. CORS Configuration

**Development:**
```bash
FRONTEND_URL="http://localhost:5173"
```

**Production (Single Domain):**
```bash
FRONTEND_URL="https://erp.kashayafabs.com"
```

**Production (Multiple Domains):**
Update `backend/src/app.ts` to use array:
```typescript
const allowedOrigins = process.env.FRONTEND_URL?.split(',') || [];
```

Then in `.env`:
```bash
FRONTEND_URL="https://erp.kashayafabs.com,https://admin.kashayafabs.com"
```

### 4. Environment File Security

**DO:**
- ✅ Use `.env.example` as template (commit to git)
- ✅ Keep actual `.env` files out of version control
- ✅ Use different credentials for dev/staging/production
- ✅ Rotate secrets regularly
- ✅ Use environment variable managers (AWS Secrets Manager, etc.)

**DON'T:**
- ❌ Commit `.env` files to git
- ❌ Share `.env` files via email/chat
- ❌ Use production credentials in development
- ❌ Hardcode secrets in source code
- ❌ Use default/example credentials in production

---

## Monitoring & Observability

### Error Tracking with Sentry

**Features:**
- Real-time error capture
- Performance monitoring
- Session replay (frontend)
- Stack trace analysis
- Alert notifications

#### Backend Setup

1. **Create Sentry Project** at [sentry.io](https://sentry.io/)
2. **Configure Environment** in `backend/.env`:
   ```bash
   SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
   SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% of transactions
   SENTRY_PROFILES_SAMPLE_RATE=0.1  # 10% profiling
   ```

3. **Integration** (already configured in `backend/src/config/sentry.ts`)

#### Frontend Setup

1. **Configure** in `frontend/.env`:
   ```bash
   VITE_SENTRY_DSN=https://your-frontend-dsn@sentry.io/project-id
   ```

2. **Initialize** in `frontend/src/main.tsx` (already configured)

### Health Check Endpoints

#### Available Endpoints

```bash
# Basic Health Check
GET /health
curl http://localhost:5000/health

# Readiness Check (includes database)
GET /health/readiness
curl http://localhost:5000/health/readiness

# Liveness Check
GET /health/liveness
curl http://localhost:5000/health/liveness

# System Metrics
GET /health/metrics
curl http://localhost:5000/health/metrics

# Version Info
GET /health/version
curl http://localhost:5000/health/version
```

#### Docker Health Check

Add to `docker-compose.yml`:
```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Application Logging

**Log Locations:**
- `backend/logs/combined.log` - All logs
- `backend/logs/error.log` - Errors only
- Console output (development)

**View Logs:**
```bash
# Tail all logs
tail -f backend/logs/combined.log

# View errors only
tail -f backend/logs/error.log

# Search logs
grep "ERROR" backend/logs/combined.log
```

---

## API Documentation

### Access Swagger UI

**Development:**
```
http://localhost:5000/api-docs
```

**Production:**
```
https://your-domain.com/api-docs
```

### Using Protected Endpoints in Swagger

1. **Get JWT Token:**
   - Navigate to `/api/auth/login`
   - Click "Try it out"
   - Enter credentials
   - Execute and copy the `token`

2. **Authorize:**
   - Click the green "Authorize" button (top right)
   - Enter: `Bearer YOUR_TOKEN_HERE`
   - Click "Authorize" and close

3. **Test Endpoints:**
   - All endpoints with 🔒 icon now use your token
   - Click "Try it out" on any protected endpoint

### Features

- 🔍 **Search** - Find endpoints quickly
- 🔐 **Authorization** - Add JWT token for protected routes
- 🧪 **Try It Out** - Execute requests directly
- 📥 **Download** - Export OpenAPI spec

---

## Production Deployment

### Pre-Deployment Checklist

#### Security
- [ ] Generate strong JWT_SECRET (min 64 characters)
- [ ] Use strong database credentials
- [ ] Enable SSL for database connection
- [ ] Update FRONTEND_URL to production domain
- [ ] Set NODE_ENV="production"
- [ ] Disable DEBUG_TRANSFORM
- [ ] Review and secure API keys
- [ ] Setup firewall rules
- [ ] Enable HTTPS/SSL certificates

#### Configuration
- [ ] Create production `.env` files
- [ ] Update CORS origins
- [ ] Configure proper logging
- [ ] Setup error monitoring (Sentry)
- [ ] Configure database backups
- [ ] Setup health check monitoring
- [ ] Test all API endpoints

#### Database
- [ ] Run production migrations
- [ ] Verify database indexes
- [ ] Setup connection pooling
- [ ] Configure backup strategy
- [ ] Test disaster recovery
- [ ] Enable query logging

### Production Environment Example

**Backend `.env`:**
```bash
DATABASE_URL="postgresql://prod_user:STRONG_PASSWORD@prod-db.example.com:5432/garment_erp?sslmode=require"
JWT_SECRET="<64-char-random-string>"
JWT_EXPIRES_IN="7d"
PORT=5000
NODE_ENV="production"
FRONTEND_URL="https://erp.kashayafabs.com"
DEBUG_TRANSFORM="false"
SENTRY_DSN="https://your-sentry-dsn@sentry.io/project-id"
SENTRY_TRACES_SAMPLE_RATE=0.1
```

**Frontend `.env`:**
```bash
VITE_API_URL=https://api.kashayafabs.com/api
VITE_SENTRY_DSN=https://your-frontend-dsn@sentry.io/project-id
```

### Deployment Steps

1. **Build Backend**
   ```bash
   cd backend
   npm install --production
   npm run build
   npx prisma generate
   ```

2. **Build Frontend**
   ```bash
   cd frontend
   npm install --production
   npm run build
   ```

3. **Run Migrations**
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

4. **Start Services**
   ```bash
   # Backend (using PM2)
   pm2 start dist/server.js --name garment-erp-backend

   # Frontend (nginx serves static files)
   # Copy frontend/dist/* to nginx web root
   ```

### Recommended Production Stack

- **Reverse Proxy:** Nginx or Traefik
- **Process Manager:** PM2 or systemd
- **Database:** PostgreSQL 15+ (managed service recommended)
- **SSL/TLS:** Let's Encrypt or commercial certificate
- **Monitoring:** Prometheus + Grafana
- **Error Tracking:** Sentry
- **Logging:** Winston + CloudWatch/ELK Stack
- **Containerization:** Docker + Docker Compose

---

## Troubleshooting

### Database Connection Failed

**Error:** `Can't reach database server`

**Solutions:**
- Verify PostgreSQL is running: `systemctl status postgresql` (Linux) or check Services (Windows)
- Check DATABASE_URL credentials
- Verify database exists: `psql -U postgres -l`
- Check firewall rules
- Ensure PostgreSQL is listening on correct port (5432)

### JWT Authentication Failed

**Error:** `Invalid token` or `jwt malformed`

**Solutions:**
- Ensure JWT_SECRET matches between deployments
- Check JWT_EXPIRES_IN format (e.g., "7d", "24h")
- Verify Authorization header: `Bearer <token>`
- Clear browser cookies/localStorage
- Generate new token by logging in again

### CORS Errors

**Error:** `Access-Control-Allow-Origin` errors

**Solutions:**
- Update FRONTEND_URL in backend `.env`
- Verify URL format (no trailing slash)
- Check browser developer console for actual error
- Ensure backend is running
- Clear browser cache

### Prisma Migration Failed

**Error:** `Migration failed` or `Database schema drift`

**Solutions:**
```bash
# Check migration status
npx prisma migrate status

# Resolve drift (development only!)
npx prisma migrate reset

# Production: Create migration
npx prisma migrate dev --name fix_drift

# Force deploy (use carefully)
npx prisma migrate deploy --force
```

### Frontend Can't Connect to Backend

**Error:** `Network Error` or `ERR_CONNECTION_REFUSED`

**Solutions:**
- Verify backend is running: `curl http://localhost:5000/health`
- Check VITE_API_URL in `frontend/.env`
- Ensure no port conflicts
- Check firewall/antivirus blocking connections
- Verify CORS configuration

### Sentry Not Capturing Errors

**Solutions:**
1. Verify `SENTRY_DSN` is set
2. Check environment is not 'test'
3. Verify error is not in `ignoreErrors` list
4. Check Sentry project settings

### High Memory Usage

**Check metrics:**
```bash
curl http://localhost:5000/health/metrics
```

**Common causes:**
- Memory leaks
- Large result sets
- Caching issues
- Unoptimized queries

**Solutions:**
- Use pagination
- Optimize queries
- Implement caching
- Profile with Sentry

---

## Additional Resources

- [Getting Started Guide](GETTING_STARTED.md) - Detailed setup instructions
- [Architecture Documentation](ARCHITECTURE.md) - System design decisions
- [Database Schema](DATABASE_SCHEMA.md) - Complete database documentation
- [Business Rules](BUSINESS_RULES.md) - Business logic and validation
- [Coding Standards](CODING_STANDARDS.md) - Development standards
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Production deployment details

**External Resources:**
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Sentry Documentation](https://docs.sentry.io/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Security Guidelines](https://owasp.org/www-project-top-ten/)

---

**Maintained By:** Kashaya Fabs Development Team
**Last Review:** November 25, 2025
**Next Review:** December 25, 2025
