# 🔄 GIT WORKFLOW - OFFICE & HOME SYNC

## QUICK REFERENCE GUIDE FOR KASHAYA FABS ERP PROJECT

# 🔄 GIT WORKFLOW & DEVELOPMENT SETUP

## COMPLETE REFERENCE GUIDE FOR KASHAYA FABS ERP PROJECT

**Project:** Garment ERP System  
**GitHub:** https://github.com/varunsharda1987/garment-erp  
**Office Location:** C:\Users\admin\Desktop\garment-erp ✅ DONE  
**Home Location:** [You'll set this up tonight - can be any path!]

---

## 📋 TABLE OF CONTENTS

1. [Prerequisites & Software Setup](#prerequisites)
2. [Office vs Home Comparison](#comparison)
3. [Office Workflow](#office)
4. [Home Setup Guide](#home)
5. [Daily Git Commands](#commands)
6. [Troubleshooting](#troubleshooting)
7. [Quick Reference Cards](#reference)

---

<a name="prerequisites"></a>
## 🛠️ PREREQUISITES & SOFTWARE SETUP

### **Required Software for Development**

Both office and home computers need these tools:

| Software | Purpose | Office Status | Home Status |
|----------|---------|---------------|-------------|
| **Git** | Version control | ✅ Installed | ⏳ Check tonight |
| **Node.js** | Run JavaScript | ⏳ Check | ⏳ Check tonight |
| **PostgreSQL** | Database | ⏳ Setup | ⏳ Setup tonight |
| **VS Code** | Code editor | ⏳ Optional | ⏳ Optional |

---

### **1️⃣ GIT - Version Control**

#### **Check if Already Installed:**
```bash
git --version
# Should show: git version 2.x.x
```

#### **If Not Installed:**

**Download:** https://git-scm.com/download/win

**Installation Steps:**
1. Download the installer (Git-2.43.0-64-bit.exe or latest)
2. Run the installer
3. **Important Settings During Installation:**
   - ✅ Use Git from the command line and also from 3rd-party software
   - ✅ Use bundled OpenSSH
   - ✅ Use the OpenSSL library
   - ✅ Checkout Windows-style, commit Unix-style line endings
   - ✅ Use MinTTY
   - ✅ Default (fast-forward or merge)
   - ✅ Git Credential Manager
   - ✅ Enable file system caching
4. Click "Install"
5. Click "Finish"
6. **Restart Command Prompt**
7. Verify: `git --version`

**Configuration (After Install):**
```bash
git config --global user.name "varunsharda1987"
git config --global user.email "admin@kasya.in"
git config --global core.autocrlf true
```

**Time:** 5 minutes  
**Status Office:** ✅ Done  
**Status Home:** ⏳ Do tonight if not installed

---

### **2️⃣ NODE.JS - JavaScript Runtime**

#### **Check if Already Installed:**
```bash
node --version
# Should show: v18.x.x or v20.x.x or higher

npm --version
# Should show: 9.x.x or 10.x.x or higher
```

#### **If Not Installed:**

**Download:** https://nodejs.org

**Choose:** LTS (Long Term Support) version - currently v20.x.x

**Installation Steps:**
1. Download Windows Installer (.msi) - 64-bit
2. Run the installer
3. **Important Settings:**
   - ✅ Accept license agreement
   - ✅ Keep default installation path: `C:\Program Files\nodejs\`
   - ✅ **Check:** "Automatically install necessary tools" (includes Python, Visual Studio Build Tools)
   - ✅ Install
4. If prompted to install additional tools, click "Yes" (installs Chocolatey, Python, VS Build Tools)
5. Wait for installation (may take 10-15 minutes)
6. Click "Finish"
7. **Restart Command Prompt** (important!)
8. Verify: `node --version` and `npm --version`

**Alternative Quick Install (Using Chocolatey):**
```bash
# If you have Chocolatey installed:
choco install nodejs-lts -y
```

**Time:** 10-20 minutes (includes build tools)  
**Status Office:** ⏳ Need to check  
**Status Home:** ⏳ Need to check tonight

**After Installation:**
```bash
# Verify both are installed
node --version
npm --version

# Update npm to latest (optional)
npm install -g npm@latest
```

---

### **3️⃣ POSTGRESQL - Database**

You have **TWO OPTIONS**: Local installation or Cloud database

---

#### **OPTION A: Local PostgreSQL (Traditional)**

#### **Check if Already Installed:**
```bash
psql --version
# Should show: psql (PostgreSQL) 15.x or 16.x
```

#### **If Not Installed:**

**Download:** https://www.postgresql.org/download/windows/

**Installation Steps:**
1. Download Windows installer from EnterpriseDB
2. Run the installer (postgresql-16.x-windows-x64.exe)
3. **Important Settings:**
   - Installation Directory: `C:\Program Files\PostgreSQL\16`
   - ✅ PostgreSQL Server
   - ✅ pgAdmin 4 (graphical tool)
   - ✅ Stack Builder (optional)
   - ✅ Command Line Tools
4. **Set Password:** 
   - Choose a **strong password**
   - **WRITE IT DOWN!** You'll need it later
   - Recommended: Use same password at office and home
5. Port: 5432 (default)
6. Locale: Default locale
7. Click "Next" through remaining steps
8. Uncheck "Launch Stack Builder" at end
9. Click "Finish"

**Configuration (After Install):**
```bash
# Add PostgreSQL to PATH (if not automatic)
# Right-click "This PC" → Properties → Advanced → Environment Variables
# Add to Path: C:\Program Files\PostgreSQL\16\bin

# Test connection
psql -U postgres
# Enter your password
# Type \q to quit
```

**Time:** 15-20 minutes  
**Disk Space:** ~350 MB

---

#### **OPTION B: Cloud Database (Easier, Recommended)**

Use **Railway** or **Supabase** - Free tier is sufficient!

**Why Cloud Database?**
- ✅ No local installation needed
- ✅ Accessible from office AND home automatically
- ✅ Automatic backups
- ✅ Free tier is generous
- ✅ No configuration headaches
- ✅ Same database everywhere!

**Railway Setup (Recommended):**

1. Go to: https://railway.app
2. Click "Start a New Project"
3. Sign up with GitHub
4. Click "New Project" → "Provision PostgreSQL"
5. Wait 30 seconds (database created!)
6. Click on PostgreSQL service
7. Go to "Connect" tab
8. Copy the **DATABASE_URL** (looks like: `postgresql://username:password@host:port/database`)
9. Save this URL - you'll use it in both office and home!

**Connection String Format:**
```
postgresql://user:password@hostname.railway.app:5432/railway
```

**Time:** 5 minutes  
**Cost:** Free (500 MB storage, enough for development)

**Supabase Alternative:**
1. Go to: https://supabase.com
2. Sign up with GitHub
3. Create new project
4. Copy database connection string
5. Done!

---

**🎯 RECOMMENDATION:**

**For Office:** Local PostgreSQL (you're always here)  
**For Home:** Use Railway cloud database OR local install

**Best Setup:**
- Development: Local PostgreSQL (fast, offline)
- Testing: Railway (cloud, always accessible)
- Production (later): Railway or dedicated server

---

### **4️⃣ VS CODE - Code Editor (Optional but Recommended)**

#### **Check if Already Installed:**
- Look for VS Code in Start Menu
- Or run: `code --version`

#### **If Not Installed:**

**Download:** https://code.visualstudio.com

**Installation Steps:**
1. Download Windows installer (VSCodeUserSetup-x64-1.x.x.exe)
2. Run the installer
3. **Important Settings:**
   - ✅ Accept the agreement
   - ✅ Add "Open with Code" to context menu
   - ✅ Add to PATH
   - ✅ Register Code as editor for supported file types
4. Click "Install"
5. Click "Finish"

**Recommended Extensions (Install After):**
```
1. ESLint - Code quality
2. Prettier - Code formatting
3. GitLens - Git superpowers
4. Prisma - Database schema
5. Tailwind CSS IntelliSense - CSS autocomplete
6. ES7+ React/Redux/React-Native snippets - React helpers
```

**To Install Extensions:**
1. Open VS Code
2. Click Extensions icon (left sidebar)
3. Search for extension name
4. Click "Install"

**Time:** 10 minutes (including extensions)  
**Status:** Optional but highly recommended

---

### **5️⃣ ADDITIONAL TOOLS**

These will be installed automatically via npm when we start development:

- **Prisma** - Database ORM
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Express** - Backend framework
- **React** - Frontend library

**No manual installation needed!** They'll install via `npm install`.

---

## 📊 PREREQUISITES CHECKLIST

### **Office Computer**

**Run these commands and note the results:**

```bash
# 1. Check Git
git --version

# 2. Check Node.js
node --version
npm --version

# 3. Check PostgreSQL (if local)
psql --version

# 4. Check VS Code (optional)
code --version
```

**Checklist:**
- [ ] Git installed and configured
- [ ] Node.js v18+ installed
- [ ] npm v9+ installed
- [ ] PostgreSQL ready (local OR cloud URL saved)
- [ ] VS Code installed (optional)
- [ ] Git config set (name and email)

---

### **Home Computer**

**Tonight, run these and install what's missing:**

```bash
# 1. Check Git
git --version
# If missing: Download from https://git-scm.com

# 2. Check Node.js
node --version
npm --version
# If missing: Download from https://nodejs.org

# 3. Check PostgreSQL
psql --version
# If missing: Either install locally OR use Railway cloud URL

# 4. Check VS Code
code --version
# If missing: Download from https://code.visualstudio.com
```

**Home Setup Checklist:**
- [ ] Git installed
- [ ] Git configured (same name/email as office)
- [ ] Node.js installed
- [ ] npm working
- [ ] Database plan decided (local or cloud)
- [ ] VS Code installed (optional)
- [ ] Repository cloned from GitHub
- [ ] All files present

---

## 🎯 COMPLETE SETUP SUMMARY

### **What You Need at Both Office and Home:**

```
✅ Git (version control)
✅ Node.js + npm (development runtime)
✅ Database access:
   - Option A: Local PostgreSQL installed
   - Option B: Railway cloud URL (same at both!)
✅ VS Code (optional but nice to have)
```

### **What's Different at Office vs Home:**

```
Office:
- Project created here (git init)
- Local PostgreSQL recommended
- Full development environment

Home:
- Project cloned here (git clone)
- Can use same cloud database as office
- Same development environment
```

### **What's Shared Between Both:**

```
✅ GitHub repository (cloud sync)
✅ Cloud database (if using Railway/Supabase)
✅ Same Git config (name, email)
✅ Same codebase (via git push/pull)
```

---

## 🌙 TONIGHT'S COMPLETE HOME SETUP

### **Step 1: Install Required Software** (30 minutes)

```bash
# A. Check what's already installed
git --version
node --version
psql --version

# B. Install missing software
# - Git: https://git-scm.com/download/win
# - Node.js: https://nodejs.org (LTS version)
# - PostgreSQL: https://www.postgresql.org/download/windows/
#   OR use Railway: https://railway.app
# - VS Code: https://code.visualstudio.com

# C. Configure Git (after installing)
git config --global user.name "varunsharda1987"
git config --global user.email "admin@kasya.in"
git config --global core.autocrlf true

# D. Verify everything
git --version
node --version
npm --version
psql --version  # or have Railway URL ready
```

**Checklist:**
- [ ] All software installed
- [ ] All versions verified
- [ ] Git configured
- [ ] Database ready

---

### **Step 2: Clone Repository** (5 minutes)

```bash
# Navigate to where you want the project
cd C:\Users\[YourName]\Desktop

# Clone from GitHub
git clone https://github.com/varunsharda1987/garment-erp.git

# Enter the folder
cd garment-erp

# Verify files
dir
# Should see: docs/, README.md, .gitignore

# Check Git status
git status
# Should say: "nothing to commit, working tree clean"
```

**Checklist:**
- [ ] Repository cloned
- [ ] All files present
- [ ] Git status clean

---

### **Step 3: Test Everything** (5 minutes)

```bash
# Test Git
git log --oneline
# Should show your initial commit

# Test Node.js
node -e "console.log('Node.js is working!')"
# Should print: Node.js is working!

# Test npm
npm --version
# Should show version number

# Test database connection (if using Railway)
# We'll test this later when we start Phase 1
```

**Checklist:**
- [ ] Git working
- [ ] Node.js working
- [ ] npm working
- [ ] Ready to start development!

---

<a name="comparison"></a>

## 📍 OFFICE vs HOME SETUP COMPARISON

| Aspect | Office Computer | Home Computer |
|--------|----------------|---------------|
| **Setup Method** | ✅ Already done (git init + push) | ⏳ Tonight (git clone) |
| **Location** | `C:\Users\admin\Desktop\garment-erp` | Your choice - any path! |
| **Git Config** | ✅ Set (varunsharda1987, admin@kasya.in) | ⏳ Need to set (same details) |
| **Files** | ✅ Created locally, pushed to GitHub | ⏳ Will download from GitHub |
| **Setup Time** | Already done | 5-10 minutes tonight |
| **Command Used** | `git init` (started fresh) | `git clone` (download existing) |

**Key Difference:**
- **Office:** You CREATED the project here (git init → git push)
- **Home:** You'll DOWNLOAD the project (git clone)
- **Both:** Work exactly the same after setup!

---

## 🏢 OFFICE WORKFLOW

### **Office Setup** ✅ YOU'VE ALREADY DONE THIS

**Current Office Setup:**
- Location: `C:\Users\admin\Desktop\garment-erp`
- Git initialized: ✅
- GitHub connected: ✅
- First commit pushed: ✅
- Status: Ready to work!

**You don't need to do this again at office - this is just for reference.**

---

### **Starting Work at Office**

```bash
# 1. Open Command Prompt (Win + R, type 'cmd', Enter)

# 2. Navigate to project
cd C:\Users\admin\Desktop\garment-erp

# 3. Get latest changes from home (if you worked from home)
git pull

# 4. Check status
git status

# Now start working!
```

**Time:** 10 seconds

---

### **During Work at Office**

```bash
# Check what files you've changed
git status

# See what you've changed (optional)
git diff
```

---

### **End of Day at Office**

```bash
# 1. Navigate to project
cd C:\Users\admin\Desktop\garment-erp

# 2. Check what changed
git status

# 3. Add all changes
git add .

# 4. Commit with a message
git commit -m "Describe what you did today"

# 5. Push to GitHub
git push

# Done! Your work is backed up and ready for home
```

**Examples of good commit messages:**
```bash
git commit -m "Added customer management module"
git commit -m "Fixed bug in order calculation"
git commit -m "Updated production tracking dashboard"
git commit -m "Work in progress - order form"
```

**Time:** 30 seconds

---

## 🏠 HOME WORKFLOW

### **First Time Setup at Home** ⭐ YOU'LL DO THIS TONIGHT

**Prerequisites at Home Computer:**
- Git installed (download from https://git-scm.com if needed)
- Node.js installed (download from https://nodejs.org if needed)
- Internet connection

**Step-by-Step Setup:**

#### **Step 1: Open Command Prompt**
```bash
# Press Win + R
# Type: cmd
# Press Enter
```

#### **Step 2: Choose Your Project Location**

Decide where you want the project. Examples:
- `C:\Users\[YourName]\Desktop\garment-erp`
- `D:\Projects\garment-erp`
- `C:\Work\garment-erp`

**Any location works! Different from office is perfectly fine.**

```bash
# Navigate to parent folder (example using Desktop):
cd C:\Users\[YourName]\Desktop

# Or if using D drive:
cd D:\

# Or create a Projects folder:
mkdir C:\Projects
cd C:\Projects
```

#### **Step 3: Clone the Repository from GitHub**

```bash
# This downloads ALL your code from GitHub
git clone https://github.com/varunsharda1987/garment-erp.git
```

**What happens:**
- Creates `garment-erp` folder
- Downloads all 8 files from GitHub
- Sets up Git automatically
- Ready to work!

**Output you'll see:**
```
Cloning into 'garment-erp'...
remote: Enumerating objects: 11, done.
remote: Counting objects: 100% (11/11), done.
remote: Compressing objects: 100% (11/11), done.
remote: Total 11 (delta 0), reused 11 (delta 0), pack-reused 0
Receiving objects: 100% (11/11), 45.04 KiB | 7.51 MiB/s, done.
```

#### **Step 4: Enter the Project**

```bash
cd garment-erp
```

#### **Step 5: Verify Git is Connected**

```bash
# Check remote connection
git remote -v

# Should show:
# origin  https://github.com/varunsharda1987/garment-erp.git (fetch)
# origin  https://github.com/varunsharda1987/garment-erp.git (push)

# Check your files are there
dir

# Should show:
# docs/
# .gitignore
# README.md
```

#### **Step 6: Set Git Config (Same as Office)**

```bash
# Set your name (same as office)
git config --global user.name "varunsharda1987"

# Set your email (same as office)
git config --global user.email "admin@kasya.in"

# Verify
git config --global user.name
git config --global user.email
```

#### **Step 7: Install Dependencies (When Project Has Code)**

**Note:** Right now, frontend and backend folders don't exist yet (we haven't started building). Skip this step for now. Come back to it after Phase 1.

**When we start Phase 1, you'll run:**
```bash
# Install frontend dependencies
cd frontend
npm install
cd ..

# Install backend dependencies
cd backend
npm install
cd ..
```

#### **Step 8: Test Everything Works**

```bash
# Check status
git status

# Should show: "On branch main" and "nothing to commit, working tree clean"

# View your commit
git log --oneline

# Should show: "a9088f6 Initial commit: Planning and documentation complete"
```

**✅ Done! Home setup complete!**

**Time:** 5-10 minutes (first time only)

---

## 🌙 TONIGHT'S HOME SETUP CHECKLIST

**Before You Start:**
- [ ] Home computer has internet connection
- [ ] Git installed (check: `git --version`)
- [ ] Node.js installed - optional for now (check: `node --version`)

**Setup Steps:**
```bash
# 1. Open Command Prompt
# Win + R, type 'cmd', Enter

# 2. Go to where you want the project
cd C:\Users\[YourName]\Desktop

# 3. Clone from GitHub (downloads everything)
git clone https://github.com/varunsharda1987/garment-erp.git

# 4. Enter the folder
cd garment-erp

# 5. Set your Git identity
git config --global user.name "varunsharda1987"
git config --global user.email "admin@kasya.in"

# 6. Verify everything works
git status
git log --oneline
dir
```

**Expected Output:**
- ✅ `garment-erp` folder created
- ✅ All 8 files present (README.md, docs/, .gitignore)
- ✅ `git status` shows "nothing to commit, working tree clean"
- ✅ `git log` shows your initial commit

**Done! You're ready to work from home!** 🏠

---

## 🔄 AUTHENTICATION AT HOME

**When you first push from home, GitHub will ask for login:**

**Option A: Browser Authentication (Easiest)**
- Browser opens automatically
- Log into GitHub
- Click "Authorize"
- Done!

**Option B: Personal Access Token**
- Username: `varunsharda1987`
- Password: Use your GitHub Personal Access Token (not regular password)
- Same token you created at office should work

**Note:** After first successful authentication, Windows will remember it.

---

### **Quick Home Setup Summary**

```bash
# 1. Open Command Prompt
cd C:\Users\[YourName]\Desktop

# 2. Clone from GitHub
git clone https://github.com/varunsharda1987/garment-erp.git

# 3. Enter project
cd garment-erp

# 4. Set Git config
git config --global user.name "varunsharda1987"
git config --global user.email "admin@kasya.in"

# 5. Verify
git status
git log --oneline

# Done! Ready to work from home!
```

---

### **Starting Work at Home**

**First Time (After Setup):**
```bash
# 1. Navigate to project
cd [your-home-path]\garment-erp

# 2. Pull latest (even though just cloned, good habit)
git pull

# 3. Check status
git status

# Now start working!
```

**Every Other Time:**
```bash
# 1. Navigate to project
cd [your-home-path]\garment-erp

# 2. Get latest changes from office
git pull

# 3. Check status
git status

# Now start working!
```

**Time:** 10 seconds

---

### **End of Day at Home**

```bash
# 1. Navigate to project
cd [your-home-path]\garment-erp

# 2. Check what changed
git status

# 3. Add all changes
git add .

# 4. Commit with a message
git commit -m "Work done from home: [description]"

# 5. Push to GitHub
git push

# Done! Changes ready for office tomorrow
```

**Time:** 30 seconds

---

## 🧪 TESTING OFFICE ↔ HOME SYNC

**After setting up home, test the sync to make sure it works!**

### **Test 1: Make a Change at Home**

```bash
# At home computer:
cd [your-home-path]\garment-erp

# Create a test file
echo "Testing sync from home" > test-sync.txt

# Stage and commit
git add test-sync.txt
git commit -m "Test sync from home computer"

# Push to GitHub
git push

# Check on GitHub:
# Visit https://github.com/varunsharda1987/garment-erp
# You should see test-sync.txt appear!
```

### **Test 2: Get the Change at Office**

```bash
# Next day at office:
cd C:\Users\admin\Desktop\garment-erp

# Pull the change
git pull

# Check if file appeared
dir

# You should see test-sync.txt!
```

**✅ If you see the file at office, sync is working perfectly!**

### **Test 3: Round Trip Test**

```bash
# At office, make another change:
echo "Reply from office" >> test-sync.txt
git add test-sync.txt
git commit -m "Updated from office"
git push

# At home, pull the change:
git pull

# Check the file
type test-sync.txt

# Should show both lines:
# Testing sync from home
# Reply from office
```

**✅ If both lines appear, sync is 100% working!**

**After testing, delete the test file:**
```bash
git rm test-sync.txt
git commit -m "Removed test file"
git push
```

---

### **The Big 5 Commands**

```bash
# 1. Check status (what changed?)
git status

# 2. Stage all changes
git add .

# 3. Save with message
git commit -m "Your message here"

# 4. Upload to GitHub
git push

# 5. Download from GitHub
git pull
```

**Memorize these 5 - you'll use them daily!**

---

## 📋 GIT CHEAT SHEET

### **Information Commands**
```bash
# What files changed?
git status

# What's the actual changes in files?
git diff

# View commit history
git log --oneline

# View last 5 commits
git log --oneline -5

# Who am I configured as?
git config --global user.name
git config --global user.email

# Is GitHub connected?
git remote -v
```

---

### **Basic Workflow Commands**
```bash
# Stage specific file
git add filename.txt

# Stage all changes
git add .

# Commit staged changes
git commit -m "Your message"

# Push to GitHub
git push

# Pull from GitHub
git pull
```

---

### **Branch Commands (Advanced - For Later)**
```bash
# See all branches
git branch

# Create new branch
git branch feature-name

# Switch to branch
git checkout feature-name

# Create and switch in one command
git checkout -b feature-name

# Merge branch into main
git checkout main
git merge feature-name
```

---

## 🚨 HOME SETUP TROUBLESHOOTING

### **Problem: Git Not Installed at Home**

**Symptoms:**
```
'git' is not recognized as an internal or external command
```

**Solution:**
1. Download Git: https://git-scm.com/download/win
2. Install with default settings
3. Restart Command Prompt
4. Verify: `git --version`

---

### **Problem: Clone Asks for Authentication**

**Solution:**
- Enter username: `varunsharda1987`
- Enter password: Use GitHub Personal Access Token (not regular password)
- Or browser window opens → Login to GitHub → Authorize

---

### **Problem: "Repository Not Found"**

**Possible Causes:**
1. Typo in repository URL
2. Not logged into correct GitHub account
3. Repository is private and you don't have access

**Solution:**
```bash
# Make sure URL is exactly:
git clone https://github.com/varunsharda1987/garment-erp.git

# Check you're logged into GitHub as varunsharda1987
```

---

### **Problem: Different Files at Home and Office**

**Symptoms:**
- Files missing at home
- Files different at home

**Solution:**
```bash
# At home, get latest from GitHub:
cd garment-erp
git fetch origin
git reset --hard origin/main

# This makes home EXACTLY like GitHub
```

---

### **Problem: Home and Office Out of Sync**

**Prevention:**
- Always `git pull` before starting work
- Always `git push` after finishing work
- If you forget, see "Scenario 1" in troubleshooting section

---

### **Problem: "Your branch is behind"**

**Solution:**
```bash
git pull
```

**What happened:** Someone (or you from another computer) pushed changes. Just pull them.

---

### **Problem: "Your branch is ahead"**

**Solution:**
```bash
git push
```

**What happened:** You have local commits not yet pushed to GitHub.

---

### **Problem: Merge Conflict**

**Symptoms:**
```
CONFLICT (content): Merge conflict in filename.txt
Automatic merge failed; fix conflicts and then commit the result.
```

**Solution:**
```bash
# 1. Open the conflicting file in VS Code or Notepad
# 2. Look for conflict markers:
#    <<<<<<< HEAD
#    your changes
#    =======
#    other changes
#    >>>>>>> branch-name

# 3. Edit the file to keep what you want

# 4. Remove the conflict markers

# 5. Stage and commit
git add .
git commit -m "Resolved merge conflict"
git push
```

---

### **Problem: Accidentally Deleted Something**

**Solution (if not committed yet):**
```bash
# Restore one file
git restore filename.txt

# Restore all files
git restore .
```

**Solution (if already committed):**
```bash
# Go back to previous commit
git reset --hard HEAD~1

# Or go back to specific commit
git reset --hard commit-hash
```

⚠️ **Warning:** `git reset --hard` deletes changes permanently!

---

### **Problem: Want to Undo Last Commit (but keep changes)**

**Solution:**
```bash
# Undo commit, keep changes
git reset --soft HEAD~1

# Now you can edit and commit again
git add .
git commit -m "Better message"
git push
```

---

### **Problem: Pushed Wrong Code to GitHub**

**Solution:**
```bash
# Undo last commit locally
git reset --hard HEAD~1

# Force push (careful!)
git push --force
```

⚠️ **Warning:** Only do this if working alone!

---

## 🎯 COMMON SCENARIOS

### **Scenario 1: Forgot to Pull Before Starting Work**

```bash
# You made changes, but GitHub has updates too

# 1. Stash your changes temporarily
git stash

# 2. Pull from GitHub
git pull

# 3. Apply your changes back
git stash pop

# 4. Resolve conflicts if any
# 5. Commit and push
git add .
git commit -m "Your message"
git push
```

---

### **Scenario 2: Need to Switch Computers Mid-Work**

```bash
# At current computer:
git add .
git commit -m "Work in progress - switching computers"
git push

# At other computer:
git pull
# Continue working
```

---

### **Scenario 3: Want to Experiment Without Breaking Main Code**

```bash
# Create experimental branch
git checkout -b experiment

# Make changes, test, commit
git add .
git commit -m "Testing new feature"

# If it works, merge to main:
git checkout main
git merge experiment

# If it doesn't work, just delete branch:
git checkout main
git branch -D experiment
```

---

## 📊 WORKFLOW DIAGRAM

```
OFFICE COMPUTER                GITHUB (Cloud)              HOME COMPUTER
     ↓                              ↓                           ↓
  Work here              ←→  git push/pull  ←→            Work here
     ↓                              ↓                           ↓
  Save work                    Sync point                  Save work
     ↓                              ↓                           ↓
  git push  →  Upload  →       GitHub  ←  Download  ←   git pull
```

---

## ✅ BEST PRACTICES

### **DO's** ✅

1. **Commit Often**
   - Small, logical commits
   - Better than one giant commit

2. **Pull Before Starting**
   - Always `git pull` before working
   - Prevents conflicts

3. **Push at End of Day**
   - Don't leave uncommitted work
   - Your work is backed up

4. **Write Good Messages**
   - "Added customer form" ✅
   - "Updated files" ❌

5. **Check Status Frequently**
   - `git status` shows what's changed
   - Run it often!

---

### **DON'Ts** ❌

1. **Don't Skip `git pull`**
   - Always pull before pushing
   - Prevents conflicts

2. **Don't Commit Sensitive Data**
   - Never commit passwords, API keys
   - Use .env files (they're ignored)

3. **Don't Force Push (unless alone)**
   - `git push --force` can break things
   - Only use if you know what you're doing

4. **Don't Commit `node_modules/`**
   - Already in .gitignore
   - Too large, not needed

5. **Don't Panic on Errors**
   - Git can undo almost anything
   - Refer to troubleshooting section

---

## 🔐 SYNOLOGY BACKUP STRATEGY

Use Synology for additional backup:

### **Weekly Backup to Synology**

```bash
# Navigate to project
cd C:\Users\admin\Desktop\garment-erp

# Create backup folder name with date
# Manual copy to Synology:

# Copy entire folder to:
Z:\1. Kashaya Fabs\garment-erp-backups\backup-2025-10-16\
```

**Or use automated backup script (future):**
- Backup runs every night
- Keeps last 7 days of backups
- Extra safety net

---

## 📞 QUICK HELP

### **Stuck? Run These First:**
```bash
# Where am I?
cd

# What's the status?
git status

# What's in the log?
git log --oneline -5

# What's my remote?
git remote -v
```

### **Most Common Fix:**
```bash
# When in doubt, pull first
git pull

# Then check status
git status
```

---

## 🎓 LEARNING MORE

### **Understanding Git Stages:**

```
Working Directory  →  Staging Area  →  Repository  →  GitHub
     (files)         (git add)      (git commit)   (git push)
```

**Example:**
```bash
# 1. Edit customer.tsx (Working Directory)
# 2. git add .           (Staging Area)
# 3. git commit -m "..."  (Local Repository)
# 4. git push            (GitHub)
```

---

## 🚀 ADVANCED TIPS (FOR LATER)

### **Viewing File History**
```bash
# See all changes to a file
git log --follow filename.txt

# See who changed what
git blame filename.txt
```

---

### **Going Back in Time**
```bash
# View project as it was 3 commits ago
git checkout HEAD~3

# Go back to present
git checkout main
```

---

### **Cherry-Pick a Commit**
```bash
# Apply a specific commit from another branch
git cherry-pick commit-hash
```

---

## 📝 TONIGHT'S HOME SETUP - COMPLETE CHECKLIST

**Print this or keep it open on your phone!**

### **Step 1: Prerequisites** (5 minutes)

- [ ] Turn on home computer
- [ ] Connect to internet
- [ ] Check Git installed: Open CMD, type `git --version`
  - If not installed: Download from https://git-scm.com
- [ ] (Optional) Check Node.js: `node --version`
  - If not installed: Download from https://nodejs.org

### **Step 2: Choose Location** (1 minute)

Decide where to put project:
- [ ] Option A: Desktop → `C:\Users\[YourName]\Desktop`
- [ ] Option B: D Drive → `D:\Projects`
- [ ] Option C: Custom → Your choice

Write it down: ___________________________________

### **Step 3: Clone Repository** (2 minutes)

```bash
# Open Command Prompt (Win + R, type cmd, Enter)

# Navigate to your chosen location
cd [your-chosen-path]

# Clone from GitHub
git clone https://github.com/varunsharda1987/garment-erp.git

# Wait for download (should take 10-30 seconds)

# Enter the folder
cd garment-erp
```

- [ ] Clone completed successfully
- [ ] Entered garment-erp folder

### **Step 4: Configure Git** (1 minute)

```bash
# Set name (same as office)
git config --global user.name "varunsharda1987"

# Set email (same as office)
git config --global user.email "admin@kasya.in"

# Verify
git config --global user.name
git config --global user.email
```

- [ ] Name configured
- [ ] Email configured
- [ ] Both verified

### **Step 5: Verify Everything** (1 minute)

```bash
# Check Git status
git status
# Should say: "On branch main, nothing to commit, working tree clean"

# View commit history
git log --oneline
# Should show: "a9088f6 Initial commit: Planning and documentation complete"

# List files
dir
# Should show: docs folder, README.md, .gitignore
```

- [ ] Git status clean
- [ ] Commit visible
- [ ] Files present

### **Step 6: Test Sync** (2 minutes)

```bash
# Create test file
echo "Testing from home computer" > test-home.txt

# Add and commit
git add test-home.txt
git commit -m "Test from home computer"

# Push to GitHub (authentication may be required)
git push

# Check GitHub in browser:
# Visit: https://github.com/varunsharda1987/garment-erp
# Look for test-home.txt - should be there!
```

- [ ] Test file created
- [ ] Pushed successfully
- [ ] Visible on GitHub

### **Step 7: Clean Up Test** (1 minute)

```bash
# Remove test file
git rm test-home.txt
git commit -m "Removed test file"
git push
```

- [ ] Test file removed
- [ ] Changes pushed

### **✅ DONE!** 

**Home setup complete! Tomorrow morning at office, test by running:**
```bash
cd C:\Users\admin\Desktop\garment-erp
git pull
```

**You should see the test file removal message!**

---

## 🎯 QUICK REFERENCE CARDS

### **📍 Office Card**
```
LOCATION: C:\Users\admin\Desktop\garment-erp

MORNING:
cd C:\Users\admin\Desktop\garment-erp
git pull

EVENING:
git add .
git commit -m "Office work: [description]"
git push
```

### **📍 Home Card**  
```
LOCATION: [Fill in after setup tonight]
_________________________________________

EVENING:
cd [your-home-path]\garment-erp
git pull

NIGHT:
git add .
git commit -m "Home work: [description]"
git push
```

**Print these and stick them on your monitors!** 📌

---

### **Morning:**
- [ ] Open Command Prompt
- [ ] `cd` to project folder
- [ ] `git pull`
- [ ] `git status`
- [ ] Start working

### **During Day:**
- [ ] Make changes
- [ ] Test frequently
- [ ] Commit logical chunks (optional)

### **Evening:**
- [ ] `git status` (check what changed)
- [ ] `git add .`
- [ ] `git commit -m "Description"`
- [ ] `git push`
- [ ] Verify on GitHub (optional)

---

## 🆘 EMERGENCY COMMANDS

### **Undo Everything (Nuclear Option)**
```bash
# Discard ALL local changes
git reset --hard HEAD
git clean -fd

# Get fresh copy from GitHub
git pull
```

⚠️ **WARNING:** This deletes all uncommitted work!

---

### **Start Fresh (Extreme Nuclear Option)**
```bash
# Delete entire folder
# Re-clone from GitHub
cd C:\Users\admin\Desktop
rmdir /s garment-erp
git clone https://github.com/varunsharda1987/garment-erp.git
cd garment-erp
```

---

## 📚 USEFUL RESOURCES

### **Quick Reference:**
- Official Git Cheat Sheet: https://education.github.com/git-cheat-sheet-education.pdf
- Visual Git Guide: https://marklodato.github.io/visual-git-guide/index-en.html

### **Video Tutorials:**
- Git in 15 minutes: https://www.youtube.com/watch?v=USjZcfj8yxE
- GitHub Basics: https://www.youtube.com/watch?v=0fKg7e37bQE

### **Interactive Learning:**
- Learn Git Branching: https://learngitbranching.js.org/

---

## 💡 REMEMBER

1. **Git = Time Machine** - You can always go back
2. **GitHub = Cloud Backup** - Your work is safe
3. **Commit Often** - Small saves are better
4. **Pull First** - Always sync before starting
5. **Push Daily** - Don't leave work unsaved

---

## ✅ COMPLETE SETUP STATUS (FINAL)

### **Office Computer - 100% Ready:**
| Item | Status | Details |
|------|--------|---------|
| **Git** | ✅ Complete | v2.51.0 |
| **Git Config** | ✅ Complete | varunsharda1987 / admin@kasya.in |
| **Node.js** | ✅ Complete | v22.18.0 |
| **npm** | ✅ Complete | v11.5.2 |
| **VS Code** | ✅ Complete | v1.105.0 |
| **PostgreSQL** | ✅ Complete | Railway cloud database |
| **Project Folder** | ✅ Complete | C:\Users\admin\Desktop\garment-erp |
| **GitHub Repo** | ✅ Complete | Connected and syncing |
| **Database URL** | ✅ Complete | Saved in .env |
| **Initial Commit** | ✅ Complete | All files pushed |
| **Ready for Dev** | ✅ **YES!** | 100% Ready |

---

### **Home Computer - 100% Ready:**
| Item | Status | Details |
|------|--------|---------|
| **Git** | ✅ Complete | v2.47.1 |
| **Git Config** | ✅ Complete | varunsharda1987 / admin@kasya.in |
| **Node.js** | ✅ Complete | v22.20.0 |
| **npm** | ✅ Complete | v10.9.3 |
| **VS Code** | ✅ Complete | Installed |
| **PostgreSQL** | ✅ Complete | Railway cloud database (same as office) |
| **Project Folder** | ✅ Complete | C:\Users\DESKTOP\Desktop\garment-erp |
| **Repository** | ✅ Complete | Cloned from GitHub |
| **Database URL** | ✅ Complete | Saved in .env |
| **Sync Test** | ✅ Complete | Tested and working |
| **Ready for Dev** | ✅ **YES!** | 100% Ready |

---

### **Project Status - 100% Complete:**
| Component | Status |
|-----------|--------|
| **Planning Documents** | ✅ 10 docs, 6000+ lines |
| **Git Repository** | ✅ Created, private |
| **GitHub Connection** | ✅ Both computers syncing |
| **Office Computer** | ✅ 100% Ready |
| **Home Computer** | ✅ 100% Ready |
| **Database** | ✅ Railway PostgreSQL |
| **Sync Tested** | ✅ Working perfectly |
| **Ready for Phase 1** | ✅ **START TOMORROW!** |

**Status: 🎉 SETUP COMPLETE - READY TO BUILD!**

---

## 📞 CONTACT

**If Completely Stuck:**
1. Take a screenshot of the error
2. Run `git status` and screenshot
3. Ask for help with both screenshots
4. We'll fix it together!

**Remember:** Git saves everything. You can't permanently break anything! 🚀

---

**Document Version:** 5.0 - Setup Complete! Both Office and Home Ready  
**Last Updated:** October 16, 2025 (Night - All Setup Complete!)  
**Keep this handy during entire project!** 📌

**Changes in v5.0:**
- ✅ Updated status: Both office and home setup complete
- ✅ Marked all home setup tasks as completed
- ✅ Added actual versions of installed software at both locations
- ✅ Confirmed sync is tested and working
- ✅ Added "Ready for Development" status
- ✅ Updated all checklists to show completion
- ✅ Ready to start Phase 1 tomorrow!

**Status:**
- Office Setup: ✅ 100% Complete
- Home Setup: ✅ 100% Complete
- Sync Working: ✅ Tested and verified
- Ready for Development: ✅ YES - Start Phase 1 tomorrow!

**Next:** Use START_DEVELOPMENT.md for handoff to Claude Code

---

## 📍 CURRENT STATUS (End of Day - Office)

### **Office Computer - What's Done:**
| Item | Status | Details |
|------|--------|---------|
| Git | ✅ Installed | v2.51.0 |
| Git Config | ✅ Done | varunsharda1987 / admin@kasya.in |
| Node.js | ✅ Installed | v22.18.0 |
| npm | ✅ Installed | v11.5.2 |
| VS Code | ✅ Installed | v1.105.0 |
| Database | ⏳ 95% Done | Railway created, need to copy URL |
| Project | ✅ Created | All files committed and pushed |
| GitHub | ✅ Connected | https://github.com/varunsharda1987/garment-erp |

**Action Item:** Copy Railway DATABASE_URL from Variables tab (5 minutes tonight or tomorrow)

---

### **Home Computer - Tonight's Tasks:**
| Task | Time | Guide Section |
|------|------|---------------|
| Check installed software | 5 min | Part 1A |
| Install Git (if needed) | 10 min | Part 1B |
| Install Node.js (if needed) | 15 min | Part 1C |
| Install VS Code (optional) | 10 min | Part 1D |
| Get Railway database URL | 5 min | Part 2 |
| Clone repository | 10 min | Part 3 |
| Configure database | 5 min | Part 4 |
| Test everything | 5 min | Part 5 |
| Test sync | 5 min | Part 6 |
| Final verification | 2 min | Part 7 |
| **TOTAL** | **45-65 min** | Complete Guide Above |

---

## 🎯 TONIGHT'S PRIORITY LIST

**HIGH PRIORITY (Must Complete):**
1. ✅ Install Git (if not already installed)
2. ✅ Install Node.js (if not already installed)
3. ✅ Configure Git with same details as office
4. ✅ Clone repository from GitHub
5. ✅ Get Railway DATABASE_URL and save to .env
6. ✅ Test git pull/push

**MEDIUM PRIORITY (Should Complete):**
7. ✅ Install VS Code
8. ✅ Test sync with test file
9. ✅ Verify everything works

**LOW PRIORITY (Nice to Have):**
10. ⭐ Install VS Code extensions (can do later)
11. ⭐ Customize settings (can do later)

---

## 📱 QUICK REFERENCE - SAVE THIS!

### **Key URLs:**
- GitHub Repo: https://github.com/varunsharda1987/garment-erp
- Railway: https://railway.app
- Git Download: https://git-scm.com/download/win
- Node.js Download: https://nodejs.org
- VS Code Download: https://code.visualstudio.com

### **Your Details:**
- GitHub Username: varunsharda1987
- Email: admin@kasya.in
- Office Location: C:\Users\admin\Desktop\garment-erp
- Home Location: [Set tonight - your choice!]

### **Most Used Commands:**
```bash
# Daily workflow
git pull          # Get latest changes
git status        # Check what changed
git add .         # Stage all changes
git commit -m ""  # Save with message
git push          # Upload to GitHub

# Verification
node --version    # Check Node.js
npm --version     # Check npm
git --version     # Check Git
```

---

## 📞 QUICK HELP LINKS

**Official Documentation:**
- Git: https://git-scm.com/doc
- Node.js: https://nodejs.org/en/docs
- PostgreSQL: https://www.postgresql.org/docs
- VS Code: https://code.visualstudio.com/docs
- Railway: https://docs.railway.app

**Download Links:**
- Git: https://git-scm.com/download/win
- Node.js: https://nodejs.org (LTS version)
- PostgreSQL: https://www.postgresql.org/download/windows
- VS Code: https://code.visualstudio.com
- Railway: https://railway.app (sign up with GitHub)

**Verification Commands:**
```bash
git --version
node --version
npm --version
psql --version
code --version
```

**Configuration Commands:**
```bash
git config --global user.name "varunsharda1987"
git config --global user.email "admin@kasya.in"
git config --global core.autocrlf true
```

---

## 🎯 TONIGHT'S PRIORITY CHECKLIST

**HIGH PRIORITY (Must Do):**
- [ ] Install Git (if not installed)
- [ ] Install Node.js (if not installed)
- [ ] Configure Git with your details
- [ ] Clone repository from GitHub
- [ ] Test git pull/push

**MEDIUM PRIORITY (Should Do):**
- [ ] Setup database (Railway recommended)
- [ ] Install VS Code
- [ ] Install VS Code extensions
- [ ] Test sync with office

**LOW PRIORITY (Nice to Have):**
- [ ] Install local PostgreSQL
- [ ] Set up automated backups
- [ ] Customize VS Code settings

---

## 🚀 AFTER COMPLETE SETUP

**Once both office and home are fully set up, you can:**

✅ **Code from anywhere** - Office or home, seamless  
✅ **Sync instantly** - git push/pull in seconds  
✅ **Same database** - If using Railway, one source of truth  
✅ **No USB drives** - Everything in the cloud  
✅ **Version control** - Never lose work, can undo anything  
✅ **Collaborate** - (Future) Easy to add team members  
✅ **Deploy easily** - (Phase 9) Push to production  

**You'll have a professional development environment!** 🎉