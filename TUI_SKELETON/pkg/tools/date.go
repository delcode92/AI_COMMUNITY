package tools

import (
	"context"
	"time"

	"github.com/Ingenimax/agent-sdk-go/pkg/interfaces"
)

// DateTool returns the current date.
type DateTool struct{}

func NewDateTool() *DateTool {
	return &DateTool{}
}

func (t *DateTool) Name() string {
	return "date"
}

func (t *DateTool) Description() string {
	return "Get the current date"
}

func (t *DateTool) Parameters() map[string]interfaces.ParameterSpec {
	return map[string]interfaces.ParameterSpec{}
}

func (t *DateTool) Run(ctx context.Context, input string) (string, error) {
	return t.Execute(ctx, "")
}

func (t *DateTool) Execute(ctx context.Context, args string) (string, error) {
	return time.Now().Format("2006-01-02"), nil
}