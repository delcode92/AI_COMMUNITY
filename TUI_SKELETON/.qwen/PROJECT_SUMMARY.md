# Project Summary

## Overall Goal
Add a configurable LLM model, dark‑orange UI theme, and a flexible skill system to the Go TUI so that markdown‑defined skills can be loaded, selected at runtime, and used to drive tool execution with persistent Redis‑backed chat history.

## Key Knowledge
- **Environment**: Go project using Bubble Tea, Lipgloss, and an OpenRouter streaming client.  
- **Config**: `.env` supplies `OPENROUTER_API_KEY` and `MODEL_NAME`. Loaded via `github.com/joho/godotenv` in `cmd/main.go`.  
- **UI Theme**: Dark black background with light orange accents (`internal/ui/styles.go`).  
- **Skill Loader** (`internal/skill/loader.go`): Scans `skills/` for `*.md`, parses `name:`, `description:`, and multiline `system_prompt: |`. The file name is arbitrary; the logical identifier is the `name:` field.  
- **Skill Integration** (`internal/ui/model.go`): Loads the first skill, injects its `system_prompt` into the conversation history, and now treats that prompt as a *user* message to enforce exact wording.  
- **Global System Prompt**: A high‑level instruction file `/.system/system.md` will be read at startup and inserted as the **first** `system`‑role message, providing overall policies, a list of available skills, and tool‑calling rules.  
- **Dynamic Skill Switching**: Planned `/skill <name>` command in the chat box to change the active skill while preserving the global system prompt.  
- **Tool Execution**: The LLM will request tools via a JSON payload (`{ "tool": "name", "args": [...] }`). A generic `ExecuteTool` runner will locate executables/scripts under `tools/`, run them with `os/exec`, capture output, and feed it back as an assistant message. A whitelist will restrict which tools may be invoked.  
- **Chat History Persistence**: Redis will store the message list per session (`session:<id>:history`) using `github.com/go-redis/redis/v9`. The history is saved after each turn and reloaded on program start, ensuring context survives restarts.  
- **Error Handling**: Missing skill/tool, unknown command, or Redis failures are reported as friendly messages; no panics.  
- **Testing**: Unit tests for global prompt loading, `/skill` parsing, tool execution, and Redis persistence (mocked).  

## Recent Actions
1. Added `.env` handling and model selection via `MODEL_NAME`.  
2. Updated UI colors to dark background with orange accents.  
3. Implemented `internal/skill/loader.go` and integrated it; the first skill’s prompt is now pre‑seeded in conversation history.  
4. Fixed panic caused by copying a non‑zero `strings.Builder` by switching `streamBuf` to a pointer.  
5. Modified the skill prompt to a stricter wording that tells the model not to prepend its own greeting.  
6. Switched the skill prompt from a `system` message to a `user` message to enforce exact compliance.  

## Current Plan
1. **[TODO]** Load `.system/system.md` at startup and prepend it as the first `system`‑role message for the whole session.  
2. **[TODO]** Implement `/skill <name>` command to dynamically select a skill, replace the skill‑specific prompt, and optionally reset chat history while keeping the global system prompt.  
3. **[TODO]** Add a generic tool‑calling interface: detect JSON tool requests, execute the corresponding binary/script in `tools/`, whitelist allowed tools, and return the output to the model.  
4. **[TODO]** Integrate Redis for chat‑history persistence: save after each turn, load on start, configurable via `REDIS_URL`.  
5. **[TODO]** Write unit and integration tests for the new features (global prompt loader, skill switching, tool execution, Redis persistence).  
6. **[TODO]** Update documentation (`README.md` / `QWEN.md`) with usage instructions for the global system file, `/skill` command, adding tools, and Redis configuration.  

---

## Summary Metadata
**Update time**: 2026-05-09T12:26:54.218Z 
