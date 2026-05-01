# Browser Agent Platform

A browser-native AI agent platform with a standardized tool protocol, sequential workflows, and zero server dependencies.

## Architecture

```
src/
  core/
    types.ts             ← AgentTool interface — the standardization contract
    skillRouter.ts       ← Register, resolve, and execute tools
    httpToolAdapter.ts   ← Base class for all API-backed tools
    orchestrator.ts      ← Claude API caller + agentic tool-use loop
  skills/
    builtins.ts          ← Built-in JS tools (text, JSON, math, date, kv_store)
  workflows/
    engine.ts            ← Sequential step runner with IndexedDB checkpointing
  storage/
    index.ts             ← IndexedDB (runs) + localStorage (sessions, history)
  index.ts               ← Public API + createAgent() factory
```

## The AgentTool interface

Every tool — whether a pure JS function or an HTTP adapter — implements this contract:

```typescript
interface AgentTool {
  name: string;           // Unique identifier, used by Claude to call it
  description: string;    // Claude reads this to decide when to use it
  category: string;       // Group: "utility" | "data" | "communication" | etc.
  params: Record<string, ToolParam>;
  call(input, ctx): Promise<ToolCallResult>;
  auth?: ToolAuth;        // Only needed for API tools
}
```

## Built-in tools

| Tool | Operations |
|------|-----------|
| `text_utils` | word_count, char_count, slugify, truncate, extract_emails, extract_urls |
| `json_utils` | parse, format, validate, get_path, keys |
| `calculator` | Evaluate safe math expressions |
| `date_utils` | now, format, diff, add |
| `kv_store` | get, set, delete, list (localStorage-backed) |

## Creating an API-backed tool

Extend `HttpToolAdapter` — auth, retries, and timeouts are handled for you:

```typescript
import { HttpToolAdapter } from './src';

export class MyApiTool extends HttpToolAdapter {
  name = 'my_tool';
  description = 'What this tool does — Claude reads this';
  category = 'data';
  params = {
    query: { type: 'string', description: 'Search query', required: true },
  };
  auth = { type: 'bearer', credentialKey: 'MY_API_KEY' };
  protected config = { baseUrl: 'https://api.example.com', timeout: 5000 };

  protected buildRequest(input) {
    return { url: `/search?q=${input.query}`, method: 'GET' };
  }

  protected parseResponse(status, body) {
    if (status !== 200) return { success: false, error: `HTTP ${status}` };
    return { success: true, data: body };
  }
}
```

## Quick start

```typescript
import { createAgent } from './src';
import { MyApiTool } from './my-tools';

const agent = await createAgent({
  apiKey: 'sk-ant-...',
  extraTools: [new MyApiTool()],
});

// Set credentials for API tools
agent.setCredential('MY_API_KEY', 'your-key-here');

// Chat (Claude decides which tools to call)
const reply = await agent.chat('Search for TypeScript tutorials', 'session-123');

// Or run a predefined workflow
const run = await agent.runWorkflow(myWorkflow, 'session-123');
```

## Storage model

| Store | Contents | Why |
|-------|----------|-----|
| `localStorage` | Sessions, conversation history, credentials | Fast synchronous reads |
| `IndexedDB` | Workflow run logs, step results | Async, handles larger payloads |

## No server required

The only external call is to `api.anthropic.com`. Everything else runs in the browser.
