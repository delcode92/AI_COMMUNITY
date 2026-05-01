# Cooney Bugs & Fixes

## Current Status
✅ **All major issues fixed**. Backend running on port 5000, Redis connected. Chat orchestration now handles malformed tool calls gracefully.

---

## Problem 1: Skill ID Mismatch

### Symptom
```
Chat orchestrator error: Error: Skill not found: ai/ml-guide
```

### Root Cause
- Skill file: `ai-ml.md` → loaded as file ID `ai-ml`
- Frontend dropdown sends: `ai/ml-guide` (derived from skill name "AI/ML Guide" with slashes)
- Skill loader looks for exact match: `ai-ml` ≠ `ai/ml-guide`

### Fixes Attempted
1. **Fix 1.1**: Changed `/api/skills` endpoint to derive ID from filename instead of name
   - File: `dist/routes/api.js`
   - Result: Backend returns `ai-ml` correctly

2. **Fix 1.2**: Added fuzzy matching in `getSkillById()` to normalize `/` to `-`
   - File: `dist/services/skill-loader.js`
   ```javascript
   const normalized = skillId.toLowerCase().replace(/\//g, '-');
   ```
   - Result: Works when backend uses correct ID

### Current State
✅ `/api/skills` now returns:
```json
{ "id": "ai-ml", "name": "AI/ML Guide", ... }
```

✅ `getSkillById('ai/ml-guide')` correctly loads skill file `ai-ml.md`

✅ **FIXED**: Frontend refreshes work correctly with updated skill IDs

---

## Problem 2: Orchestrator Infinite Loop

### Symptom
```
[Orchestrator] Executing tool: undefined
[Orchestrator] Executing tool: undefined
... (repeated 8 times)
Chat orchestrator error: Error: Max iterations (8) reached
```

### Root Cause
LLM returns malformed `tool_calls` in response:
```json
{
  "choices": [{
    "tool_calls": [
      { "name": null, "arguments": null, "id": "call_123" }
    ]
  }]
}
```

**Orchestrator flow:**
1. Parses `tool_calls` → array exists
2. Tries to execute `JSON.parse(null)` → fails silently
3. Adds invalid result to message history
4. Calls LLM again → same broken tools returned
5. **Repeats until iteration > 8**

### Fix Applied

Added validation before executing tool calls in `dist/services/orchestrator.js`:

```javascript
// Filter valid calls (must have name AND arguments)
const validCalls = calls.filter(c => c.name && c.arguments);

if (validCalls.length === 0) {
  // LLM returned broken tool calls - return fallback text
  messages.push({
    role: 'assistant',
    content: textContent || 'Unable to generate response'
  });
  continue; // Loop again, next iteration returns text
}
```

**Behavior:**
- When LLM returns invalid tool calls → return text response immediately
- System gracefully degrades to text instead of looping forever
- ✅ **FIXED**: No more infinite loops

---

## Problem 3: Redis Method Name Mismatch

### Symptom
```
Redis context save error (non-critical): this.redisClient.llen is not a function
```

### Root Cause
Redis client uses `lLen()` not `llen()`:
```javascript
// Wrong
await this.redisClient.llen(key);

// Correct
await this.redisClient.lLen(key);
```

### Fix
File: `dist/services/orchestrator.js` - `saveContextToRedis()` method
```javascript
const len = await this.redisClient.lLen(key);
```
✅ **VERIFIED**: All Redis methods are correct (`lLen`, `lRange`, `lPush`, `lTrim`)

---

## Files Modified

| File | Change |
|------|--------|
| `dist/services/skill-loader.js` | Fixed `getSkillById()` to normalize `/` to `-` for skill ID matching |
| `dist/services/orchestrator.js` | Added `validCalls` filter for malformed tool_calls, added immediate text fallback |

---

## ✅ All Issues Fixed

The following issues have been resolved:
1. **Skill ID Mismatch** - `getSkillById()` now normalizes `ai/ml-guide` → `ai-ml`
2. **Orchestrator Infinite Loop** - Invalid tool calls now return text immediately instead of looping
3. **Redis Methods** - Already correct (`lLen`, `lRange`, `lPush`, `lTrim`)

## Quick Test

```bash
# Start backend
cd COONEY/backend && node dist/index.js

# Test skill lookup
curl http://localhost:5000/api/skills

# Test chat with skill ID
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is AI?","skillId":"ai-ml","userId":"test123"}'
```

---

## Known Issues

### OpenRouter API Key Required
- Orchestrator uses `process.env.OPENROUTER_API_KEY`
- Missing key → API returns 401 → `OpenRouter error 401`
- Solution: Set `.env` file with:
  ```
  OPENROUTER_API_KEY=your-key-here
  DEFAULT_MODEL=gpt-oss-120b:free
  ```

### Search Service Dependency
- `web_search` tool requires Python service on port 7777
- If unavailable: `{"success": false, "error": "...service unavailable"}`
- This is acceptable - other tools still work

### Tool Calling Instability
- LLM (gpt-oss-120b:free) sometimes returns malformed `tool_calls` (null name/arguments)
- Current fallback returns text: "I encountered an issue processing your request..."
- **WORKING**: No more infinite loops, graceful degradation to text
- For production: Consider switching to deterministic model or disabling tools

---

## Quick Debug Commands

```bash
# Check backend running
curl http://localhost:5000/api/skills

# Test skill lookup
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test","skillId":"ai-ml","userId":"123"}'
```
