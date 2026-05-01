# How It Works — Browser Agent Platform

## In One Sentence

You talk to an AI agent running entirely in your browser — no server, no backend — and when the AI needs to perform a task (like counting words, doing math, or saving data), it calls tools right there on your machine.

---

## The Big Picture

```
┌─────────────────────────────────────────────────┐
│                  Your Browser                    │
│                                                  │
│  ┌───────┐    ┌──────────────────┐    ┌───────┐ │
│  │ You   │ ◄► │ AgentOrchestrator│ ◄► │ LLM   │ │
│  │(chat) │    │                  │    │(API)  │ │
│  └───────┘    │   ┌────────────┐ │    └───────┘ │
│               │   │SkillRouter │ │               │
│               │   │  (tools)   │ │               │
│               │   └────────────┘ │               │
│               └──────────────────┘               │
└─────────────────────────────────────────────────┘
```

Instead of installing software on your computer or connecting to our own server, the agent lives in one thing: **a single browser tab**. When you chat with it, the only external call it makes is to OpenRouter (which provides the AI model). Everything else — tool execution, data storage, workflow logic — happens locally.

---

## The Core Concept: Agentic Loop

The most important concept in this project is the **agentic loop**. This is how the agent "thinks and acts" in cycles before giving you a final answer.

### How a Single Conversation Turn Works

```
You: "What's 237 * 819? Save it as result then retrieve it."

Cycle 1:
  Agent → LLM: "Here's the user question + available tools (calculator, kv_store, ...)"
  LLM  → Agent: "I want to call the calculator tool"

Cycle 2:
  Agent → calculator: "237 * 819" → returns: 194103
  Agent → LLM: "Here's what the calculator replied"
  LLM  → Agent: "Now call kv_store to save it"

Cycle 3:
  Agent → kv_store: {"action":"set","key":"result","value":194103}
  Agent → LLM: "Stored successfully"
  LLM  → Agent: "Now call kv_store to get it back"

Cycle 4:
  Agent → kv_store: {"action":"get","key":"result"}
  Agent → LLM: "Got: 194103"
  LLM  → Agent: "I'm done — here's the final text answer"

You see: "The result of 237 * 819 is 194103, saved and retrieved from storage."
```

Each cycle: **Think → Decide → Act → Report → Think Again → ...**

### The Loop in Code (`orchestrator.ts`)

The `chat()` method in `AgentOrchestrator` is where this happens:

```
1. Send your message + conversation history to the LLM API
2. Get response back — check: did the LLM want to use tools?
3. If YES:
   a. Execute each requested tool one by one
   b. Send the tool results back to the LLM
   c. Go back to step 2 (loop)
4. If NO (finish_reason !== 'tool_calls'):
   The LLM is done calling tools — return its final text answer
```

This is what `while (response.choices[0].finish_reason === 'tool_calls')` does in the code. The loop continues until the model says "I don't need any more tools."

### Events Emitted During the Loop

The UI subscribes to an `onProgress` callback that fires events as the loop progresses:

| Event | When | What the UI shows |
|-------|------|-------------------|
| `thinking` | First API call | 🧠 "Determining which tools to use…" |
| `tool_call` | LLM chose a tool | 🔧 "Calling tool: `tool_name`" + input |
| `tool_result` | Tool finished | ✅ "Result from `tool_name`" + output + duration |
| `thinking_again` | Back to the API | 🧠 "Processing tool results…" |
| `done` | Final answer ready | ✨ "Finalizing response" |

This is what you see in the **process trace panel** — a live feed of the agent's brain at work.

---

## Key Components

### 1. `AgentOrchestrator` — The Conductor

**File:** `src/orchestrator.ts`

The orchestrator ties everything together:
- Takes the user's chat message
- Asks the LLM what to do
- Routes tool calls through the SkillRouter
- Loops until the LLM is satisfied
- Saves the conversation

Think of it as a **stage manager** — the LLM is the actor, the tools are the props, and the orchestrator makes sure everything happens in order.

### 2. `SkillRouter` — The Tool Dispatcher

**File:** `src/core/skillRouter.ts`

The SkillRouter has two jobs:
- **Register tools** — every tool (calculator, text utils, etc.) gets added with its name, description, and parameter schema
- **Convert to LLM format** — sends a version of each tool to the LLM so it knows what's available and how to call them
- **Execute tools** — when the LLM says "call calculator", the SkillRouter finds it and runs it

### 3. `AgentTool` Interface — The Standard Protocol

**File:** `src/core/types.ts`

Every single tool — whether a simple JS function or an API call — follows the same contract:

```typescript
interface AgentTool {
  name: string;           // How the LLM identifies the tool
  description: string;    // What the tool does (LLM reads this)
  params: Record<string, ToolParam>;  // What parameters it expects
  call(input, ctx): Promise<ToolCallResult>;  // The actual execution
}
```

This means **any** tool can be registered, and the system handles it the same way. No special cases. No exceptions.

### 4. `BrowserStorage` — Local-Only Persistence

**File:** `src/storage/index.ts`

Two storage layers:
- **localStorage** — fast, synchronous; stores sessions, messages, credentials
- **IndexedDB** — async, handles larger payloads; stores workflow run logs

### 5. `WorkflowEngine` — Predefined Sequences

**File:** `src/workflows/engine.ts`

Sometimes you don't want the LLM to figure out the order of operations — you want to define it yourself. The WorkflowEngine runs a list of steps in sequence:

```
Step 1: call calculator → Step 2: save result → Step 3: format as JSON
```

Each step can depend on the previous one's output, and steps can be conditional.

---

## Built-in Tools

These tools ship with the platform — no API keys or setup needed:

| Tool | Does |
|------|------|
| `text_utils` | Word count, character count, extract emails/URLs, slugify, truncate |
| `json_utils` | Parse, format, validate, extract paths from JSON |
| `calculator` | Safe math expressions (supports pow, min, max, random, floor, ceil, round, abs, sqrt) |
| `date_utils` | Current time, format, diff between dates, add/remove days/months/years |
| `kv_store` | Browser key-value storage (save, retrieve, delete, list) |

---

## Adding New Tools

Two ways to add a tool:

### Simple JS Tool

```typescript
const myTool: AgentTool = {
  name: 'greeting',
  description: 'Says hello to the user',
  category: 'communication',
  params: { name: { type: 'string', description: 'User name', required: true } },
  async call(input, ctx) {
    return { success: true, data: `Hello, ${input.name}!` };
  },
};
```

### API-Backed Tool

Extend `HttpToolAdapter` — it handles authentication, retries, and timeouts for you:

```typescript
class WeatherTool extends HttpToolAdapter {
  name = 'weather';
  description = 'Get current weather for a city';
  category = 'data';
  params = { city: { type: 'string', required: true } };
  auth = { type: 'bearer', credentialKey: 'WEATHER_API_KEY' };
  protected config = { baseUrl: 'https://api.weather.com', timeout: 5000 };

  protected buildRequest(input) {
    return { url: `/current?city=${input.city}`, method: 'GET' };
  }

  protected parseResponse(status, body) {
    if (status !== 200) return { success: false, error: `HTTP ${status}` };
    return { success: true, data: body };
  }
}
```

---

## Project File Structure

```
src/
  core/
    types.ts             ← The AgentTool contract + interfaces
    skillRouter.ts       ← Tool registry & execution
    httpToolAdapter.ts   ← Base class for API tools
    builtins.ts          ← Built-in tools registered here
  workflows/
    engine.ts            ← Step-by-step workflow runner
  storage/
    index.ts             ← localStorage + IndexedDB
  orchestrator.ts        ← The agentic loop (main logic)
  main.ts                ← Browser entry point, UI wiring
index.html               ← The application interface
```

---

## Quick Start

```bash
pnpm install        # Install dependencies
pnpm dev            # Start dev server on http://localhost:5173
pnpm build          # Production build
```

Set your API key in the UI ("Set Key" button) or in the `.env` file as `VITE_OPENROUTER_API_KEY`.
