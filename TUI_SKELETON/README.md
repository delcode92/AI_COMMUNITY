# tui-agent

A simple CLI agent with a Bubbletea TUI and OpenRouter backend.

## Project structure

```
tui-agent/
├── cmd/
│   └── main.go              # entrypoint
├── internal/
│   ├── agent/
│   │   └── client.go        # OpenRouter streaming client
│   └── ui/
│       ├── model.go         # Bubbletea model (Update / View)
│       └── styles.go        # Lipgloss styles (opencode color scheme)
├── go.mod
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
| `Ctrl+C`     | Quit (or cancel stream) |

## Changing the model

Edit `modelName` in `internal/ui/model.go`:

```go
modelName: "anthropic/claude-3.5-sonnet",
// or: "openai/gpt-4o", "google/gemini-2.0-flash", etc.
```

Any model available on https://openrouter.ai/models works.

## What's next?

- [ ] System prompt / persona support
- [ ] Conversation save/load
- [ ] Multiple sessions / tabs
- [ ] Tool/function calling
- [ ] Markdown rendering (goldmark or glamour)
