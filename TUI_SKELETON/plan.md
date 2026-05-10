# TUI Agent Workflow + reAct Implementation Plan

## Overview

This plan implements a **Hybrid Workflow** system with **reAct (Reasoning + Action)** capabilities for handling both clear requests and ambiguous prompts. The agent can auto-suggest tool execution after clarifying context, persist workflow state, and resume seamlessly once user provides missing information.

---

## Core Components

### 1. **System Prompt Enhancement** (`.system/system.md`)

**Purpose**: Instruct LLM on when to ask clarifying questions vs. propose workflows

**Add these guidelines**:
```markdown
# reAct Pattern
Before taking action or suggesting workflows:
1. Analyze if the user's request is specific enough
2. If AMBIGUOUS or BROAD → ask clarifying questions (DO NOT proceed)
3. If CLEAR → propose workflow and await confirmation

Example clarification:
"Before I create that chart, could you clarify:
- What type (bar, line, pie)?
- What data source?
- What time range?"
```

---

### 2. **New Data Structures** (`internal/ui/model.go`)

#### `ReactState` Struct
```go
type ToolCall struct {
    Tool  string            `json:"tool"`
    Args  map[string]string `json:"args"`
    Ready bool              `json:"ready"`
}

type ReactState struct {
    ClarificationNeeded     bool       `json:"clarification_needed"`
    MissingContext          []string   `json:"missing_context"`
    ClarificationQuestion   string     `json:"clarification_question"`
    ProposedWorkflow        string     `json:"proposed_workflow,omitempty"`
    PendingToolCalls        []ToolCall `json:"pending_tool_calls,omitempty"`
    Timestamp               time.Time  `json:"timestamp"`
}
```

**Purpose**: Track clarification loops and pending workflow execution

---

### 3. **Redis Integration for reAct State**

#### New Redis Keys
- `session:{id}:react_state` - Current reAct state (clarification needed, pending tools)
- `session:{id}:workflow` - Existing workflow state
- `session:{id}:history` - Existing chat history

#### New Functions
```go
func (m *Model) saveReactState(state ReactState) error
func (m *Model) loadReactState() (*ReactState, error)
func (m *Model) clearReactState() error
```

---

### 4. **reAct Flow Implementation** (`internal/ui/model.go`)

#### A. **Clarification Detection** (in `streamDoneMsg` case)
```go
response := m.streamBuf.String()
needsClarification, clarification, missingContext := m.parseClarificationResponse(response)

if needsClarification {
    reactState := ReactState{
        ClarificationNeeded: true,
        MissingContext: missingContext,
        ClarificationQuestion: clarification,
        Timestamp: time.Now(),
    }
    _ = m.saveReactState(reactState)
    _ = m.persistReactLogFile(reactState)
    
    m.entries = append(m.entries, chatEntry{role: "assistant", content: clarification})
    m.viewport.SetContent(m.renderMessages())
    m.viewport.GotoBottom()
    _ = m.saveHistory()
    return m
}
```

#### B. **Clarification Parser**
```go
func (m *Model) parseClarificationResponse(response string) (
    needsClarification bool, 
    clarification string, 
    missingContext []string)

func (m *Model) extractMissingContext(response string) []string
```

**Markers detected**: "could you clarify", "please specify", "what type", which data", "more information", "i need to know", "before i can"

#### C. **Auto-Resume on User Reply** (in `tea.KeyEnter` case)
```go
// Check for pending reAct state BEFORE normal processing
reactState, err := m.loadReactState()
if err == nil && reactState.ClarificationNeeded {
    _ = m.clearReactState()
    
    // Add clarification to conversation
    m.history = append(m.history, agent.Message{Role: "user", Content: input})
    m.entries = append(m.entries, chatEntry{role: "user", content: input})
    
    // Re-trigger LLM with new context - auto-resume workflow
    m.streaming = true
    m.streamBuf.Reset()
    m.viewport.SetContent(m.renderMessages())
    m.viewport.GotoBottom()
    var streamCmd tea.Cmd
    m, streamCmd = m.startStream()
    cmds = append(cmds, streamCmd)
    return m, tea.Batch(cmds...)
}

// Normal flow (no reAct state)
```

---

### 5. **File Persistence**

#### New File Structure
```
.memory/
  ├── memory.md                 # Conversation summaries
  ├── workflows/
  │   └── {sessionId}.json      # Workflow execution logs
  └── react_logs/
      └── {sessionId}.json      # reAct clarification loop logs
```

#### New Functions
```go
func (m *Model) persistReactLogFile(state ReactState) error
func (m *Model) saveWorkflowState(workflow WorkflowState) error
func (m *Model) loadWorkflowState() (*WorkflowState, error)
```

---

### 6. **Hybrid Workflow Execution**

#### Tool Schema Registration
```go
type ToolSchema struct {
    Name        string                 `json:"name"`
    Description string                 `json:"description"`
    Parameters  map[string]interface{} `json:"parameters"`
}

var toolSchemas = []ToolSchema{
    {
        Name: "echo",
        Description: "Echo text arguments",
        Parameters: map[string]interface{}{
            "args": map[string]string{
                "type": "array",
                "items": {"type": "string"},
            },
        },
    },
    // ... add more tools as needed
}
```

#### Workflow Parser (detects LLM-intended tool calls)
```go
func (m *Model) parseWorkflowFromResponse(response string) ([]ToolCall, error) {
    // Extract JSON blocks from text response
    // Extract structured tool call suggestions
    // Validate against TOOL_WHITELIST
    // Return pending ToolCall slice
}
```

#### User Confirmation Flow
```go
// After detecting workflow from LLM response:
if workflowCalls, err := m.parseWorkflowFromResponse(response); err == nil && len(workflowCalls) > 0 {
    // Display workflow proposal to user
    proposal := formatWorkflowProposal(workflowCalls)
    m.entries = append(m.entries, chatEntry{role: "assistant", content: proposal})
    m.viewport.SetContent(m.renderMessages())
    m.viewport.GotoBottom()
    
    // Wait for user confirmation
    // Either explicit /confirm command OR auto-confirm for safe tools
}
```

---

### 7. **UI Enhancements**

#### New Styles (`internal/ui/styles.go`)
```go
var ClarificationStyle = lipgloss.NewStyle().
    Foreground(lipgloss.Color("#ffb86c")).
    Border(lipgloss.RoundedBorder()).
    BorderForeground(lipgloss.Color("#ffb86c")).
    Padding(0, 1)

var WorkflowProposalStyle = lipgloss.NewStyle().
    Foreground(lipgloss.Color(colorTeal)).
    Border(lipgloss.RoundedBorder()).
    BorderForeground(lipgloss.Color(colorMuted)).
    Padding(0, 1)
```

#### New UI Elements (`internal/ui/model.go`)
```go
func (m Model) renderClarificationBox(state *ReactState) string
func (m Model) renderWorkflowProposal(proposals []ToolCall) string
```

---

### 8. **File Persistence for reAct Logs**

```go
func (m *Model) persistReactLogFile(state ReactState) error {
    logEntry := map[string]interface{}{
        "clarification_needed": state.ClarificationNeeded,
        "missing_context": state.MissingContext,
        "clarification_question": state.ClarificationQuestion,
        "proposed_workflow": state.ProposedWorkflow,
        "timestamp": state.Timestamp.Format("2006-01-02 15:04:05"),
    }
    
    f, _ := os.OpenFile(fmt.Sprintf(".memory/react_logs/%s.log", m.sessionID),
        os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
    defer f.Close()
    
    data, _ := json.MarshalIndent(logEntry, "", "  ")
    f.WriteString(fmt.Sprintf("%s\n", string(data)))
    return nil
}
```

---

## Implementation Steps

### Step 1: Data Structures & Schema
- [ ] Add `ReactState` and `ToolCall` structs to `internal/ui/model.go`
- [ ] Add `ToolSchema` struct to `internal/agent/client.go`
- [ ] Add `toolSchemas` variable to register available tools

### Step 2: Redis Functions
- [ ] Implement `saveReactState()`, `loadReactState()`, `clearReactState()`
- [ ] Implement `saveWorkflowState()`, `loadWorkflowState()`
- [ ] Test Redis persistence with existing chat history

### Step 3: reAct Flow Core
- [ ] Implement `parseClarificationResponse()` function
- [ ] Implement `extractMissingContext()` function
- [ ] Add clarification detection in `streamDoneMsg` case
- [ ] Add auto-resume logic in `tea.KeyEnter` case

### Step 4: File Persistence
- [ ] Implement `persistReactLogFile()` function
- [ ] Create `.memory/react_logs/` directory on startup
- [ ] Implement workflow JSON log persistence

### Step 5: Workflow Detection
- [ ] Implement `parseWorkflowFromResponse()` function
- [ ] Add JSON block extraction from text responses
- [ ] Validate extracted tools against whitelist

### Step 6: UI Enhancements
- [ ] Add `ClarificationStyle` and `WorkflowProposalStyle` to `styles.go`
- [ ] Implement `renderClarificationBox()` in `model.go`
- [ ] Implement `renderWorkflowProposal()` in `model.go`
- [ ] Update `renderMessages()` to display reAct state

### Step 7: System Prompt Update
- [ ] Update `.system/system.md` with reAct guidelines
- [ ] Add clarification examples
- [ ] Document workflow proposal behavior

### Step 8: Testing & Verification
- [ ] Test ambiguity detection with broad prompts
- [ ] Test clarification flow end-to-end
- [ ] Test auto-resume on user reply
- [ ] Test Redis persistence across restarts
- [ ] Test file log formatting

---

## Key Design Decisions

### Detection Strategy: LLM Self-Detect (Selected)
**Why**: Leverages OpenRouter's reasoning capabilities without post-processing

### Behavior: Save Partial Workflow State (Selected)
**Why**: Preserves user intent during clarification, enables seamless resume

### Flow: Auto-Resume on User Reply (Selected)
**Why**: Eliminates manual confirmation steps, smooth UX

### Hybrid Trigger Sources (Selected)
- Skill-based tools via `trigger_tools` in `.md` files
- OpenRouter function calling responses (if model supports)
- Text-based JSON blocks in LLM responses
- Explicit `/tool` commands (existing)

### Workflow Execution: User Confirms First (Selected)
**Why**: Safety-first approach, prevents unexpected actions

---

## Files to Modify

| File | Changes |
|------|---------|
| `.system/system.md` | Add reAct guidelines and clarification examples |
| `internal/ui/model.go` | Add ReactState, workflow logic, reAct flow, file persistence |
| `internal/ui/styles.go` | Add ClarificationStyle, WorkflowProposalStyle |
| `internal/agent/client.go` | Add ToolSchema struct, tool registration |
| `go.mod` | No changes needed (already has all dependencies) |

---

## Testing Strategy

### Unit Tests
- `TestParseClarificationResponse()` - verify ambiguity detection
- `TestExtractMissingContext()` - verify context extraction
- `TestValidateWorkflowState()` - verify workflow validation

### Integration Tests
- `TestClarificationFlow()` - full clarification loop
- `TestAutoResumeFlow()` - clarification → resume → execution
- `TestReactStatePersistence()` - Redis load/save

### E2E Tests
- Type ambiguous prompt → verify clarification question
- Provide clarification → verify workflow proposal
- Confirm workflow → verify execution → verify logs

---

## Future Enhancements

1. **Skill-Specific Workflows**: Each skill could have predefined workflows in its `.md` file
2. **Workflow Templates**: Pre-built workflow patterns for common tasks (e.g., "data analysis")
3. **Workflow Versioning**: Track workflow changes over time
4. **Shared Workflows**: Export/import workflows between sessions
5. **Workflow Marketplace**: Community-contributed workflow templates
