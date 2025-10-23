# ⚡ QUICK START - 2 WORD COMMANDS

**Location-based startup scripts for Kashaya Fabs ERP**

---

## 🏢 AT OFFICE

### Option A: VS Code/Cursor (RECOMMENDED)
See [VSCODE_TERMINALS.md](VSCODE_TERMINALS.md) for full guide

1. Open VS Code/Cursor
2. Open folder: `garment-erp`
3. Open terminal: `` Ctrl + ` ``
4. Type: `office-control`
5. Press: `3`

Done! ✅

### Option B: Command Prompts

**Terminal 1 - Backend:**
```bash
office-backend
```

**Terminal 2 - Frontend:**
```bash
office-frontend
```

**Terminal 3 - Control:**
```bash
office-control
```

---

## 🏠 AT HOME

### Option A: VS Code/Cursor (RECOMMENDED)
See [VSCODE_TERMINALS.md](VSCODE_TERMINALS.md) for full guide

1. Open VS Code/Cursor
2. Open folder: `garment-erp` (from home path)
3. Open terminal: `` Ctrl + ` ``
4. Type: `home-control`
5. Press: `3`

Done! ✅

### Option B: Command Prompts

**Terminal 1 - Backend:**
```bash
home-backend
```

**Terminal 2 - Frontend:**
```bash
home-frontend
```

**Terminal 3 - Control:**
```bash
home-control
```

---

## 🎛️ CONTROL CENTER MENU

When you run `office-control` or `home-control`, you'll see:

```
[1] Start Backend Only
[2] Start Frontend Only
[3] Start Both Servers       ← Use this most often
[4] Run Frontend Tests
[5] Check System Status
[6] Stop All Servers
[Q] Quit
```

**Recommended:** Press `3` to start both servers automatically

---

## 📋 WHAT EACH SCRIPT DOES

### Backend Script (`office-backend` or `home-backend`)
- Changes to `backend` directory
- Runs `npm run dev`
- Starts server on http://localhost:5000

### Frontend Script (`office-frontend` or `home-frontend`)
- Changes to `frontend` directory
- Runs `npm run dev`
- Starts server on http://localhost:5173

### Control Script (`office-control` or `home-control`)
- Interactive menu
- Start/stop servers
- Run tests
- Check status
- All from one place

---

## 🚀 QUICK WORKFLOW

### Starting Work (Option A - Manual)

1. Open 3 terminals
2. **Terminal 1:** Type `office-backend` (or `home-backend`)
3. **Terminal 2:** Type `office-frontend` (or `home-frontend`)
4. **Terminal 3:** For commands/tests

### Starting Work (Option B - Auto)

1. Open 1 terminal
2. Type `office-control` (or `home-control`)
3. Press `3` (Start Both Servers)
4. Done! Servers start in separate windows

---

## 🔧 TROUBLESHOOTING

**Q: Command not found?**
- Make sure you're in the `garment-erp` directory
- Run: `cd C:\Users\admin\Desktop\garment-erp`

**Q: Port already in use?**
- Use Control Center option `6` to stop all servers
- Or restart your computer

**Q: Backend won't start?**
- Check `.env` file exists in backend folder
- Make sure DATABASE_URL is set

**Q: Frontend shows errors?**
- Run `npm install` in frontend folder
- Clear browser cache

---

## 📍 FILE LOCATIONS

All scripts are in the root directory:
```
garment-erp/
├── office-backend.bat
├── office-frontend.bat
├── office-control.bat
├── home-backend.bat
├── home-frontend.bat
└── home-control.bat
```

---

## 🎯 RECOMMENDED WORKFLOW

**Daily Startup:**
```
1. Open CMD in garment-erp folder
2. Run: office-control (or home-control)
3. Press: 3 (Start Both Servers)
4. Wait for servers to start
5. Open browser: http://localhost:5173
```

**Running Tests:**
```
1. Open CMD in garment-erp folder
2. Run: office-control (or home-control)
3. Press: 4 (Run Frontend Tests)
4. Wait for results
```

**Checking Status:**
```
1. Open CMD in garment-erp folder
2. Run: office-control (or home-control)
3. Press: 5 (Check System Status)
```

**Stopping Work:**
```
1. Run: office-control (or home-control)
2. Press: 6 (Stop All Servers)
```

---

## 💡 TIPS

- **Use Control Center** for easiest experience
- **Keep terminals open** while working
- **Stop servers** before shutting down computer
- **Check status** if something seems broken

---

## 🆘 NEED HELP?

Check these files:
- [START_HERE_AGENTS.md](START_HERE_AGENTS.md) - For agents
- [README.md](README.md) - Project overview
- [docs/AGENT_MANDATORY_WORKFLOW.md](docs/AGENT_MANDATORY_WORKFLOW.md) - Verification workflow

---

**Last Updated:** October 17, 2025
**Status:** Ready to use!
