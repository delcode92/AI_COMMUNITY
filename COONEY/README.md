# 🚀 Cooney - Quick Start

## Prerequisites
- Node.js 20+
- Python 3.10+
- Redis (local or managed)

## Setup

### 1. Clone & Install
```bash
cd COONEY
pnpm install
cd backend && pnpm install && cd ..
cd backend/tools && pip install -r requirements.txt
```

### 2. Environment
```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Run Services
```bash
# Terminal 1 - Search service
cd backend/tools
python main.py

# Terminal 2 - Backend
cd backend
pnpm run dev

# Terminal 3 - Frontend
pnpm run dev
```

## API Endpoints

### Frontend → Backend Proxy (Next.js)
- `POST /api/chat` - Main chat
- `POST /api/search` - DuckDuckGo search + summarize
- `POST /api/quiz` - Generate quizzes
- `POST /api/diagram` - ASCII/Unicode diagrams
- `POST /api/roadmap` - Learning roadmaps

### Direct Backend
- `GET /api/skills` - List skills
- `GET /api/skills/:id` - Get skill config
- `POST /api/chat` - Chat with AI (skill-based)
- Health: `GET /api/health`

## Tech Stack
- **Frontend**: Next.js + Tailwind + Radix
- **Backend**: Express.js + Redis + SQLite
- **AI**: Groq (primary), OpenRouter (fallback)
- **Search**: Python ddgs → DuckDuckGo

## Development
```bash
# Dev mode (frontend + backend)
pnpm run dev

# Build
pnpm build
```

## Docker/Codespace
```bash
# Use .devcontainer/devcontainer.json for Codespace
# Git → Codespaces → Create new with COONEY repo
```
