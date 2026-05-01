# How Cooney Works

Cooney is an AI-powered learning companion that connects frontend, backend, and AI services into a cohesive learning experience. This document explains the architecture and how each system works together.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Chat UI     │ │ Skill       │ │ Tools       │           │
│  │             │ │ Selector    │ │ (Search/    │           │
│  └──────┬──────┘ └──────┬──────┘ │ Quiz/etc)   │           │
│         │               │         └──────┬──────┘           │
│         └───────────────┴────────────────┘                  │
└───────────────────────┬─────────────────────────────────────┘
                        │ API Proxy (CORS, Auth, Rate Limit)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express.js)                      │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ API Routes      │  │ Services        │                  │
│  │ /api/chat       │  │ Skill Loader    │                  │
│  │ /api/search     │  │ AI Service      │                  │
│  │ /api/quiz       │  │                 │                  │
│  │ /api/diagram    │  └────────┬────────┘                  │
│  │ /api/roadmap    │           │                           │
│  └────────┬────────┘           │                           │
│           │                     │                           │
│           └──────────┬──────────┘                           │
│                      ▼                                      │
│  ┌─────────────────────────────────────────┐               │
│  │ SQLite Database                         │               │
│  │ - users                                 │               │
│  │ - progress (XP, levels)                 │               │
│  │ - quizzes                               │               │
│  │ - roadmaps                              │               │
│  │ - diagrams                              │               │
│  └─────────────────────────────────────────┘               │
│                                                             │
│  ┌─────────────────────────────────────────┐               │
│  │ Redis (Context Memory)                  │               │
│  │ - chat history per session              │               │
│  │ - 4K token context window               │               │
│  │ - 24h auto-expiry                       │               │
│  └─────────────────────────────────────────┘               │
└──────────────────────────────────────┬──────────────────────┘
                                       │ AI Calls
                                       │ HTTP Requests
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Groq API     │  │ OpenRouter   │  │ DuckDuckGo   │      │
│  │ (Primary AI) │  │ (Fallback)   │  │ (Search)     │      │
│  └──────────────┘  └──────────────┘  └──────┬───────┘      │
│                                              │              │
│  ┌──────────────────────────────────────────┴────────────┐ │
│  │ Python Search Service (localhost:7777)                │ │
│  │ - Uses ddgs library                                   │ │
│  │ - Returns search results                              │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Chat Flow

```
User Input
    │
    ▼
Frontend (app/page.tsx)
    │ - User selects skill (science, math, etc.)
    │ - Sends to /api/chat
    ▼
Next.js API Proxy (/app/api/chat/route.ts)
    │ - Hides backend URL from client
    │ - Provides CORS support
    ▼
Express Backend (/src/routes/api.ts)
    │
    ├─► Load Skill Config
    │    └─► Read .md file from /skills/default/
    │
    ├─► Get Redis Context
    │    └─► Last 50 messages for context
    │
    └─► Call AI Service
         ├─► Try Groq API (fast)
         └─► Fallback to OpenRouter
              │
              ▼
          AI Response
              │
              ├─► Save to Redis (context memory)
              ├─► Update SQLite (progress +10 XP)
              └─► Return to Frontend
```

### 2. Search Flow

```
User Input ("Search about gravity")
    │
    ▼
Frontend → /api/search
    │
    ▼
Backend → HTTP Request
    └─► http://localhost:7777/search (POST {query})
         │
         ▼
     Python Service (main.py)
         └─► ddgs.text(query) → DuckDuckGo results
              │
              └─► Return JSON array
                    │
                    ▼
               Backend
                   ├─► Summarize results via AI
                   ├─► Save to SQLite (progress +10 XP)
                   └─► Return {results, summary}
```

### 3. Quiz Generation Flow

```
User Input ("Generate quiz on quantum physics")
    │
    ▼
Frontend → /api/quiz
    │
    ▼
Backend
    ├─► Generate AI prompt with skill context
    ├─► Call AI: "Generate 5 MCQs about quantum physics"
    └─► AI returns JSON array
         │
         ▼
     SQLite Insert
         └─► Store questions, options, answers
                   │
                   ▼
              Frontend displays
```

### 4. Context Memory (Redis)

```
User: "What is photosynthesis?"
    │
    ▼
Redis Key: chat:user-12345
    │
    ├─► LPUSH {"role": "user", "content": "..."}
    ├─► LPUSH {"role": "assistant", "content": "..."}
    ├─► LTRIM to keep last 50 messages
    └─► EXPIRE key 86400 (24h)
         │
         ▼
     Next Query
         ├─► LRANGE 0 49 (get context)
         └─► Include in AI prompt
```

---

## Skill System

### Default Skills

Location: `/backend/skills/default/`

Each skill has a `.md` config file:

```yaml
name: Science Guide
description: Explore scientific concepts
system_prompt: |
  You are Cooney, a Science Guide AI...
  Key focus areas:
  - Biology & Life Sciences
  - Chemistry & Chemical Reactions
```

### Skill Router

```
User selects "Math Tutor"
    │
    ▼
Load /backend/skills/default/math.md
    │
    ▼
Extract system_prompt
    │
    ▼
Include in AI message
    └─► System: "You are Cooney, a Math Tutor AI... Emphasize problem-solving..."
         └─► User: "What is algebra?"
              └─► AI responds with math-focused explanation
```

---

## Progress Tracking (SQLite)

### Tables

**users**
- id, name, created_at

**progress** (per user per skill)
- user_id, skill, level, xp, mastered_concepts
- Auto-increments XP on chat/search

**quizzes**
- Stores generated quiz questions
- Tracks user answers and scores

**roadmaps**
- Stores learning paths
- Current step and completed steps

**diagrams**
- Stores generated ASCII/Unicode diagrams

---

## Next.js API Proxy

Purpose: CORS resolution and environment abstraction

### Why not call backend directly?

```
❌ Direct backend call:
Frontend → http://localhost:5000/api/chat
Problem: CORS blocked by browser

✅ Proxy approach:
Frontend → /api/chat (same origin)
          ↓
      Next.js → http://localhost:5000/api/chat
          ↓
      Backend → Process → Frontend
```

### API Routes

| Route | Purpose |
|-------|---------|
| `/api/chat` | Main chat conversation |
| `/api/skills` | List available skills |
| `/api/search` | DuckDuckGo search + summary |
| `/api/quiz` | Generate quiz questions |
| `/api/diagram` | Create ASCII/Unicode diagrams |
| `/api/roadmap` | Generate learning roadmaps |

---

## Thinking Indicator

Animated status shown while AI processes:

```
Cooney is working on search...
🔍 Searching DuckDuckGo...

Cooney is working on quiz...
📝 Generating quiz questions...

Cooney is working on diagram...
🎨 Creating visual representation...
```

---

## Development Setup

### Quick Start

```bash
# Terminal 1: Python search service
cd backend/tools
python main.py  # Runs on port 7777

# Terminal 2: Backend (Node.js)
cd backend
node dist/index.js  # Runs on port 5000

# Terminal 3: Frontend
cd ..
pnpm run dev  # Runs on port 3000
```

### Environment Variables (`.env`)

```bash
PORT=5000
REDIS_URL=redis://localhost:6379
SQLITE_PATH=./data/cooney.db
OPENROUTER_API_KEY=xxx
GROQ_API_KEY=xxx
BACKEND_URL=http://localhost:5000
```

### Bug Fixes Applied

- ✅ Skill ID `ai/ml-guide` normalizes to `ai-ml` in `getSkillById()`
- ✅ Malformed tool_calls return text immediately (no infinite loop)
- ✅ Redis methods verified: `lLen`, `lRange`, `lPush`, `lTrim`

---

## File Structure

```
COONEY/
├── app/                    # Next.js frontend
│   ├── api/               # API proxy routes
│   └── page.tsx           # Main chat UI
├── components/            # React components
│   ├── thinking-indicator.tsx
│   └── progress-panel.tsx
├── lib/                   # Shared utilities
│   └── mock-data.ts
├── backend/               # Express.js backend
│   ├── src/
│   │   ├── index.ts      # Main server
│   │   ├── routes/       # API routes
│   │   ├── services/     # Skill loader, AI service
│   │   └── db/
│   ├── skills/           # .md skill configs
│   │   └── default/
│   └── tools/            # Python services
│       └── duckduckgo/
└── .env.example          # Environment template
```

---

## Future Extensions (Phase 4-9)

- **Phase 4**: Advanced web search with content extraction
- **Phase 5**: Rich diagram rendering (Mermaid, PlantUML)
- **Phase 6**: Interactive quiz taking with scoring
- **Phase 7**: Interactive roadmap progress tracking
- **Phase 8**: Production deployment (Docker, cloud hosting)
- **Phase 9**: Redis context optimization (token counting, summarization)

---

*Built with Next.js, Express.js, SQLite, Redis, and Groq/OpenRouter AI APIs.*
