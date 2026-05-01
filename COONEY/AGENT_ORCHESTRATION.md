# Agent Orchestration Implementation

## What Changed

Cooney now has an **agent loop** - LLM automatically calls tools and iterates until done, just like your `SIMPLE_AI_AGENT` project.

---

## Files Added

### 1. `/backend/src/services/orchestrator.ts` (NEW)
The agentic core - keeps calling tools until LLM is satisfied.

**Key features:**
- Loop pattern: `while (tool_calls) { execute; continue }`
- 4 base tools: search, diagram, quiz, roadmap
- LLM-based execution (no hardcoded logic)
- Tool results feed back to LLM for next iteration

---

## Files Modified

### 2. `/backend/src/routes/api.ts`
- Added `AgentOrchestrator` import
- Updated `/api/chat` to use orchestrator loop
- Tool traces returned in response
- Skill creation uses orchestrator too

### 3. `/backend/src/index.ts`
- Pass `db` instance to `setupApiRoutes`
- No other changes needed

### 4. `/app/page.tsx`
- Show tool call traces in chat
- Example: `Tools used: web_search: "photosynthesis"`

---

## How It Works Now

```
User: "Explain photosynthesis and create a diagram"

Agent Loop:
  1. LLM thinks → calls web_search tool
  2. Execute search → add results to context
  3. LLM sees results → calls create_diagram tool
  4. Execute diagram → add to context
  5. LLM sees both results → final text response

Response:
  [Final explanation with search + diagram integrated]
  
  ---
  Tools used:
  - web_search: "photosynthesis"
  - create_diagram: "photosynthesis process"
```

---

## Testing

1. **Start backend:**
   ```bash
   cd backend && node dist/index.js
   ```

2. **Test skill lookup:**
   ```bash
   curl http://localhost:5000/api/skills
   # Should return: { "id": "ai-ml", "name": "AI/ML Guide", ... }
   ```

3. **Test chat:**
   ```bash
   curl -X POST http://localhost:5000/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message":"What is AI?","skillId":"ai-ml","userId":"test123"}'
   ```

4. **Expected behavior:**
   - ✅ Skill ID `ai/ml-guide` normalizes to `ai-ml`
   - ✅ Malformed tool calls return text immediately (no infinite loop)
   - ✅ Redis context saves correctly
   - ✅ Multiple iterations until LLM done

---

## Adding Skills/Tools

### New Skill (0 code):
```bash
# Just add .md file
cp backend/skills/default/math.md backend/skills/custom/chemistry-tutor.md
```

Edit `name`, `description`, `system_prompt` → Done!

### New Tool (~15 lines):
```typescript
// In orchestrator.ts
this.tools.push({
  name: 'new_tool',
  description: '...',
  parameters: { ... }
});

// In executeTool switch
case 'new_tool':
  return await this.newTool(args);
```

---

## Key Differences from Before

| Old (Manual) | New (Agent) |
|--------------|-------------|
| User clicks button | LLM decides to call tools |
| One-shot response | Loop until satisfied |
| No tool traces | Shows `Tools used:` |
| User triggers tools | LLM triggers tools |

---

## Simple Example

**Old way:**
```
User: "Explain photosynthesis"
UI: [Buttons: Search, Diagram, Quiz]
User clicks "Diagram"
System: Shows diagram
```

**New way:**
```
User: "Explain and diagram photosynthesis"
LLM: "I'll search + diagram"
System: Auto-searches, auto-diagrams
Response: "Photosynthesis happens in plants... [diagram here]"
```

---

## What's Next

- Add more tools (code formatter, compare concepts, etc.)
- Skill-specific tools (only Math Tutor can use math_diagram)
- Tool configuration per skill

**No overengineering** - just simple orchestrator + switch statements!
