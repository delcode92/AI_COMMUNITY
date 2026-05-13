# tui-agent

## Project Summary

**tui-agent** is a minimal command-line chat interface built with the **Bubble Tea** TUI framework (Go) and **Lipgloss** for styling. It connects to an OpenRouter backend to stream LLM responses. The UI consists of a scrollable viewport for conversation history, a textarea for input, and a status bar showing model information and activity.

### Key Features
- **Global System Prompt** – Load a session-wide prompt from `.system/system.md`
- **Dynamic Skill Switching** – Use `/skill <name>` to change AI personas at runtime
- **Tool Execution** – Run whitelisted local tools via `/tool <json>` command
- **Redis-Persisted History** – Save and restore conversations across sessions
- **reAct Pattern** – Clarification detection and workflow execution support
- **Streaming Responses** – Real-time token streaming from OpenRouter API
- **Tab Completion** – Type `/` to see available commands with tab navigation
- **In-App Debugging** – Debug messages displayed in status bar via `d` keypress

## Primary Technologies
- **Go** (module `aicommunity.omniq.my.id/cliagent`)
- **Bubble Tea** – for the TUI event loop and UI components
- **Lipgloss** – for theming and style definitions (opencode-inspired dark theme)
- **OpenRouter API** – streaming LLM responses via custom client
- **Redis** – for stateful conversation persistence
- **GoDotenv** – environment variable management

## Directory Layout
```
tui-agent/
├─ cmd/
│  └─ main.go              # Application entry point
├─ internal/
│  ├─ agent/
│  │  └─ client.go         # OpenRouter streaming client
│  ├─ skill/
│  │  └─ loader.go         # Skill configuration loader
│  └─ ui/
│     ├─ model.go           # Bubble Tea model, Update/View logic
│     └─ styles.go          # Lipgloss styles (opencode color scheme)
├─ skills/                  # Skill definition files (.md format)
├─ tools/                   # Executable tools for /tool command
├─ .system/
│  └─ system.md             # Global system prompt
├─ .memory/
│  ├─ memory.md             # Compressed conversation summaries
│  └─ react_logs/           # reAct state logs
├─ go.mod / go.sum          # Go module definition
└─ README.md                # Project documentation
```

## Building & Running

1. **Install dependencies**
   ```bash
   go mod tidy
   ```

2. **Set your OpenRouter API key** (environment variable)
   ```bash
   export OPENROUTER_API_KEY=sk-or-...
   # or use .env file (already configured with a test key)
   ```

3. **Optional: Configure Redis**
   ```bash
   export REDIS_URL=localhost:6379
   export SESSION_ID=my-session
   ```

4. **Run the application**
   ```bash
   go run ./cmd/main.go
   ```

## Keybindings

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Alt+Enter` | Insert newline |
| `Ctrl+C` | Quit application |
| `Tab` | Auto-complete command after typing `/` |
| `↑/↓` | Navigate command completions |
| `d` | Add debug message (testing) |

## Commands

### Global System Prompt
Place your global system prompt in `.system/system.md`. This prompt is loaded at startup and prepended to all conversations as a `system` role message.

### Switching Skills
Use `/skill <name>` to switch between different AI personas:
```
/skill SampleAssistant
/skill SystemExecutor
/skill NodeJSProgrammer
```
Skills are `.md` files in `skills/` directory with `name:`, `description:`, and `system_prompt: |` fields.

### Tool Execution
Execute whitelisted tools with `/tool <json>`:
```json
/tool {"tool":"echo","args":["hello","world"]}
/tool {"tool":"shell","args":["ls","-la"]}
```
- Tools must be executable binaries in `tools/`
- Configure whitelist via `TOOL_WHITELIST` env var (comma-separated, default: `echo,time,date,shell`)
- **Security**: Non-whitelisted tools are rejected

### Compress Conversation
Use `/compress` to summarize your conversation to `.memory/memory.md`:
```
/compress
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | Required. Your OpenRouter API key | *(none)* |
| `MODEL_NAME` | LLM model to use | `poolside/laguna-xs.2:free` |
| `REDIS_URL` | Redis connection string | `localhost:6379` |
| `SESSION_ID` | Redis session identifier | `default` |
| `TOOL_WHITELIST` | Comma-separated allowed tools | `echo,time,date,shell` |

## Architecture

### Message Flow
```
1. User types message → textarea.Update()
2. If command → parse (/skill, /tool, /compress)
3. If normal message → append to history, call client.Send()
4. Stream tokens via readToken() → update viewport in real-time
5. On completion → save history to Redis
```

### Data Structures
- **`history`** - `[]agent.Message` - Messages sent to/from OpenRouter API (includes system prompts)
- **`entries`** - `[]chatEntry` - UI display entries rendered in viewport
- **`streamBuf`** - `*strings.Builder` - Accumulates streaming tokens
- **`debugLines`** - `[]string` - In-app debug messages shown in status bar

### Components
- **Model** (`internal/ui/model.go`) - Main Bubble Tea model with viewport, textarea, and state
- **Client** (`internal/agent/client.go`) - OpenRouter API streaming client
- **Skill Loader** (`internal/skill/loader.go`) - Parses `.md` skill files

## Development

```bash
# Run tests
go test ./...

# Build
go build -o tui-agent ./cmd/main.go
```

## Code Style
- Standard Go formatting (`gofmt`)
- Exported identifiers capitalized, unexported use lower-case camelCase
- opencode-inspired dark theme in `internal/ui/styles.go`
- Errors displayed in status bar, no panics for recoverable errors