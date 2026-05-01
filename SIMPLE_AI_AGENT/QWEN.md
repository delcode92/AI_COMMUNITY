# Browser Agent Platform

A browser-native AI agent platform built with TypeScript. Runs entirely client-side — no server dependencies — leveraging the OpenRouter API for LLM-powered conversations with automatic tool use.

## Architecture Overview

The codebase follows a clean, modular design with standardized tool protocols:

| Module | Description |
|--------|-------------|
| `types.ts` | Core type definitions — `AgentTool`, `AgentContext`, `Workflow`, `WorkflowStep`, etc. |
| `skillRouter.ts` | Tool registration, lookup, execution, and conversion to LLM tool schema |
| `orchestrator.ts` | Main agent orchestrator — handles chat loop, API calls, and workflow execution |
| `engine.ts` | Sequential workflow step runner with IndexedDB checkpointing |
| `builtins.ts` | Built-in JS tools: text utils, JSON utils, calculator, date utils, KV store |
| `httpToolAdapter.ts` | Abstract base class for creating API-backed REST/GraphQL tools |
| `index.ts` (storage) | Dual storage: localStorage (sessions, history, credentials) + IndexedDB (workflow runs) |

### Key Design Patterns

- **AgentTool Interface**: Every skill — whether a pure JS function or HTTP adapter — implements this single contract (`name`, `description`, `category`, `params`, `call()`).
- **SkillRouter**: Central hub for registering/resolving/executing tools; converts tools to OpenAI-compatible schema for API calls.
- **Orchestrator**: Agentic loop — keeps calling API while the model requests tool calls, accumulating results in the conversation.
- **HttpToolAdapter**: Extend to create API tools with built-in auth injection, retries with exponential backoff, and timeouts.

## Technology Stack

- **TypeScript** (strict mode, ES2022 target)
- **Vite** (bundler + dev server)
- **Tailwind CSS v4** (styling)
- **Browser APIs**: IndexedDB, localStorage, fetch, crypto.randomUUID()
- **External**: OpenRouter API (currently configured with `openai/gpt-oss-120b:free`)

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start Vite dev server
pnpm build            # Typecheck + production build (tsc && vite build)
pnpm typecheck        # Typecheck only (tsc --noEmit)
pnpm preview          # Preview production build
```

## Configuration

Environment variables in `.env`:
- `VITE_OPENROUTER_API_KEY` — API key for OpenRouter
- `VITE_OPENROUTER_BASE_URL` — API base URL (default: `https://openrouter.ai/api/v1`)
- `VITE_MODEL` — Model identifier (default: `anthropic/claude-sonnet-4-5`)

## Built-in Tools

| Tool | Operations |
|------|-----------|
| `text_utils` | `word_count`, `char_count`, `slugify`, `truncate`, `extract_emails`, `extract_urls`, `to_upper`, `to_lower` |
| `json_utils` | `parse`, `format`, `validate`, `get_path`, `keys` |
| `calculator` | Evaluate safe math expressions (whitelisted tokens only) |
| `date_utils` | `now`, `format`, `diff`, `add` (days/months/years) |
| `kv_store` | `get`, `set`, `delete`, `list` (localStorage-backed with `agent:kv:` namespace) |

## Project Structure

```
├── builtins.ts          # Built-in tools (text_utils, json_utils, calculator, date_utils, kv_store)
├── engine.ts            # WorkflowEngine — sequential step runner
├── httpToolAdapter.ts   # HttpToolAdapter — base class for API tools
├── index.html           # Entry HTML (minimal)
├── index.ts             # Storage layer (IndexedDB + localStorage)
├── main.ts              # Vite entry point (placeholder)
├── orchestrator.ts      # AgentOrchestrator — chat + agentic tool loop
├── orchestrator.ts_old  # Previous version of orchestrator (backup)
├── skillRouter.ts       # SkillRouter — tool registration & execution
├── types.ts             # Core types (AgentTool, workflows, etc.)
├── package.json         # Dependencies & scripts
├── tsconfig.json        # Strict TypeScript config
└── postcss.config.mjs   # Tailwind/PostCSS config
```

## Important Notes

- **No server** — the entire stack runs in the browser; only external calls go to `openrouter.ai`
- **Storage is split**: IndexedDB for workflow runs (handles larger payloads), localStorage for sessions/history/credentials
- **Workflow engine** supports conditional steps, dynamic inputs (functions of previous results), and fail-fast behavior
- **Import paths**: `index.ts` references paths like `../core/types` which suggest an older directory layout (`src/core/…`); the current flat layout at the project root may need path updates if imports break in the storage module
- `.env` contains an API key — treat it as sensitive
