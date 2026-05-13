package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/Ingenimax/agent-sdk-go/pkg/agent"
	"github.com/Ingenimax/agent-sdk-go/pkg/interfaces"
	openrouter "aicommunity.omniq.my.id/cliagent/pkg/llm/openrouter"
)

// SDKAgent wraps the SDK agent with our existing message types.
type SDKAgent struct {
	apiKey  string
	model   string
	tools   []interfaces.Tool
	ag      *agent.Agent
	llm     *openrouter.Client
}

// ToolRunner is an interface for executable tools
type ToolRunner interface {
	Name() string
	Description() string
	Run(ctx context.Context, input string) (string, error)
	Parameters() map[string]interfaces.ParameterSpec
}

// ToolAdapter adapts ToolRunner to interfaces.Tool
type ToolAdapter struct {
	tool ToolRunner
}

func (a *ToolAdapter) Name() string                         { return a.tool.Name() }
func (a *ToolAdapter) Description() string                  { return a.tool.Description() }
func (a *ToolAdapter) Parameters() map[string]interfaces.ParameterSpec { return a.tool.Parameters() }
func (a *ToolAdapter) Run(ctx context.Context, input string) (string, error) {
	return a.tool.Run(ctx, input)
}

func (a *ToolAdapter) Execute(ctx context.Context, args string) (string, error) {
	return a.tool.Run(ctx, args)
}

// NewSDKAgent creates a new SDK-based agent from tool runners.
func NewSDKAgentFromTools(tools []ToolRunner) (*SDKAgent, error) {
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("OPENROUTER_API_KEY not set")
	}

	model := getModelName()
	llmClient := openrouter.NewClient(apiKey, openrouter.WithModel(model))

	// Convert tools to SDK format
	sdkTools := make([]interfaces.Tool, len(tools))
	for i, t := range tools {
		sdkTools[i] = &ToolAdapter{tool: t}
	}

	ag, err := agent.NewAgent(
		agent.WithLLM(llmClient),
		agent.WithTools(sdkTools...),
	)
	if err != nil {
		return nil, err
	}

	return &SDKAgent{
		apiKey: apiKey,
		model:  model,
		tools:  sdkTools,
		llm:    llmClient,
		ag:     ag,
	}, nil
}

// GetLLM returns the underlying LLM client.
func (a *SDKAgent) GetLLM() interfaces.LLM {
	return a.llm
}

// GetTools returns the available tools.
func (a *SDKAgent) GetTools() []interfaces.Tool {
	return a.tools
}

// StreamEvent represents a streaming event for the UI.
type StreamEvent struct {
	Type     string
	Content  string
	Done     bool
	Error    error
	ToolName string
	ToolArgs string
}

// RunStream runs the agent with streaming and returns events.
func (a *SDKAgent) RunStream(ctx context.Context, input string) (<-chan StreamEvent, error) {
	if a.ag == nil {
		return nil, fmt.Errorf("agent not initialized")
	}

	ch := make(chan StreamEvent)

	go func() {
		defer close(ch)

		stream, err := a.ag.RunStream(ctx, input)
		if err != nil {
			ch <- StreamEvent{Type: "error", Error: err}
			return
		}

		for event := range stream {
			switch event.Type {
			case interfaces.AgentEventContent:
				ch <- StreamEvent{Type: "content", Content: event.Content}
			case interfaces.AgentEventToolCall:
				if event.ToolCall != nil {
					ch <- StreamEvent{
						Type:     "tool_call",
						ToolName: event.ToolCall.Name,
						ToolArgs: event.ToolCall.Arguments,
					}
				}
			case interfaces.AgentEventComplete:
				ch <- StreamEvent{Type: "done", Done: true}
			case interfaces.AgentEventError:
				ch <- StreamEvent{Type: "error", Error: event.Error}
			}
		}
	}()

	return ch, nil
}

// RunStreamWithMessages runs the agent with a conversation history.
func (a *SDKAgent) RunStreamWithMessages(ctx context.Context, messages []Message) (<-chan StreamEvent, error) {
	// Build conversation from messages
	var conv strings.Builder
	for i, msg := range messages {
		if i > 0 {
			conv.WriteString("\n")
		}
		conv.WriteString(fmt.Sprintf("%s: %s", msg.Role, msg.Content))
	}

	return a.RunStream(ctx, conv.String())
}

// parseModelName gets the model name from environment.
func getModelName() string {
	if v := os.Getenv("MODEL_NAME"); v != "" {
		return v
	}
	return "anthropic/claude-3.5-sonnet"
}

// MarshalMessages converts []Message to JSON.
func MarshalMessages(messages []Message) (string, error) {
	data, err := json.Marshal(messages)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// String returns a formatted string of messages.
func (m Message) String() string {
	return fmt.Sprintf("%s: %s", m.Role, m.Content)
}