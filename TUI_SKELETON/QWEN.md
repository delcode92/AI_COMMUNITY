# QWEN.md – Project Overview

## Project Summary

**tui‑agent** is a minimal command‑line chat interface built with the **Bubble Tea** TUI framework (Go) and **Lipgloss** for styling. It connects to an OpenRouter backend to stream LLM responses. The UI consists of a scrollable viewport for the conversation, a textarea for input, and a status bar showing model information and activity.

## Primary Technologies
- **Go** (module `github.com/aicommunity.omniq.my.id/cliagent`)
- **Bubble Tea** – for the TUI event loop and UI components
- **Lipgloss** – for theming and style definitions
- **OpenRouter API** – streaming LLM responses via a custom client (`internal/agent/client.go`)

## Directory Layout
```
TUI_SKELETON/
├─ cmd/                 # Application entry point (main.go)
├─ internal/
│  ├─ agent/           # OpenRouter streaming client
│  └─ ui/              # Bubble Tea model, view, and styles
├─ go.mod / go.sum      # Go module definition & dependencies
├─ README.md            # Project README (setup & keybindings)
└─ QWEN.md              # ← This file – project context for Qwen Code
```

## Building & Running
1. **Install dependencies**
   ```bash
   go mod tidy
   ```
2. **Set your OpenRouter API key** (environment variable)
   ```bash
   export OPENROUTER_API_KEY=sk-or-...
   ```
3. **Run the application**
   ```bash
   go run ./cmd/main.go
   ```
   The program launches a TUI where you can type messages, press **Enter** to send, **Alt+Enter** for a newline, and **Ctrl+C** to quit.

## Development Conventions
- **Code Style**: Follows standard Go formatting (`gofmt`). Types and functions are capitalised for export when needed; unexported identifiers use lower‑case camelCase.
- **UI Structure**: All UI logic lives in `internal/ui`. The `Model` struct holds the viewport, textarea, client, conversation history, and streaming state.
- **Streaming**: The `client.Send` method returns a channel of `agent.StreamChunk`. Tokens are processed in `readToken` and appended to the streaming buffer.
- **Error Handling**: Errors from the stream are captured in `streamErrMsg` and displayed in the status bar.
- **Configuration**: The default LLM model is defined in `Model.modelName`. Edit this field in `internal/ui/model.go` to switch models.

## Extending the Project
- **Add system‑prompt / persona support** – modify the initial `history` slice before sending.
- **Persist conversations** – serialize `Model.history` to a file on exit and reload on start.
- **Multi‑session / tabs** – manage multiple `Model` instances or introduce a session selector.
- **Tool/function calling** – extend `agent.Client` to support OpenRouter tool calls.
- **Markdown rendering** – integrate a renderer (e.g., `goldmark` or `glamour`) in `renderMessages`.

## Testing
The repository currently contains no test files. For future work, consider adding Go tests under a `*_test.go` pattern, using the `testing` package. Test the `agent.Client` behavior with a mocked HTTP server and UI rendering with Bubble Tea's testing utilities.

---
*Generated automatically for Qwen Code to provide consistent project context.*