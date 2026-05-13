# Project Summary

## Overall Goal
Fix all remaining bugs in the Cooney TUI agent's workflow/tool execution system and add regression tests so multi-step tool workflows execute reliably in production.

## Key Knowledge

- **Project root:** `/Users/Admin/Documents/project/AI_COMMUNITY/TUI_SKELETON`
- **Language:** Go (module `aicommunity.omniq.my.id/cliagent`)
- **TUI Framework:** Bubble Tea; Styling: Lipgloss (opencode dark theme)
- **Backend:** OpenRouter API (streaming HTTP), Redis (chat history persistence), SQLite (user progress)
- **Agent state machine:** 4 modes — `""` (normal chat), `"workflow"`, `"tool_confirm"`, `"clarify"`
- **Tool extraction:** 4 regex patterns in `extractToolCommands()` — `/tool` prefix, bare JSON, markdown code blocks, OpenAI XML-wrapped (`<toolname>{...}</toolname>`)
- **Workflow detection:** Requires 2+ steps AND at least one tool call (strict mode to avoid false positives)
- **Build command:** `go build ./...` — passes
- **Test command:** `go test ./...` — all 10 tests pass in `internal/ui`
- **Entry point:** `cmd/main.go`; Core logic: `internal/ui/model.go`; Tool parsing: `internal/ui/model_tools.go`; Tool types: `internal/ui/model_types.go`
- **8 tools:** echo, time, date, read, write, list, mkdir, shell
- **User preference:** Direct, terse responses; full-stack developer building Cooney AI learning companion with Next.js/Express stack
- **Debugging approach:** Use in-app methods (status bar, debug viewport, toggleable overlay) — not stdout/stderr

## Recent Actions

- **Analyzed remaining bugs** and wrote findings to `must_optimized.txt` — identified 5 problems with root causes and fix strategies
- **Fixed 5 bugs in `internal/ui/model.go`:**
  1. **extractStepAction overcomplicated** — Replaced 3 nested loops with single regex `(?i)^(?:step\s+\d+:\s*|^\d+\.\s*|[-*•]\s+)(.*)`
  2. **Tools silently skipped in workflows** — `parseWorkflow` now accepts `[]pendingTool` param and uses `extractToolCommands()` on full response for reliable detection across all 4 formats
  3. **Silent failures in runNextStep** — Added error chat entries on parse failure and unknown tool instead of silently skipping
  4. **parseWorkflow only checks next line** — Now scans full response text via `extractToolCommands()` instead of checking only the next step's action text
  5. **formatArgsForJSON splits args wrong** — Replaced `strings.Fields` with `json.Marshal` for proper quoting of multi-word arguments
- **Build verification:** `go build ./...` passes (exit 0)
- **Test verification:** All 10 tests pass in `internal/ui`
- **Updated `note.md`** — Added 5 new bug fix entries and 4 new feature entries to the summary tables

## Current Plan

1. [DONE] Analyze remaining bugs → write `must_optimized.txt`
2. [DONE] Simplify `extractStepAction` with single regex
3. [DONE] Fix `parseWorkflow` to use `extractToolCommands` for reliable tool detection
4. [DONE] Add error messages in `runNextStep` for silent failures
5. [DONE] Fix `formatArgsForJSON` with `json.Marshal`
6. [DONE] Build and test verification — all pass
7. [TODO] End-to-end testing with live OpenRouter API session
8. [TODO] Add regression tests for the 4 new bug fixes (stepIndex, empty Enter routing, XML detection, multi-tool)

---

## Summary Metadata
**Update time**: 2026-05-13T12:49:55.555Z 
