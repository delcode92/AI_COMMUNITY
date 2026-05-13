package tools

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/Ingenimax/agent-sdk-go/pkg/interfaces"
)

// ReadTool reads file contents.
type ReadTool struct{}

func NewReadTool() *ReadTool {
	return &ReadTool{}
}

func (t *ReadTool) Name() string {
	return "read"
}

func (t *ReadTool) Description() string {
	return "Read file contents"
}

func (t *ReadTool) Parameters() map[string]interfaces.ParameterSpec {
	return map[string]interfaces.ParameterSpec{
		"path": {
			Type:        "string",
			Description: "File path to read",
			Required:    true,
		},
	}
}

func (t *ReadTool) Run(ctx context.Context, input string) (string, error) {
	args := strings.Fields(input)
	if len(args) == 0 {
		return "", fmt.Errorf("no file path provided")
	}
	return t.Execute(ctx, args[0])
}

func (t *ReadTool) Execute(ctx context.Context, path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// WriteTool writes content to a file.
type WriteTool struct{}

func NewWriteTool() *WriteTool {
	return &WriteTool{}
}

func (t *WriteTool) Name() string {
	return "write"
}

func (t *WriteTool) Description() string {
	return "Write content to a file"
}

func (t *WriteTool) Parameters() map[string]interfaces.ParameterSpec {
	return map[string]interfaces.ParameterSpec{
		"path": {
			Type:        "string",
			Description: "File path to write",
			Required:    true,
		},
		"content": {
			Type:        "string",
			Description: "Content to write",
			Required:    true,
		},
	}
}

func (t *WriteTool) Run(ctx context.Context, input string) (string, error) {
	parts := strings.SplitN(input, " ", 2)
	if len(parts) < 2 {
		return "", fmt.Errorf("usage: write <path> <content>")
	}
	return t.Execute(ctx, fmt.Sprintf("%s %s", parts[0], parts[1]))
}

func (t *WriteTool) Execute(ctx context.Context, args string) (string, error) {
	parts := strings.SplitN(args, " ", 2)
	if len(parts) < 2 {
		return "", fmt.Errorf("usage: write <path> <content>")
	}
	path, content := parts[0], parts[1]
	err := os.WriteFile(path, []byte(content), 0644)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("Wrote %d bytes to %s", len(content), path), nil
}

// ListTool lists directory contents.
type ListTool struct{}

func NewListTool() *ListTool {
	return &ListTool{}
}

func (t *ListTool) Name() string {
	return "list"
}

func (t *ListTool) Description() string {
	return "List directory contents"
}

func (t *ListTool) Parameters() map[string]interfaces.ParameterSpec {
	return map[string]interfaces.ParameterSpec{
		"path": {
			Type:        "string",
			Description: "Directory path (defaults to current)",
			Required:    false,
		},
	}
}

func (t *ListTool) Run(ctx context.Context, input string) (string, error) {
	path := input
	if path == "" {
		path = "."
	}
	return t.Execute(ctx, path)
}

func (t *ListTool) Execute(ctx context.Context, path string) (string, error) {
	entries, err := os.ReadDir(path)
	if err != nil {
		return "", err
	}
	var result []string
	for _, e := range entries {
		info, _ := e.Info()
		result = append(result, fmt.Sprintf("%s %10d %s", e.Type(), info.Size(), e.Name()))
	}
	return strings.Join(result, "\n"), nil
}

// MkdirTool creates a directory.
type MkdirTool struct{}

func NewMkdirTool() *MkdirTool {
	return &MkdirTool{}
}

func (t *MkdirTool) Name() string {
	return "mkdir"
}

func (t *MkdirTool) Description() string {
	return "Create a directory"
}

func (t *MkdirTool) Parameters() map[string]interfaces.ParameterSpec {
	return map[string]interfaces.ParameterSpec{
		"path": {
			Type:        "string",
			Description: "Directory path to create",
			Required:    true,
		},
	}
}

func (t *MkdirTool) Run(ctx context.Context, input string) (string, error) {
	args := strings.Fields(input)
	if len(args) == 0 {
		return "", fmt.Errorf("no path provided")
	}
	return t.Execute(ctx, args[0])
}

func (t *MkdirTool) Execute(ctx context.Context, path string) (string, error) {
	err := os.MkdirAll(path, 0755)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("Created directory: %s", path), nil
}

// EnsureFileClosed is a helper for tool testing.
func EnsureFileClosed(f *os.File) {
	_ = f.Close()
}

// ValidatePath checks if a path is safe.
func ValidatePath(base, path string) bool {
	absBase, _ := filepath.Abs(base)
	absPath, _ := filepath.Abs(path)
	return strings.HasPrefix(absPath, absBase)
}