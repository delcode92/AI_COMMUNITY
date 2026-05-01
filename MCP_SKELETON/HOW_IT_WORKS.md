# How MCP Works

## What is MCP?

MCP (Model Context Protocol) is like a **universal adapter** that lets AI applications connect to external tools and data sources.

## How It Works (Simple Explanation)

### Traditional AI Interaction
```
AI App → "I need weather info"
User → "Go search Google"
AI App → Search Google → Return result
```

### With MCP
```
AI App → "I need weather info"
MCP → "I know how to get weather from WeatherAPI"
MCP → Calls WeatherAPI → Returns structured data
AI App → Uses the data directly
```

### Communication Flow

```
┌─────────────┐     JSON-RPC     ┌──────────────┐     ┌──────────────┐
│   AI App    │ ◀──────────────▶ │ MCP Server   │ ◀──▶ │ Data Source  │
└─────────────┘    (stdio)      └──────────────┘     └──────────────┘
```

1. **AI App** asks MCP: "What tools do you have?"
2. **MCP Server** responds: "I have `get_weather`, `list_files`, etc."
3. **AI App** calls a tool: "Run `get_weather` for Tokyo"
4. **MCP Server** executes the action and returns structured data

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Tool** | Action the AI can trigger (like a function) |
| **Resource** | Data the AI can read (like a file) |
| **Prompt** | Template for structured input |

## MCP vs RESTful API

| Aspect | MCP | RESTful API |
|--------|-----|-------------|
| **Protocol** | JSON-RPC over stdio/HTTP | HTTP |
| **Discovery** | Built-in `list_tools()` | Manual (docs needed) |
| **Structure** | Strict schemas defined | Ad-hoc JSON |
| **Purpose** | AI-to-tool communication | System-to-system |
| **State** | Stateless per request | Stateless per request |
| **Authentication** | Via transport layer | Headers/tokens |

### Example Comparison

**RESTful API (curl):**
```bash
curl -X POST https://api.example.com/greet \
  -H "Content-Type: application/json" \
  -d '{"name": "John"}'
# Response: {"message": "Hello John!"}
```

**MCP (JSON-RPC):**
```json
// Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "greet",
    "arguments": {"name": "John"}
  }
}
// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{"type": "text", "text": "Hello, John!"}]
  }
}
```

## Why MCP Matters

1. **AI-Native**: Designed for LLM context and function calling
2. **Self-Describing**: Tools/resources declare their schemas
3. **Portable**: Same interface across different AI apps
4. **Secure**: Sandboxed execution model

## Mini Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    AI Application                        │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Tools   │  │Resources │  │ Prompts  │              │
│  │  (call)  │  │ (read)   │  │ (use)    │              │
│  └──────────┘  └──────────┘  └──────────┘              │
├─────────────────────────────────────────────────────────┤
│                 MCP SDK (JavaScript)                    │
├─────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐ │
│  │  Your Server Code (index.js)                       │ │
│  │  - Define tools                                    │ │
│  │  - Handle requests                                 │ │
│  │  - Connect to data sources                         │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```