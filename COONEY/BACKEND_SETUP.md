# Backend Setup Instructions

## Issue: better-sqlite3 Build Scripts

Better-sqlite3 requires native build scripts. If you see:

```
Ignored build scripts: better-sqlite3@9.6.0
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

## Solution

### Option 1: Approve Build Scripts (Recommended)
```bash
cd COONEY/backend

# Approve better-sqlite3 build scripts
pnpm approve-builds

# Then install
pnpm install

# Run backend
pnpm run dev:backend
```

### Option 2: Install with build scripts enabled
```bash
cd COONEY/backend

# Force install all build scripts
pnpm install --force

# Run backend
pnpm run dev:backend
```

### Option 3: Use pnpm's prebuilt mode
```bash
cd COONEY/backend

# Set pnpm to use prebuilt binaries
pnpm config set use-lockfile-v6 true

pnpm install

# Run backend
pnpm run dev:backend
```

---

## Complete Startup Command Sequence

After fixing the build scripts:

```bash
# Step 1: Approve build scripts
cd COONEY/backend
pnpm approve-builds

# Step 2: Install dependencies
pnpm install

# Step 3: Start Python search service (Terminal 1)
cd tools
python3 main.py
# Output: 🔍 DuckDuckGo Search server running on port 7777

# Step 4: Start backend (Terminal 2)
cd ..
pnpm run dev:backend
# Output: 🚀 Cooney Backend on port 5000

# Step 5: Start frontend (Terminal 3)
cd ..
pnpm run dev:frontend
# Output: ready in X ms
```

---

## Verify Installation

```bash
# Check better-sqlite3 is installed
cd COONEY/backend
pnpm list better-sqlite3

# Check Redis is running
redis-cli ping
# Expected: PONG

# Check backend starts
pnpm run dev:backend
# Should see: 🚀 Cooney Backend on port 5000
```

---

## Common Errors

### Error: cannot open shared library
```bash
# Install system dependencies (macOS)
brew install libpq

# Or (Linux/Ubuntu)
sudo apt-get install libpq-dev
```

### Error: Python not found
```bash
# Make sure Python 3.10+ is installed
python3 --version

# If not, install:
brew install python3  # macOS
sudo apt install python3  # Linux
```

### Error: Redis connection refused
```bash
# Start Redis (macOS)
brew services start redis

# Or (Linux)
sudo service redis start

# Verify
redis-cli ping
```

---

## Quick Test

After everything is set up:

```bash
# Test backend health
curl http://localhost:5000/api/health

# Expected response:
# {"status":"ok","redis":true,"db":"connected"}
```

---

*Follow these steps and your backend should start!* 🚀
