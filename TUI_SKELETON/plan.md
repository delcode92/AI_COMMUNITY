# Plan: AI CLI Agent Workflow Improvement

## Current Issues
- `executeNextTodo()` runs all steps immediately without user confirmation
- No human-readable format for todo lists (shown as raw output during execution)
- Workflow state not persisted to Redis (lost between sessions)
- No reAct-style confirmation before tool-using steps

## Implementation Completed ✅

### 1. Added workflow confirmation state to Model struct ✅
- Added `pendingTodoList *TodoList` - workflow waiting for confirmation
- Added `awaitingConfirmation bool` - flag for confirmation state
- Added `workflowMode string` - track if in "pending", "executing", or "idle" mode
- Added `currentStepIndex int` - which step we're on during execution

### 2. Created human-readable todo list display ✅
- Added `formatTodoListAsBullets()` method that formats as:
  ```
  **Proposed Workflow:**

  • Step 1: Create project directory
  • Step 2: Initialize git repo
  • Step 3: Create README.md

  Proceed? (y/Enter=yes, n=no)
  ```

### 3. Persisted workflow state to Redis ✅
- Added `saveWorkflowToRedis()` - saves todo list to `session:{id}:workflow`
- Added `appendWorkflowToMemory()` - saves completed steps to `.memory/memory.md`

### 4. Added confirmation prompt before execution ✅
- When workflow detected, shows bullet list and waits for confirmation
- User types "y", "yes", or presses Enter to confirm
- User types "n" or "no" to cancel
- For tool steps during execution: shows `Execute tool? (y/n)` prompt

### 5. Execute workflow step-by-step with reAct ✅
- Added `executeWorkflowStep()` - runs one step at a time
- Non-tool steps execute immediately and auto-continue
- Tool steps require explicit confirmation
- After confirmation, continues to next step

### 6. Update Redis/memory.md after each step ✅
- `saveWorkflowToRedis()` called after each step
- `appendWorkflowToMemory()` appends to `.memory/memory.md` with timestamp

## Key Changes Made to `internal/ui/model.go`

1. **Updated `executeNextTodo()`** - Now shows workflow and waits for confirmation instead of auto-executing

2. **Added `formatTodoListAsBullets()`** - Formats todo items as human-readable bullet points

3. **Added `executeWorkflowStep()`** - Single-step execution with tool confirmation

4. **Added `confirmWorkflowTool()`** - Executes confirmed tool step

5. **Added `saveWorkflowToRedis()`** - Persists workflow state

6. **Added `appendWorkflowToMemory()`** - Saves completed steps to memory.md

7. **Updated KeyEnter handler** - Added workflow confirmation input handling

## Testing
- Code compiles successfully with `go build ./...`
- Variables: OPENROUTER_API_KEY required for running

---

## Additional Work: File Manipulation Toolkit ✅

Created a basic file toolkit for handling files and directories within the TUI agent:

### Tools Created
| Tool | Purpose | Usage Example |
|------|---------|---------------|
| `read` | Read file contents | `{"tool":"read","args":["file.txt"]}` |
| `write` | Write content to file | `{"tool":"write","args":["file.txt","content"]}` |
| `list` | List directory contents | `{"tool":"list","args":["."]}` |
| `mkdir` | Create directories | `{"tool":"mkdir","args":["dirname"]}` |

### Implementation Details
- All tools are shell scripts in `tools/` directory
- Made executable with `chmod +x`
- Integrated with existing tool execution system via `/tool` command
- Requires `TOOL_WHITELIST` environment variable to include new tools

### Testing Verified
- `read tool`: Successfully reads file contents
- `write tool`: Successfully writes and reads back content
- `list tool`: Successfully lists directory with `-la` format
- `mkdir tool`: Successfully creates directories
- `go build`: Compiles successfully with new tools present

---

## Bug Fix Attempts: Tool Command Parsing & Workflow Detection ❌⚠️

Despite multiple fix attempts, the LLM agent still responds with `<>` XML-style tags (like `<tool_call>`) instead of the expected `/tool` JSON format, and tool execution / workflow detection remain broken at runtime.

### What Was Tried

#### Fix Round 1 (System Prompt + <> Tag Fallbacks)
1. **Updated `.system/system.md`** — Added explicit format instructions telling the LLM to use `/tool {"tool":"name","args":[...]}` for tool calls and `Step N:` for workflows. Instructed NOT to use `<>` tags.
2. **Added `<>` tag parsing to `extractToolCommand()`** — Added regex fallbacks for `<tool>JSON</tool>`, `<tool name="..." />`, and `<tool>name</tool>` formats.
3. **Added `<>` tag parsing to `parseWorkflowFromLLM()`** — Added regex fallbacks for `<workflow>`/`<plan>` wrappers and `<step>` tags (with or without wrappers).
4. **Fixed `confirmWorkflowTool()` bug** — Was passing `item.Action` (description text like "Create project directory") as the tool name instead of the extracted tool name. Changed to use extracted `toolName`.
5. **Added `ToolCmd` field to `TodoItem`** — Parser now captures `/tool` commands on lines immediately following a step line, so `executeWorkflowStep` can use them.
6. **Cleaned up raw streamed response in `streamDoneMsg`** — When a workflow or tool command is detected, the raw streamed LLM response (with `<>` tags) is now removed from entries before showing clean output.

#### Fix Round 2 (Brace Matching + <tool_call> Support)
7. **Fixed JSON brace matching** — Replaced `strings.LastIndex(jsonPart, "}")` with a proper brace-depth counter (`findMatchingBrace`). The old code grabbed the LAST `}` in the string including stray/closing braces, causing `json.Unmarshal` to fail.
8. **Added `<tool_call>` tag parsing** — The model `poolside/laguna-xs.2:free` outputs `<tool_call>` natively. Added support for:
   - Format A: `<tool_call>shell\nargs":["ls","-la"]\n}` (partial JSON, missing `{`)
   - Format B: `<tool_call>shell\n<arg_key>args</arg_key>\n<arg_value>["mkdir"]