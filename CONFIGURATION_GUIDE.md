# Kashaya Fabs ERP - Configuration Guide

## Table of Contents
1. [Quick Start](#quick-start)
2. [Environment Setup](#environment-setup)
3. [Security Configuration](#security-configuration)
4. [Database Configuration](#database-configuration)
5. [Production Deployment](#production-deployment)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Development Environment Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd garment-erp
   ```

2. **Setup Backend**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your configuration
   npm install
   npx prisma generate
   npx prisma migrate dev
   npm run dev
   ```

3. **Setup Frontend**
   ```bash
   cd frontend
   cp .env.example .env
   # Edit .env with your configuration
   npm install
   npm run dev
   ```

4. **Access Application**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:5000
   - API Health: http://localhost:5000/health

---

## Environment Setup

### Backend Environment Variables

**Location:** `backend/.env`

#### Required Variables

```bash
# Database connection (PostgreSQL)
DATABASE_URL="postgresql://username:password@localhost:5432/garment_erp"

# JWT authentication
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
```

### Root Environment Variables

**Location:** `.env` (root directory)

```bash
# Database URL for Prisma tools (Studio, migrations)
DATABASE_URL="postgresql://username:password@localhost:5432/garment_erp"
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

### 2. Database Security

#### Development
```bash
# Acceptable for local development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/garment_erp"
```

#### Production
```bash
# Use strong credentials and SSL
DATABASE_URL="postgresql://prod_user:strong_password@db.example.com:5432/garment_erp?sslmode=require"
```

**Best Practices:**
- Use strong, unique passwords (min 16 characters)
- Create dedicated database user with minimal permissions
- Enable SSL/TLS for database connections
- Restrict database access by IP address
- Enable database audit logging
- Setup regular automated backups

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

### 5. API Key Security (AI Features)

If using cloud AI providers:

```bash
# OpenAI
AI_ENABLED="true"
AI_PROVIDER="openai"
AI_API_KEY="sk-..."  # Keep this secret!
AI_MODEL="gpt-4-turbo"

# Anthropic Claude
AI_ENABLED="true"
AI_PROVIDER="anthropic"
AI_API_KEY="sk-ant-..."  # Keep this secret!
AI_MODEL="claude-3-5-sonnet-20241022"
```

**Security Tips:**
- Store API keys in secure environment variable managers
- Rotate API keys regularly
- Monitor API usage for anomalies
- Set usage limits/quotas
- Use separate keys for dev/production

---

## Database Configuration

### PostgreSQL Setup

#### 1. Install PostgreSQL

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

#### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE garment_erp;

# Create dedicated user (production)
CREATE USER erp_user WITH ENCRYPTED PASSWORD 'strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE garment_erp TO erp_user;
```

#### 3. Update Connection String

```bash
# Development (postgres user)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/garment_erp"

# Production (dedicated user)
DATABASE_URL="postgresql://erp_user:strong_password@localhost:5432/garment_erp"
```

### Running Migrations

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

## Production Deployment

### Pre-Deployment Checklist

#### Security
- [ ] Generate strong JWT_SECRET (min 64 characters)
- [ ] Use strong database credentials
- [ ] Enable SSL for database connection
- [ ] Update FRONTEND_URL to production domain
- [ ] Set NODE_ENV="production"
- [ ] Disable DEBUG_TRANSFORM
- [ ] Review and secure AI API keys
- [ ] Setup firewall rules
- [ ] Enable HTTPS/SSL certificates

#### Configuration
- [ ] Create production `.env` files
- [ ] Update CORS origins
- [ ] Configure proper logging
- [ ] Setup error monitoring (Sentry, etc.)
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

### Environment-Specific Configuration

#### Production .env Example

**Backend:**
```bash
DATABASE_URL="postgresql://prod_user:STRONG_PASSWORD@prod-db.example.com:5432/garment_erp?sslmode=require"
JWT_SECRET="<64-char-random-string>"
JWT_EXPIRES_IN="7d"
PORT=5000
NODE_ENV="production"
FRONTEND_URL="https://erp.kashayafabs.com"
DEBUG_TRANSFORM="false"
AI_ENABLED="true"
AI_PROVIDER="openai"
AI_API_KEY="sk-..."
AI_MODEL="gpt-4-turbo"
```

**Frontend:**
```bash
VITE_API_URL=https://api.kashayafabs.com/api
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

### Common Issues

#### 1. Database Connection Failed

**Error:** `Can't reach database server`

**Solutions:**
- Verify PostgreSQL is running: `systemctl status postgresql` (Linux) or check Services (Windows)
- Check DATABASE_URL credentials
- Verify database exists: `psql -U postgres -l`
- Check firewall rules
- Ensure PostgreSQL is listening on correct port (5432)

#### 2. JWT Authentication Failed

**Error:** `Invalid token` or `jwt malformed`

**Solutions:**
- Ensure JWT_SECRET matches between deployments
- Check JWT_EXPIRES_IN format (e.g., "7d", "24h")
- Verify Authorization header: `Bearer <token>`
- Clear browser cookies/localStorage
- Generate new token by logging in again

#### 3. CORS Errors

**Error:** `Access-Control-Allow-Origin` errors

**Solutions:**
- Update FRONTEND_URL in backend `.env`
- Verify URL format (no trailing slash)
- Check browser developer console for actual error
- Ensure backend is running
- Clear browser cache

#### 4. Prisma Migration Failed

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

#### 5. Frontend Can't Connect to Backend

**Error:** `Network Error` or `ERR_CONNECTION_REFUSED`

**Solutions:**
- Verify backend is running: `curl http://localhost:5000/health`
- Check VITE_API_URL in `frontend/.env`
- Ensure no port conflicts
- Check firewall/antivirus blocking connections
- Verify CORS configuration

#### 6. AI Features Not Working

**Error:** AI requests failing or timing out

**Solutions:**
- Verify AI_ENABLED="true"
- Check AI provider configuration
- For Ollama: Ensure running (`ollama serve`)
- For cloud providers: Verify API key is valid
- Check API rate limits
- Review AI_BASE_URL format

### Logging and Debugging

#### Enable Debug Logs

```bash
# Backend
DEBUG_TRANSFORM="true"

# Check logs
tail -f backend/logs/app.log  # If logging configured
```

#### Health Checks

```bash
# Backend health
curl http://localhost:5000/health

# Database connectivity
curl http://localhost:5000/api/health/db

# API status
curl http://localhost:5000/api/status
```

### Getting Help

1. Check existing documentation in `docs/` folder
2. Review [TECHNICAL_DEBT.md](./TECHNICAL_DEBT.md) for known issues
3. Search GitHub issues
4. Check application logs
5. Review Prisma migration history

---

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Security Guidelines](https://owasp.org/www-project-top-ten/)
- [React + Vite Production Build](https://vitejs.dev/guide/build.html)

---

**Last Updated:** November 22, 2025
**Version:** 1.0.0
**Maintainer:** Kashaya Fabs Development Team
