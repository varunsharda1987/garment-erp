# Installing pgvector on Windows PostgreSQL 16.2

## Best Solution: Use pgAdmin to Install via PGXN (Easiest - 5 minutes)

PostgreSQL 16+ supports installing extensions via PGXN network directly!

### Step 1: Install pgxnclient (if not already installed)

```powershell
# Open PowerShell as Administrator
pip install pgxnclient
```

### Step 2: Install pgvector

```powershell
# Set PostgreSQL path
$env:PATH += ";C:\Program Files\PostgreSQL\16\bin"

# Install pgvector
pgxn install vector
```

### Step 3: Enable in your database

```powershell
# Run as Administrator
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d garment_erp -c "CREATE EXTENSION vector;"
```

## Alternative: Build from Source (if PGXN doesn't work)

### Prerequisites
1. **Visual Studio 2022** (Community Edition - Free)
   - Download: https://visualstudio.microsoft.com/downloads/
   - Install "Desktop development with C++" workload

2. **Git** (if not installed)
   - Download: https://git-scm.com/download/win

### Step 1: Clone pgvector

```powershell
cd C:\temp
git clone --branch v0.7.4 https://github.com/pgvector/pgvector.git
cd pgvector
```

### Step 2: Build using Visual Studio

```powershell
# Open Visual Studio Developer PowerShell (or regular PowerShell with VS tools)
# Set PostgreSQL path
$env:PGROOT = "C:\Program Files\PostgreSQL\16"

# Build
nmake /F Makefile.win

# Install
nmake /F Makefile.win install
```

### Step 3: Verify Installation

```powershell
# Check if files were copied
dir "C:\Program Files\PostgreSQL\16\lib\vector.dll"
dir "C:\Program Files\PostgreSQL\16\share\extension\vector.control"
```

### Step 4: Enable Extension

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d garment_erp -c "CREATE EXTENSION vector;"
```

## Even Simpler: Download Pre-built DLL (Recommended - 2 minutes)

I can help you find a pre-built binary or we can use a simpler approach.

### Option: Use Docker PostgreSQL with pgvector

This is actually the BEST and most reliable solution for Windows:

```powershell
# 1. Install Docker Desktop for Windows
# Download from: https://www.docker.com/products/docker-desktop

# 2. Stop your current PostgreSQL service (optional, use different port)
# Or change Docker port to 5433

# 3. Run PostgreSQL with pgvector
docker run -d `
  --name garment-erp-postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_DB=garment_erp `
  -p 5432:5432 `
  -v pgvector-data:/var/lib/postgresql/data `
  pgvector/pgvector:pg16

# 4. Wait for container to start (10 seconds)
Start-Sleep -Seconds 10

# 5. Test connection
docker exec -it garment-erp-postgres psql -U postgres -d garment_erp -c "CREATE EXTENSION vector;"

# 6. Migrate your data (if needed)
# Backup from current DB
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -d garment_erp > backup.sql

# Restore to Docker DB
Get-Content backup.sql | docker exec -i garment-erp-postgres psql -U postgres -d garment_erp
```

## My Recommendation

**Use Docker** - It's the most reliable and easiest solution:

### Why Docker is Best:
✅ Takes 5 minutes to set up
✅ No compilation needed
✅ No DLL compatibility issues
✅ Guaranteed to work
✅ Easy to backup/restore
✅ Can run alongside existing PostgreSQL
✅ Used by many in production

### Steps with Docker:

1. **Install Docker Desktop**: https://www.docker.com/products/docker-desktop
2. **Run the command above** to start PostgreSQL with pgvector
3. **Migrate your data** (or start fresh)
4. **Update .env**: Keep the same DATABASE_URL (Docker uses same port)

Would you like me to help you set up Docker PostgreSQL with pgvector? It's genuinely the best solution for Windows and takes about 5 minutes total.

## Troubleshooting

### Error: "pgxn: command not found"
Install Python and pip first, then:
```powershell
pip install pgxnclient
```

### Error: "nmake: command not found"
You need Visual Studio with C++ build tools installed.

### Error: "permission denied"
Run PowerShell as Administrator

### Docker not starting
- Make sure Hyper-V is enabled in Windows
- Make sure WSL2 is installed (Docker Desktop will prompt you)

## Next Steps

After you choose a method and install pgvector, let me know and I'll:
1. Run the database setup script
2. Configure the embedding provider
3. Index all your documents
4. Test the RAG functionality

Which method would you like to proceed with?
