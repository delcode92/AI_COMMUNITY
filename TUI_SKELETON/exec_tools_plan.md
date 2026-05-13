# Execute Tools Plan

## Overview
Enable skills to auto-execute shell commands with full process logging to terminal.

## Implementation Tasks

### 1. Create SystemExecutor Skill (`skills/system_executor.md`)
- **name**: SystemExecutor
- **description**: Execute host system commands
- **system_prompt**: Use /tool {"tool":"shell","args":[...]} for commands. Supported: ls, cat, touch, grep, find, pwd, whoami

### 2. Add Shell Tool (`tools/shell`)
- Bash script executor with dangerous pattern blocking
- Blocks: rm -rf /, mkfs, dd, shutdown, fork bombs
- Usage: `tools/shell <command> [args...]`

### 3. Modify Model (`internal/ui/model.go`)
- Parse LLM response for `/tool` JSON patterns
- Auto-execute detected tool commands
- Log process: "Executing: shell args..." → output → "Completed"
- Append output to conversation history

### 4. Add Process Logging
- Show execution start message
- Show tool output with formatting
- Show completion status with exit code

## Workflow

```
User: List files in current directory
Agent: [Creates todo: Execute ls command]
Assistant: (thinking to use tool)
Executing: shell ["ls", "-la"]
[output appears]
Command completed with exit code: 0
```

## Multi-Skill Compatibility

The shell tool is skill-agnostic:
- Any skill can use `/tool {"tool":"shell","args":[...]}`
- Security checks happen in the tool itself
- Each skill's system_prompt guides appropriate usage

### Example Skills:
- **FileManager.md**: ls, cat, touch, mkdir (blocks: rm, dd, mkfs)
- **NetworkSkill.md**: curl (GET only), ping, wget (blocks: POST, nc)
- **SystemExecutor.md**: General command execution with safeguards
