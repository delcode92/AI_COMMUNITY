# QWEN.md – Project Overview

## Project Summary

**tui-agent** is a minimal command-line chat interface built with the **Bubble Tea** TUI framework (Go) and **Lipgloss** for styling. It connects to an OpenRouter backend to stream LLM responses. The UI consists of a scrollable viewport for conversation history, a textarea for input, and a status bar showing model information and activity.

### Key Features
- **Global System Prompt** – Load a session-wide prompt from `.system/system.md`
- **Dynamic Skill Switching** – Use `/skill <name>` to change AI personas at runtime
- **Tool Execution** – Run whitelisted local tools via `/tool <json>` command
- **Redis-Persisted History** – Save and restore conversations across sessions
- **Conversation Compression** – Summarize chats to `.memory/memory.md` using `/compress`
- **Streaming Responses** – Real-time token streaming from OpenRouter API
- **Tab Completion** – Type `/` to see available commands with tab navigation

## Primary Technologies
- **Go** (module `aicommunity.omniq.my.id/cliagent`)
- **Bubble Tea** – for the TUI event loop and UI components
- **Lipgloss** – for theming and style definitions (opencode-inspired dark theme)
- **OpenRouter API** – streaming LLM responses via custom client
- **Redis** – for stateful conversation persistence
- **GoDotenv** – environment variable management

## Directory Layout
```
TUI_SKELETON/
├─ cmd/                   # Application entry point (main.go)
├─ internal/
│  ├─ agent/             # OpenRouter streaming client (client.go)
│  ├─ skill/             # Skill loader (loader.go)
│  └─ ui/                # Bubble Tea model (model.go), styles (styles.go)
├─ skills/                # Skill definition files (.md format)
│  └─ sample_skill.md
├─ tools/                 # Executable tools for /tool command
│  ├─ echo
│  ├─ time
│  └─ date
├─ .system/               # Global system prompt
│  └─ system.md
├─ .memory/               # Compressed conversation summaries
│  └─ memory.md
├─ .env                   # Environment configuration
├─ go.mod / go.sum        # Go module definition & dependencies
├─ README.md              # Project README (setup & keybindings)
└─ QWEN.md                # This file – project context for Qwen Code
```

## Building & Running

1. **Install dependencies**
   ```bash
   go mod tidy
   ```

2. **Set your OpenRouter API key** (environment variable)
   ```bash
   export OPENROUTER_API_KEY=sk-or-...
   # or use .env file
   ```

3. **Optional: Configure Redis**
   ```bash
   export REDIS_URL=localhost:6379
   ```

4. **Run the application**
   ```bash
   go run ./cmd/main.go
   ```
   
   The program launches a TUI where you can:
   - Type messages and press **Enter** to send
   - Press **Alt+Enter** for a newline
   - Type `/` for command completion
   - Press **Ctrl+C** to quit

## Keybindings

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Alt+Enter` | Insert newline |
| `Ctrl+C` | Quit application |
| `Tab` | Auto-complete command after typing `/` |
| `↑/↓` | Navigate command completions |

## Commands

### Global System Prompt
Place your global system prompt in **`.system/system.md`**. This prompt is loaded at startup and prepended to all conversations as a `system` role message.

### Switching Skills
Use **`/skill <name>`** to switch between different AI personas:
```
/skill SampleAssistant
```
Skills are `.md` files in the `skills/` directory with `name`, `description`, and `system_prompt` fields.

### Tool Execution
Execute whitelisted tools with **`/tool <json>`**:
```json
/tool {"tool":"echo","args":["hello","world"]}
```
- Tools must be executable binaries in `tools/`
- Configure whitelist via `TOOL_WHITELIST` env var (comma-separated, default: `echo,time,date`)
- **Security**: Non-whitelisted tools are rejected

### Compress Conversation
Use **`/compress`** to summarize your conversation to `.memory/memory.md`:
```
/compress
```
- Sends conversation history to LLLM for summarization
- Preserves key points in bullet-point format
- Full history remains in Redis; summary is appended to `.memory/memory.md` with timestamp

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | Required. Your OpenRouter API key | *(none)* |
| `MODEL_NAME` | LLM model to use | `anthropic/claude-3.5-sonnet` |
| `REDIS_URL` | Redis connection string | `localhost:6379` |
| `SESSION_ID` | Redis session identifier | `default` |
| `TOOL_WHITELIST` | Comma-separated allowed tools | `echo,time,date` |

Any model from https://openrouter.ai/models works.

## Architecture

### Message Flow
```
1. User types message → textarea.Update()
2. If streaming message → parse command (/skill, /tool, /compress)
3. If normal message → append to history, call client.Send()
4. Stream tokens via readToken() → update viewport in real-time
5. On completion → save history to Redis
```

### Skill System
- `internal/skill/loader.go` scans `skills/` directory for `.md` files
- Parses YAML-like format: `name:`, `description:`, `system_prompt: |`
- First skill is loaded by default; users can switch with `/skill`
- Each skill message is added as a `system` role entry in history

### Tool Execution Pattern
```go
func ExecuteTool(name string, args []string) (string, error) {
    // Check whitelist
    // Run ./tools/<name> args via exec.Command
    // Return stdout + stderr
}
```

### Redis Integration
- Session keys: `session:{sessionId}:history`
- History is JSON-encoded: `[{role: "system/user/assistant", content: "..."}]`
- Auto-saved after each message; loads on startup if exists
- No automatic trimming – full history preserved

## Extending the Project

### Adding Skills (0 code changes)
1. Create `.md` file in `skills/` directory
2. Add `name`, `description`, and `system_prompt` fields
3. Use `/skill <name>` to activate

### Adding Tools (minimal code)
1. Create executable binary in `tools/`
2. Add name to `TOOL_WHITELIST` env var
3. Use via `/tool {"tool":"name","args":[...]}`

### Auto Tool-Calling (future work)
Currently tools are manually triggered. To enable LLM-driven auto tool-calling:
- Extend `agent.Client` to parse function-calling responses
- Detect tool call schema in LLM output
- Execute via `ExecuteTool()`
- Feed results back to context

### Markdown Rendering
Integrate `glamour` or `goldmark` in `renderMessages()` for formatted assistant responses.

## Testing
The repository currently contains no test files. For future work:
- Add Go tests under `*_test.go` pattern using the `testing` package
- Test `agent.Client` with mocked HTTP server
- Test UI rendering with Bubble Tea testing utilities
- Unit test `ExecuteTool()` and skill loader

## Development Notes
- **Code Style**: Standard Go formatting (`gofmt`), exported identifiers capitalized, unexported use lower-case camelCase
- **Theming**: opencode-inspired dark theme in `internal/ui/styles.go`
- **Error Handling**: Errors displayed in status bar, no panics for recoverable errors
- **Graceful Shutdown**: Signal handling exits cleanly, saves history to Redis

## Common Issues
- **`OPENROUTER_API_KEY is not set`**: Set the env variable or add to `.env`
- **Redis connection failed**: Ensure Redis is running or unset `REDIS_URL`
- **Tool not found**: Verify binary exists in `tools/` and is in whitelist
- **Skill not found**: Check skill name in `/skill <name>` matches `.md` file name