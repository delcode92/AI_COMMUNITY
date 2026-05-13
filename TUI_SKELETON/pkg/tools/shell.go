package tools

import (
	"context"
	"fmt"
	"os/exec"
	"strings"

	"github.com/Ingenimax/agent-sdk-go/pkg/interfaces"
)

// ShellTool wraps the existing shell script tool.
type ShellTool struct{}

// NewShellTool creates a new shell tool.
func NewShellTool() *ShellTool {
	return &ShellTool{}
}

// Name returns the tool name.
func (t *ShellTool) Name() string {
	return "shell"
}

// Description returns the tool description.
func (t *ShellTool) Description() string {
	return "Execute shell commands with safety constraints. Blocks dangerous patterns."
}

// Parameters returns the tool parameters.
func (t *ShellTool) Parameters() map[string]interfaces.ParameterSpec {
	return map[string]interfaces.ParameterSpec{
		"command": {
			Type:        "string",
			Description: "The shell command to execute",
			Required:    true,
		},
		"args": {
			Type:        "array",
			Description: "Arguments for the command",
			Required:    false,
		},
	}
}

// Run executes the tool with JSON input.
func (t *ShellTool) Run(ctx context.Context, input string) (string, error) {
	return t.Execute(ctx, input)
}

// Execute runs the shell command.
func (t *ShellTool) Execute(ctx context.Context, args string) (string, error) {
	// Parse args - format: "command arg1 arg2"
	parts := strings.Fields(args)
	if len(parts) == 0 {
		return "", fmt.Errorf("no command provided")
	}

	// Security check for dangerous patterns
	blocked := []string{
		"rm -rf /", "rm -rf ~", "mkfs", "dd if=", "> /dev/sd",
		"chmod -R 777 /", "shutdown", "reboot", "init 0", "init 6",
		":(){ :|:& };:", "wget http", "curl -X POST > /dev/null 2>&1",
	}

	lowerArgs := strings.ToLower(args)
	for _, pattern := range blocked {
		if strings.Contains(lowerArgs, pattern) {
			return "", fmt.Errorf("command contains blocked pattern: %s", pattern)
		}
	}

	cmd := exec.CommandContext(ctx, parts[0], parts[1:]...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), err
	}
	return string(output), nil
}