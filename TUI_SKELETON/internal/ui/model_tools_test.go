package ui

import (
	"testing"
)

func TestExtractToolCommands(t *testing.T) {
	tests := []struct {
		name     string
		response string
		wantLen  int
		wantTool string
		wantArgs string
	}{
		{
			name:     "single /tool command",
			response: `I'll create test.txt. /tool {"tool":"shell","args":["touch","test.txt"]}`,
			wantLen:  1,
			wantTool: "shell",
			wantArgs: "touch test.txt",
		},
		{
			name: "multiple /tool commands",
			response: `Creating file...
/tool {"tool":"shell","args":["touch","test.txt"]}
Verifying...
/tool {"tool":"shell","args":["ls","-la","test.txt"]}`,
			wantLen: 2,
		},
		{
			name:     "bare JSON tool object",
			response: `Here: {"tool":"shell","args":["echo","hello"]}`,
			wantLen:  1,
			wantTool: "shell",
			wantArgs: "echo hello",
		},
		{
			name:     "no tools",
			response: `Just a regular message with no tools.`,
			wantLen:  0,
		},
		{
			name:     "tool with newlines preserved",
			response: `Here: /tool {"tool":"shell","args":["ls","-la"]}`,
			wantLen:  1,
			wantTool: "shell",
		},
		{
			name:     "markdown with greater-than and less-than",
			response: "\n>\n<tool_call> {\"tool\":\"shell\",\"args\":[\"ls\"]}",
			wantLen:  1,
			wantTool: "shell",
		},
		{
			name:     "triple greater-than format",
			response: ">>>tool {\"tool\":\"shell\",\"args\":[\"ls\"]}",
			wantLen:  1,
			wantTool: "shell",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := &Model{}
			got := m.extractToolCommands(tt.response)
			if len(got) != tt.wantLen {
				t.Errorf("extractToolCommands() got %d tools, want %d (tools: %#v)", len(got), tt.wantLen, got)
			}
			if tt.wantLen > 0 && tt.wantTool != "" && got[0].name != tt.wantTool {
				t.Errorf("extractToolCommands() tool name = %s, want %s", got[0].name, tt.wantTool)
			}
		})
	}
}
// Tests for workflow parsing
func TestParseWorkflowFromLLM(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		wantLen  int
		wantStep int // which step to check
		wantAct  string // expected action for that step
	}{
		{
			name: "numbered steps with tool commands",
			input: `Here's my plan:
Step 1: Create a test directory
/tool {"tool":"shell","args":["mkdir","-p","test"]}
Step 2: Write a file
/tool {"tool":"shell","args":["echo","hello",">","test/hello.txt"]}`,
			wantLen:  2,
			wantStep: 0,
			wantAct:  "Create a test directory",
		},
		{
			name: "bullet points with tool commands",
			input: `My workflow:
- Create directory
/tool {"tool":"shell","args":["mkdir","newdir"]}
- List contents
/tool {"tool":"shell","args":["ls","-la"]}`,
			wantLen:  2,
			wantStep: 1,
			wantAct:  "List contents",
		},
		{
			name: "no workflow",
			input: `This is just a regular response with no workflow.`,
			wantLen:  0,
		},
		{
			name: "steps without tools - no workflow (plain list)",
			input: `Step 1: Do something
Step 2: Do another thing`,
			wantLen:  0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := Model{}
			got := m.parseWorkflowFromLLM(tt.input)
			if tt.wantLen == 0 {
				if got != nil {
					t.Errorf("parseWorkflowFromLLM() = %v, want nil", got)
				}
				return
			}
			if got == nil {
				t.Errorf("parseWorkflowFromLLM() = nil, want non-nil")
				return
			}
			if len(*got) != tt.wantLen {
				t.Errorf("parseWorkflowFromLLM() returned %d items, want %d", len(*got), tt.wantLen)
			}
			if tt.wantAct != "" && tt.wantStep < len(*got) {
				if (*got)[tt.wantStep].Action != tt.wantAct {
					t.Errorf("parseWorkflowFromLLM()[%d].Action = %q, want %q", tt.wantStep, (*got)[tt.wantStep].Action, tt.wantAct)
				}
			}
		})
	}
}
