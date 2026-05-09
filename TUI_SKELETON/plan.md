# Implementation Plan

## 1. Global system prompt
- Add a helper `loadGlobalPrompt(path string) (string, error)` that reads `.system/system.md`.
- In UI initialization (`ui.New()`), create `agent.Message{Role: "system", Content: <file content>}` and prepend it to `Model.history` before any skill‑specific prompts are added.
- If the file is missing, start with an empty system message and log a warning.

## 2. Dynamic skill selection (`/skill <name>`)
- Extend `Model.Update` to detect user input that starts with the command `/skill`.
- Parse the skill name, look it up in the already‑loaded `skillMap` (populated by `skill.LoadSkills("skills")`).
- Replace the skill‑specific system message in `history` while preserving the global system message at index 0.
- Optionally clear the rest of the history (except the global system message) when switching skills.
- Send a confirmation message to the UI, e.g., "Switched to skill **SampleAssistant**".

## 3. Tool‑calling interface
- Define a JSON schema for tool requests, e.g. `{ "tool": "name", "args": ["arg1", "arg2"] }`.
- In `internal/agent/client.go`, after streaming the LLM response, detect a block that matches this schema.
- Implement `ExecuteTool(name string, args []string) (string, error)` that runs `./tools/<name>` via `os/exec`, captures `stdout`/`stderr`, and returns the output string.
- Add a whitelist (configurable via an env variable or a tiny config file) that lists allowed tool names; reject any request for a non‑whitelisted tool.
- Feed the tool output back to the model as an assistant message so the LLM can incorporate the result.

## 4. Redis‑backed chat history
- Add a Redis client (`github.com/go-redis/redis/v9`). The connection string is read from `REDIS_URL` (fallback to `redis://localhost:6379`).
- Provide helper functions:
  - `SaveHistory(sessionID string, msgs []agent.Message) error` – serialize the slice to JSON and `SET` it under the key `session:<sessionID>:history`.
  - `LoadHistory(sessionID string) ([]agent.Message, error)` – `GET` the key, deserialize JSON back to the slice.
- On each turn (after updating `Model.history`) call `SaveHistory`.
- At program start, call `LoadHistory`; if a history exists, use it (it already contains the global system message), otherwise start with the freshly loaded global system prompt.
- Ensure the Redis client is closed gracefully on program exit.

## 5. Testing
- Unit test for `loadGlobalPrompt` (verify content is read correctly and converted to a system message).
- Unit test for the `/skill` command parsing and history replacement logic.
- Integration test with a dummy tool placed in `tools/echo.sh` that echoes its arguments; verify `ExecuteTool` runs it and returns the expected output.
- Mock Redis in tests to verify `SaveHistory`/`LoadHistory` correctly persist and retrieve the message slice.

## 6. Documentation
- Update `README.md` / `QWEN.md` with sections:
  - **Global system prompt** – where to place `.system/system.md` and its effect.
  - **Switching skills** – usage of `/skill <name>`.
  - **Adding tools** – how to place executables in `tools/`, the JSON request format, and the whitelist mechanism.
  - **Redis configuration** – setting `REDIS_URL` and any optional password handling.

---

### Safety & UX notes
- All file reads are read‑only; writes only happen after explicit user confirmation.
- Tool execution is confined to the `tools/` directory and respects a whitelist to avoid arbitrary command execution.
- Redis credentials are supplied via environment variables; no secrets are hard‑coded.
- Errors (missing skill, unknown tool, Redis failures) are reported as friendly messages rather than panics.
