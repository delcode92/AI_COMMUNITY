package tools

import (
	"context"
	"strings"

	"github.com/Ingenimax/agent-sdk-go/pkg/interfaces"
)

// EchoTool echoes back the input.
type EchoTool struct{}

// NewEchoTool creates a new echo tool.
func NewEchoTool() *EchoTool {
	return &EchoTool{}
}

func (t *EchoTool) Name() string {
	return "echo"
}

func (t *EchoTool) Description() string {
	return "Echo back the input arguments"
}

func (t *EchoTool) Parameters() map[string]interfaces.ParameterSpec {
	return map[string]interfaces.ParameterSpec{
		"args": {
			Type:        "array",
			Description: "Arguments to echo",
			Required:    true,
		},
	}
}

func (t *EchoTool) Run(ctx context.Context, input string) (string, error) {
	return t.Execute(ctx, input)
}

func (t *EchoTool) Execute(ctx context.Context, args string) (string, error) {
	return strings.Join(strings.Fields(args), " "), nil
}