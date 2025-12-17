# pgvector Installation Guide for Windows

## Option 1: Pre-built Binary (Easiest - 2 minutes)

### Step 1: Download pgvector for Windows

Download the pre-built Windows binary from:
https://github.com/pgvector/pgvector/releases

Look for a file like: `pgvector-0.X.X-windows-x64.zip`

### Step 2: Extract and Install

1. Extract the ZIP file
2. Copy the `vector.dll` file to your PostgreSQL `lib` directory:
   ```
   C:\Program Files\PostgreSQL\16\lib\
   ```

3. Copy the `vector.control` and `vector--*.sql` files to:
   ```
   C:\Program Files\PostgreSQL\16\share\extension\
   ```

### Step 3: Enable the Extension

```bash
# Open PowerShell as Administrator
psql -U postgres -d garment_erp -c "CREATE EXTENSION vector;"
```

## Option 2: Use Docker PostgreSQL with pgvector (Alternative - 5 minutes)

If installation is difficult, use Docker PostgreSQL with pgvector pre-installed:

### Step 1: Install Docker Desktop
Download from: https://www.docker.com/products/docker-desktop

### Step 2: Run PostgreSQL with pgvector
```bash
docker run -d \
  --name garment-erp-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=garment_erp \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

### Step 3: Update your .env
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/garment_erp"
```

### Step 4: Migrate your existing data
```bash
# Backup current database
pg_dump -U postgres -d garment_erp > backup.sql

# Restore to new Docker database
psql -U postgres -h localhost -d garment_erp < backup.sql
```

## Option 3: Skip pgvector - Use Alternative (No installation - 1 minute)

If you want to test RAG without installing pgvector, we can use a simpler approach with JSON storage:

### Benefits:
- No installation needed
- Works immediately
- Good for development/testing

### Limitations:
- Slower for large document counts (>1000)
- Less efficient than pgvector

Would you like me to implement this alternative?

## Verification

After installation, verify pgvector is working:

```bash
# Test the extension
psql -U postgres -d garment_erp

# In psql:
CREATE EXTENSION IF NOT EXISTS vector;
SELECT * FROM pg_extension WHERE extname = 'vector';
```

## Troubleshooting

### Error: "extension 'vector' is not available"
- The pgvector files are not in the correct directories
- Check that vector.dll is in PostgreSQL's lib folder
- Check that vector.control is in PostgreSQL's extension folder

### Error: "permission denied"
- Run PowerShell/Command Prompt as Administrator
- Or give your PostgreSQL user superuser privileges

### Can't find PostgreSQL directory
Common locations:
- `C:\Program Files\PostgreSQL\16\`
- `C:\Program Files\PostgreSQL\15\`
- `C:\PostgreSQL\16\`

Check your PostgreSQL version:
```bash
psql --version
```

## What to Do Next

1. Choose an option above
2. Let me know which option you prefer, and I'll help you complete it
3. Once pgvector is installed, I'll run the setup script and index your documents

## Quick Decision Guide

| Situation | Recommended Option |
|-----------|-------------------|
| Want full production features | Option 1 (Pre-built Binary) |
| Installation issues | Option 2 (Docker) |
| Just testing/development | Option 3 (Alternative without pgvector) |
| Already have Docker | Option 2 (Docker) |

Let me know which option you'd like to proceed with!
