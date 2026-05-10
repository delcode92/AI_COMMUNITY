# tui-agent

A CLI agent with a Bubbletea TUI and OpenRouter backend. Features include global system prompts, dynamic skill switching, tool calling, Redis-backed history, and conversation compression.

## Project structure

```
tui-agent/
├── cmd/
│   └── main.go              # entrypoint
├── internal/
│   ├── agent/
│   │   └── client.go        # OpenRouter streaming client
│   ├── skill/
│   │   └── loader.go        # Skill configuration loader
│   └── ui/
│       ├── model.go         # Bubbletea model (Update / View)
│       └── styles.go        # Lipgloss styles (opencode color scheme)
├── skills/                   # Skill configuration files (.md)
├── tools/                    # Executable tools for /tool command
├── .system/system.md         # Global system prompt
├── .memory/memory.md         # Compressed conversation summaries
└── README.md
```

## Setup

```bash
# 1. Install dependencies
go mod tidy

# 2. Set your OpenRouter API key
export OPENROUTER_API_KEY=sk-or-...

# 3. Run
go run ./cmd/main.go
```

## Keybindings

| Key          | Action              |
|--------------|---------------------|
| `Enter`      | Send message        |
| `Alt+Enter`  | Insert newline      |
| `Ctrl+C`     | Quit |

## Commands

### Global System Prompt

Place your global system prompt in `.system/system.md`. This prompt is loaded at startup and prepended to all conversations, establishing session-wide policies.

### Switching Skills

Use `/skill <name>` to switch between different AI personas:

```
/skill SampleAssistant
```

Skills are defined in `.md` files in the `skills/` directory. The first skill in the directory is loaded by default.

### Tool Calling

Execute tools with `/tool <json>`:

```
/tool {"tool": "echo", "args": ["hello", "world"]}
```

Tools must be placed in the `tools/` directory and listed in the `TOOL_WHITELIST` environment variable (comma-separated). Default whitelist: `echo,time,date`.

### Compress Conversation

Use `/compress` to save a summarized version of your conversation to `.memory/memory.md`:

```
/compress
```

This sends your conversation history to the LLM for summarization, preserving key points while reducing memory usage. The full conversation remains in Redis.

## Redis Configuration

Set `REDIS_URL` to enable conversation history persistence:

```bash
export REDIS_URL=localhost:6379
# or with password
export REDIS_URL=rediss://:password@host:6379
```

The session ID can be customized with `SESSION_ID` env var (defaults to "default").

## Changing the model

Set the `MODEL_NAME` environment variable:

```bash
export MODEL_NAME=openai/gpt-4o
```

Any model available on https://openrouter.ai/models works.

## Development

```bash
# Run tests
go test ./...

# Build
go build -o tui-agent ./cmd/main.go
```