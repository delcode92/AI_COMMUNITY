The user wants me to generate a comprehensive project summary in markdown format based on the entire conversation history. I need to extract the most important context, decisions, and progress that would be valuable for future sessions. Let me synthesize everything from the conversation.# Project Summary

## Overall Goal
Fix and enhance a Go-based Bubble Tea TUI chat agent so it reliably streams LLM responses, correctly detects and executes tool commands (including OpenAI-style function calls), renders bold markdown in output, blocks input during generation, and executes multi-step workflows through the full workflow → tool_confirm → runNextStep → tool execution → re-stream loop.

## Key Knowledge

### Technology Stack
- **Language:** Go (module `aicommunity.omniq.my.id/cliagent`)
- **TUI Framework:** Bubble Tea (`github.com/charmbracelet/bubbletea`)
- **Styling:** Lipgloss (`github.com/charmbracelet/lipgloss`) — opencode-inspired dark theme
- **API Client:** Custom OpenRouter streaming client (`internal/agent/client.go`)
- **SDK Path:** Alternative SDK-based streaming via `internal/agent/sdk_agent.go` (activated via `USE_SDK=true`)
- **Persistence:** Redis for conversation history; file-based `.memory/memory.md` for summaries
- **Tools:** 8 whitelisted executables in `tools/`: `echo`, `time`, `date`, `read`, `write`, `list`, `mkdir`, `shell`

### Architecture
- **No explicit prompt queue.** User prompts are serialized via `m.mode` state machine (`""` → `"workflow"` → `"tool_confirm"` → `"clarify"`) and `m.streaming` boolean gate.
- `m.history []agent.Message` is the single context buffer, replayed in full on every `startStream()` call.
- `m.entries []chatEntry` is the UI display list, decoupled from history.
- **Streaming** uses a channel-based one-shot command pattern: `readToken(ch)` returns a `tea.Cmd` that reads one message, and must be re-scheduled in the `streamTokenMsg` handler to create a read-loop.

### State Machine Flow
```
User Enter (normal mode)
  → startStream() → readToken() → streamTokenMsg (re-schedule) → streamDoneMsg
    → onStreamDone(response)
      → 1. Clarification? → mode="clarify" → user input → re-stream
      → 2. Workflow? (2+ steps AND ≥1 tool) → mode="workflow" → handleWorkflowConfirm
      → 3. Standalone tool? → mode="tool_confirm" → handleToolConfirm → runNextStep
      → 4. Fallthrough: normal completion, save to Redis
```

### Build & Test
```bash
go build -o tui-agent ./cmd/main.go
go test ./...
```
All tests pass (10/10 in `internal/ui`). No test files in `cmd`, `agent`, `pkg/llm/openrouter`, or `pkg/tools`.

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | Required API key | *(none)* |
| `MODEL_NAME` | LLM model | `anthropic/claude-3.5-sonnet` |
| `REDIS_URL` | Redis connection | `localhost:6379` |
| `SESSION_ID` | Redis session ID | `default` |
| `TOOL_WHITELIST` | Comma-separated allowed tools | `echo,time,date,shell` |
| `USE_SDK` | Use SDK-based streaming | *(empty)* |

## Bugs Fixed (6 total)

| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 1 | Streaming hang | `readToken()` called once but never re-scheduled after processing each token | Return `readToken(m.streamCh)` in `streamTokenMsg` and `compressTokenMsg` handlers |
| 2 | Invisible tool prompt | `applyManualTool()` sets mode and appends entry but never calls `m.updateView()` | Added `m.updateView()` after `applyManualTool()` in standalone tool branch of `onStreamDone` |
| 3 | Over-eager workflow detection | `parseWorkflow()` matched any numbered/bullet list | Now requires 2+ steps AND at least one step with `ToolCmd != ""` |
| 4 | Tool confirmation rejects empty Enter | `handleToolConfirm()` only matched literal `"y"/"yes"` | Added `input == ""` as auto-confirm, matching `handleWorkflowConfirm` behavior |
| 5 | Tool confirmation value receiver | `handleToolConfirm` had `(m Model)` instead of `(m *Model)` | Changed to pointer receiver so mutations persist |
| 6 | Workflow mode never set | `onStreamDone()` workflow branch never set `m.mode = "workflow"` | Added `m.mode = "workflow"` so `KeyEnter` routes to `handleWorkflowConfirm` |

## Recent Changes

### Blocking Enter During Streaming
Changed `break` to `return m, nil` in the `KeyEnter` handler when `m.streaming == true`, fully consuming the event so no input reaches the textarea or falls through to UI updates.

### Bold Markdown Rendering
- Added `MessageBoldStyle` in `internal/ui/styles.go` (same text color, `Bold(true)`)
- Added `renderBoldMarkdown()` function in `model.go` that iterates through text, finds `**...**` pairs, and renders bold sections with `MessageBoldStyle`
- Updated `renderMessages()` to use `renderBoldMarkdown()` for assistant content instead of plain `MessageStyle`

### OpenAI-Style Tool Call Extraction
- **Problem:** Agent responses contain `<shell>{"command":"ls","args":["-la"]}</shell>` format, which no existing regex matched
- **Fix in `model_tools.go`:** Added Pattern 4 regex `<(\w+)>\s*(\{[^}]+\})\s*</\w+>` that extracts the XML tag as tool name and parses inner JSON's `command` + `args` fields
- `parseAndAddTool()` updated to accept `command` as alias for `tool` in JSON
- **Cleanup:** Removed duplicate `extractToolCommands` and `parseToolJSON` functions from `model.go`; authoritative implementations now only in `model_tools.go`
- Removed unused `regexp` import from `model.go`

### Debug Handler Removed
Removed `case tea.KeyRunes:` handler (pressing `d` to add `"debug keypress"` to status bar) — pure development aid with no functional purpose.

## Current Plan
1. [x] Fix streaming hang — re-schedule readToken after each token
2. [x] Fix invisible tool prompt — add updateView() after applyManualTool
3. [x] Fix over-eager workflow detection — require 2+ steps AND ≥1 tool
4. [x] Fix tool confirmation — accept empty Enter, pointer receiver
5. [x] Fix missing workflow mode — set m.mode = "workflow"
6. [x] Block Enter during streaming — return m, nil instead of break
7. [x] Bold markdown rendering — MessageBoldStyle + renderBoldMarkdown()
8. [x] OpenAI-style tool call extraction — XML-wrapped pattern + command alias
9. [x] Build verification — clean compile
10. [x] Test verification — all 10 tests pass
11. [TODO] User to rebuild binary (`go build -o tui-agent ./cmd/main.go`) and test end-to-end

---

## Summary Metadata
**Update time**: 2026-05-13T10:27:03.410Z 
