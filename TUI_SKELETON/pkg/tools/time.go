package tools

import (
	"context"
	"time"

	"github.com/Ingenimax/agent-sdk-go/pkg/interfaces"
)

// TimeTool returns the current time.
type TimeTool struct{}

func NewTimeTool() *TimeTool {
	return &TimeTool{}
}

func (t *TimeTool) Name() string {
	return "time"
}

func (t *TimeTool) Description() string {
	return "Get the current time"
}

func (t *TimeTool) Parameters() map[string]interfaces.ParameterSpec {
	return map[string]interfaces.ParameterSpec{}
}

func (t *TimeTool) Run(ctx context.Context, input string) (string, error) {
	return t.Execute(ctx, "")
}

func (t *TimeTool) Execute(ctx context.Context, args string) (string, error) {
	return time.Now().Format(time.RFC1123), nil
}