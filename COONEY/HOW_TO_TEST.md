# How to Test Cooney

This guide walks you through testing all features of Cooney with the new **agent orchestration** system.

---

## Prerequisites

- Node.js 20+ installed
- Python 3.10+ installed
- Redis running (system service or Docker)
- OpenRouter API key: https://openrouter.ai/keys

---

## Step 1: Setup Environment

```bash
cd /Users/Admin/Documents/project/AI_COMMUNITY/COONEY

# Copy environment file
cp .env.example .env

# Edit .env and add your OpenRouter API key
nano .env
```

**Required environment variables:**
```
PORT=5000
REDIS_URL=redis://localhost:6379
SQLITE_PATH=./data/cooney.db
OPENROUTER_API_KEY=your_key_here
DEFAULT_MODEL=mistralai/mistral-7b-instruct:free
```

---

## Step 2: Install Dependencies

```bash
# Backend
cd COONEY/backend
pnpm install
pip3 install -r tools/requirements.txt

# Frontend
cd ../../COONEY
pnpm install
```

---

## Step 3: Start Services

Run **all three** services in separate terminals:

### Terminal 1: Python Search Service (port 7777)
```bash
cd COONEY/backend/tools
python3 main.py
# Output: 🔍 DuckDuckGo Search server running on port 7777
```

### Terminal 2: Backend API (port 5000)
```bash
cd COONES/backend
pnpm run dev
# Output:
# 🚀 Cooney Backend on port 5000
# 📚 SQLite: ./data/cooney.db
# 🗨️  Redis: redis://localhost:6379
```

### Terminal 3: Frontend (port 3000)
```bash
cd COONEY
pnpm run dev
# Output: ready in X ms
```

Open: http://localhost:3000

---

## Step 4: Test Features

### Test 1: Agent Mode Chat (NEW!)
**LLM auto-decides when to use tools**

1. Select "Science Guide" skill
2. Type: **"Explain photosynthesis and create a diagram"**
3. Press Enter
4. ✅ Expected:
   - Cooney searches for photosynthesis info
   - Cooney generates a diagram
   - Final response combines both tools
   - **Shows trace:** `Tools used: web_search, create_diagram`

---

### Test 2: Multi-Step Tool Workflow
**Agent loop continues until LLM is satisfied**

1. Type: **"Create a quiz on quantum mechanics with 5 questions"**
2. ✅ Expected:
   - LLM calls `generate_quiz` tool
   - Quiz generated and formatted as JSON
   - Trace shows: `Tools used: generate_quiz`
   - Shows 5 multiple choice questions

---

### Test 3: Context Memory (Redis)
**Chat history persists with 20-message window**

1. With "Math Tutor" selected, type: **"What is the Pythagorean theorem?"**
2. Reply received
3. Type: **"Can you give me a practical example?"**
4. ✅ Expected: Cooney remembers context and gives relevant example
5. Verify in Redis:
   ```bash
   redis-cli
   LRANGE chat:user-<your-user-id> 0 -1
   # Should see conversation history
   ```

---

### Test 4: Agent Iterations
**Loop runs 1-8 times until LLM satisfied**

1. Send complex prompt: **"Compare mitosis and meiosis, create a diagram, and make a quiz"**
2. ✅ Expected:
   - LLM calls `compare_concepts` or similar tools
   - Then generates diagram
   - Then creates quiz
   - **Shows 3+ tool calls in trace**
   - Response includes all three elements

---

### Test 5: Web Search Integration
**Real DuckDuckGo search via agent tool**

1. Type: **"What are the latest developments in renewable energy?"**
2. ✅ Expected:
   - Agent calls `web_search` tool
   - Results from DuckDuckGo
   - LLM summarizes results
   - Trace shows: `Tools used: web_search`

---

### Test 6: Manual Tool Buttons (Still Work)

**Old method still works for quick access**

1. Click **"🔍 Search"** button
2. Type: **"black hole formation"**
3. ✅ Expected: Direct search without agent loop
4. Click **"🎨 Diagram"** button
5. Type: **"solar system"**
6. ✅ Expected: Direct diagram generation

---

### Test 7: Skill Switching
**Different skills = different AI behavior**

1. Start with "Science Guide", type: **"Explain gravity"**
2. Switch to "Math Tutor", type: **"Explain calculus"**
3. ✅ Expected: Responses tailored to each skill's system_prompt

---

### Test 8: Custom Skill Creation
**Create new skills with AI**

1. Click "Create Skill"
2. Describe: **"A Python programming tutor for beginners"**
3. Review generated YAML
4. Click "Save Skill"
5. New skill appears in dropdown
6. ✅ Expected: `/backend/skills/custom/python-tutor.md` created

---

### Test 9: Progress Tracking
**SQLite saves quiz/roadmap history**

1. Generate quiz: `"Quiz on solar system"`
2. Generate roadmap: `"Roadmap to learn AI"`
3. Navigate to `/progress`
4. ✅ Expected:
   - **Quiz History tab:** Shows generated quiz
   - **My Roadmaps tab:** Shows created roadmap
   - Stats updated with XP

---

### Test 10: Agent Mode Fallback
**Works even if Redis/Python service unavailable**

1. Stop Python search service (Terminal 1)
2. Send: **"Explain photosynthesis"**
3. ✅ Expected:
   - Agent still works (search tool returns error)
   - LLM processes without search
   - Final response generated
   - Trace shows: `web_search: {"success": false}`

---

## Quick Test Commands

### Check Backend Health
```bash
curl http://localhost:5000/api/health
# Response: {"status":"ok","redis":true,"db":"connected"}
```

### Check Available Models
```bash
curl http://localhost:5000/api/models
# Response: {"openrouter": [...]}
```

### Test Agent Chat (NEW!)
```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How does photosynthesis work?",
    "skillId": "science",
    "userId": "test123"
  }'
```

**Expected Response:**
```json
{
  "reply": "Photosynthesis is the process...",
  "toolCalls": [
    {"toolName": "web_search", "input": {"query": "photosynthesis"}, "durationMs": 450},
    {"toolName": "create_diagram", "input": {"topic": "photosynthesis"}, "durationMs": 2100}
  ],
  "iterations": 3
}
```

### Check Redis Context
```bash
redis-cli
LLEN chat:test123
# Should show message count (max 20)
LRANGE chat:test123 0 -1
# View conversation history
```

### Check SQLite Data
```bash
cd COONEY/backend
sqlite3 data/cooney.db

SELECT * FROM quizzes;
SELECT * FROM roadmaps;
SELECT * FROM progress;
```

---

## Agent-Specific Tests (NEW!)

### Test Agent Loop Until Satisfaction
**LLM runs 1-8 iterations automatically**

1. Send: **"Explain the water cycle with diagram and quiz"**
2. ✅ Expected behavior:
   - Iteration 1: LLM calls `web_search`
   - Iteration 2: LLM processes results, calls `create_diagram`
   - Iteration 3: LLM calls `generate_quiz`
   - Iteration 4: LLM satisfied → final response
   - **Trace shows: 3 tool calls**

### Test Tool Execution Trace
**See exactly which tools were used**

1. Send complex request with multiple tools
2. ✅ Messages should show:
   ```
   User: Explain photosynthesis and create quiz
   Cooney: Photosynthesis converts sunlight to chemical energy...
   
   ---
   Tools used:
   - web_search: {"query": "photosynthesis"}
   - generate_quiz: {"topic": "photosynthesis", "count": 5}
   ```

---

## Troubleshooting

### Redis Not Available
```bash
# Check Redis
redis-cli ping
# Expected: PONG

# Start Redis (macOS)
brew services start redis

# Start Redis (Linux)
sudo service redis start
```

### Agent Loop Getting Stuck
```bash
# If tool calls loop indefinitely:
# - Check OpenRouter API key is valid
# - Verify model supports tool calling (mistral-7b-instruct:free works)
# - Check backend logs for error messages
```

### Tool Execution Fails
```bash
# Search tool down? Test manually:
curl -X POST http://localhost:7777/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "max_results": 1}'

# Python dependencies?
cd backend/tools && pip3 install -r requirements.txt && python3 main.py
```

---

## Testing Workflow Summary

```
Step 1: Setup .env with OPENROUTER_API_KEY
    ↓
Step 2: Install dependencies (frontend + backend + python)
    ↓
Step 3: Start 3 services (search, backend, frontend)
    ↓
Step 4: Test agent mode - send complex prompts
    ↓
Step 5: Verify tool traces in UI
    ↓
Step 6: Check Redis context persistence
    ↓
Step 7: Verify SQLite data (quizzes, roadmaps)
```

---

## Feature Test Checklist

- [x] Dashboard loads with skill dropdown
- [x] Chat works in agent mode (LLM auto-calls tools)
- [x] Tool traces show in messages
- [x] Agent iterates until satisfied (1-8 iterations)
- [x] Context memory persists (Redis 20-message window)
- [x] Web search tool works via DuckDuckGo
- [x] Diagram generation tool works
- [x] Quiz generation tool works (JSON format)
- [x] Roadmap generation tool works
- [x] Manual tool buttons still work
- [x] Custom skill creation works
- [x] Progress page saves to SQLite
- [ ] Model switching works (change DEFAULT_MODEL)
- [ ] All default skills work (science, math, physics, ai-ml, programming)

---

## Next Steps After Testing

1. Add your own OpenRouter API key
2. Test agent mode with complex multi-step prompts
3. Verify context memory persists across messages
4. Create custom skills for your use cases
5. Add more tools to orchestrator.ts (e.g., compare_concepts)
6. Test with different models in `DEFAULT_MODEL`
7. Monitor Redis for context window limiting

---

**Happy testing! 🚀**

*Now with full agent orchestration - LLM auto-triggers tools until satisfied!*
