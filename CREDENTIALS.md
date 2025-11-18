# 🔐 KASHAYA FABS ERP - CREDENTIALS

> **SINGLE SOURCE OF TRUTH FOR ALL LOGIN CREDENTIALS**

**Last Updated:** November 16, 2025

---

## 🎯 PERMANENT ADMIN CREDENTIALS

```
Email:    admin@kashaya.com
Password: admin123
```

**These credentials are PERMANENT and will NOT change.**

---

## 🔧 If Login Fails

If you ever have login issues, run this command to reset admin credentials:

```bash
cd backend
npm run fix-admin
```

This will:
- Find or create admin user
- Reset email to: admin@kashaya.com
- Reset password to: admin123
- Ensure user is active

---

## 🌐 Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

---

## 📋 Environment Files

### Backend (.env or .env.local)
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/garment_erp
JWT_SECRET=your-super-secret-jwt-key-change-in-production-to-long-random-string
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

---

## 🚀 Quick Start

### 1. Start Backend
```bash
cd backend
npm run dev
```

### 2. Start Frontend  
```bash
cd frontend
npm run dev
```

### 3. Login
- Open: http://localhost:5173
- Email: admin@kashaya.com
- Password: admin123

---

## ⚠️ Troubleshooting

### Login fails with "Invalid credentials"
```bash
cd backend
npm run fix-admin
```

### Port 5173 already in use
```bash
# Kill process on port 5173
taskkill //F //PID <pid>

# Or frontend will auto-select next available port
```

### Database connection error
Check PostgreSQL is running:
```bash
# Windows
Get-Service postgresql*

# Start if needed
Start-Service postgresql-x64-17
```

---

## 📝 Notes

- These credentials are for **development only**
- Change credentials in production
- Admin user has full access to all modules
- No other users exist by default

---

**🔗 Related Files:**
- [NEXT_SESSION.md](NEXT_SESSION.md) - Session quickstart guide
- [PROJECT_MASTER_GUIDE.md](PROJECT_MASTER_GUIDE.md) - Complete project guide
- [README.md](README.md) - Project overview
