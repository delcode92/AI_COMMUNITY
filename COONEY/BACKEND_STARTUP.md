# Backend Startup Guide (Working Solutions)

## Problem
You're seeing errors with:
- `tsx` (TypeScript execution tool)
- `better-sqlite3` (needs native build)
- `esbuild` version incompatibility

## Solution 1: Use nodemon (Simplest)

```bash
cd COONEY/backend

# Install nodemon
npm install -g nodemon

# Create simple TypeScript runner first
mkdir -p dist
npx tsc

# Run with nodemon (auto-reloads)
nodemon --exec node dist/index.js
```

---

## Solution 2: Run tsx Directly (Skip watch mode)

```bash
cd COONEY/backend

# Just run once (no hot reload)
npx tsx src/index.ts &

# Check it's running
curl http://localhost:5000/api/health
```

---

## Solution 3: Use Node with ts-node (Alternative)

```bash
cd COONEY/backend

# Install ts-node
pnpm add -D ts-node

# Run
npx ts-node src/index.ts &
```

---

## Solution 4: Fix pnpm properly

```bash
cd COONEY/backend

# Clear pnpm store
pnpm store prune

# Remove old modules
rm -rf node_modules

# Set pnpm to allow builds
pnpm config set allow-builds true

# Reinstall
pnpm install

# Run
pnpm run dev:backend &
```

---

## Quick Test - Is Backend Running?

After starting any method above, test:

```bash
# Check health endpoint
curl http://localhost:5000/api/health

# Expected response:
# {"status":"ok","redis":true,"db":"connected"}
```

---

## Full Startup Sequence

Once backend is working:

```bash
# Terminal 1: Python search (if not running)
cd COONEY/backend/tools
python3 main.py &

# Terminal 2: Backend (pick one method above)
cd COONEY/backend
pnpm run dev:backend &

# Terminal 3: Frontend
cd COONEY
pnpm run dev:frontend
```

Then visit http://localhost:3000

---

## If Still Having Issues

Try this **simplest** approach:

```bash
cd COONEY/backend

# Just use tsc to compile once
npx tsc

# Then run with node
node dist/index.js &
```

This bypasses tsx/tsx watch entirely!

---

*Pick one solution and let me know which one works!*
