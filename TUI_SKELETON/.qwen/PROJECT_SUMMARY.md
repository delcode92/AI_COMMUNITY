The user wants me to generate a comprehensive project summary in markdown format based on the entire conversation history. I need to synthesize all the important context — the project architecture, the bugs found and fixed, the decisions made, and the current state of the project. Let me organize this carefully.

Key things to capture:
1. Project overview and goal
2. Tech stack and architecture
3. The two bugs discovered and fixed today (streaming read loop, viewport not updating after tool detection)
4. The streaming fix (readToken pattern)
5. The tool confirmation fix (missing updateView)
6. Testing status
7. Current state and next steps# Project Summary

## Overall Goal
Build a fully functional TUI-based AI chat agent using Bubble Tea (Go) that streams LLM responses from OpenRouter, supports tool execution, skill switching, conversation persistence via Redis, and a reAct-style clarification/workflow system.

## Key Knowledge

### Technology Stack
- **Language:** Go (module: `aicommunity.omniq.my.id/cliagent`)
- **TUI Framework:** Bubble Tea + Lipgloss (opencode-inspired dark theme)
- **AI Backend:** OpenRouter API (streaming chat completions)
- **Persistence:** Redis (session history, reAct state) and local filesystem (`.memory/memory.md`)
- **Tool System:** Executable binaries in `tools/` directory, whitelisted via `TOOL_WHITELIST` env var
- **Optional SDK:** `agent-sdk-go` for advanced tool-calling orchestration (`USE_SDK=true`)
- **Config:** `.env` via `godotenv`, skills as `.md` files in `skills/`

### Architecture
- **Entry:** `cmd/main.go` → creates Bubble Tea program with `ui.New()`
- **Core Model:** `internal/ui/model.go` — Bubble Tea `Model` with viewport, textarea, streaming state, reAct modes
- **API Client:** `internal/agent/client.go` — HTTP POST to OpenRouter with `bufio.Scanner` for SSE streaming
- **SDK Agent:** `internal/agent/sdk_agent.go` — wraps `agent-sdk-go` for structured tool-calling orchestration
- **Tool Registry:** `internal/ui/model_types.go` — `ToolRunner` interface, `findToolByName()` lookup, 8 built-in tools (echo, time, date, read, write, list, mkdir, shell)
- **Skill System:** `internal/skill/loader.go` — parses `skills/*.md` for `name:`, `description:`, `system_prompt: |`
- **UI Components:** Bubble Tea viewport (conversation), textarea (input), status bar (model name, streaming indicator, debug)

### Key Design Decisions
- Global system prompt loaded from `.system/system.md` and injected as first `role:"system"` message
- Skill switching via `/skill <name>` filters system prompts, keeping the global prompt
- `/compress` summarizes conversation via LLM and appends to `.memory/memory.md`
- reAct detection: looks for clarification marker phrases and numbered/ bulleted workflows in LLM output
- Tool execution requires explicit user confirmation ("Execute tool X? (y/n)") — applies to both manual `/tool` calls and workflow steps
- All conversation history persisted to Redis key `session:{id}:history`

### Build & Test Commands
- `go mod tidy` — install dependencies
- `go build ./...` — build entire project
- `go test ./internal/ui/ -v -count=1 -timeout 30s` — run UI package tests (all passing)
- `go run ./cmd/main.go` — launch the application

### Environment Variables
| Variable | Default | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | *(required)* | API key for OpenRouter |
| `MODEL_NAME` | `anthropic/claude-3.5-sonnet` | LLM model selection |
| `REDIS_URL` | `localhost:6379` | Redis connection |
| `SESSION_ID` | `default` | Redis session key namespace |
| `TOOL_WHITELIST` | `echo,time,date,shell` | Allowed tool names |
| `USE_SDK` | *(empty/false)* | Enable `agent-sdk-go` orchestration mode |

## Recent Actions

### Bug #1 — Streaming "generating…" hang (FIXED)
- **Root cause:** `readToken()` reads exactly one message from the stream channel and returns. The `streamTokenMsg` handler in `Update()` consumed that single token but never scheduled another read. After the first token, the channel sat unread forever — Bubble Tea's event loop had no pending command to trigger the next read.
- **Fix:** Made `streamTokenMsg` and `compressTokenMsg` cases return `readToken(m.streamCh)` / `readCompressToken(m.compressCh)` respectively, creating a recursive read-loop that drains the channel until `streamDoneMsg` arrives. This is the standard Bubble Tea pattern for streaming commands.
- **Files changed:** `internal/ui/model.go` (lines ~290-303)

### Bug #2 — Tool confirmation prompt invisible (FIXED)
- **Root cause:** When `onStreamDone()` detects a `/tool` JSON command in the LLM response, it calls `applyManualTool()` which sets `mode = "tool_confirm"` and appends a confirmation prompt entry — but never calls `updateView()`. The viewport kept showing the old streamed content (raw JSON), so the user never saw the "Execute tool X? (y/n)" prompt and the interaction appeared stuck.
- **Fix:** Added `m.updateView()` call after `applyManualTool()` in the tool-detection branch of `onStreamDone()`, consistent with how both the `clarify` and `workflow` branches already refresh the viewport.
- **Files changed:** `internal/ui/model.go` (line ~542)

### Test Results
- All 8 existing tests pass cleanly: `TestLoadGlobalPrompt`, `TestExecuteTool`, `TestModelNew`, `TestDebugMsg`, and 5 sub-tests under `TestExtractToolCommands` + `TestParseWorkflowFromLLM`.

## Current Plan

1. [DONE] Fix streaming read-loop — `streamTokenMsg` now reschedules `readToken`
2. [DONE] Fix invisible tool prompt — `onStreamDone` now calls `updateView()` after tool detection
3. [DONE] Build verification passes
4. [DONE] All existing tests pass
5. [TODO] Manual integration testing — run the TUI, send a message that triggers a tool call, confirm the confirmation prompt appears and tool executes
6. [TODO] Test the `USE_SDK=true` path with `wrapSDKStream` to ensure SDK-based tool orchestration also works with the streaming fix
7. [TODO] Consider adding automated integration tests that exercise the full streaming → tool confirmation → execution flow
8. [TODO] Review error handling in `client.go` — failed API calls close the channel without sending `streamDoneMsg`, which could leave the UI in a `streaming=true` state

---

## Summary Metadata
**Update time**: 2026-05-12T23:34:17.669Z 
