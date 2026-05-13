package ui

import (
	"context"

	"github.com/Ingenimax/agent-sdk-go/pkg/interfaces"
	"aicommunity.omniq.my.id/cliagent/internal/agent"
	"aicommunity.omniq.my.id/cliagent/pkg/tools"
)

// sdkTool is the common interface for all executable tools from pkg/tools.
type sdkTool interface {
	Name() string
	Description() string
	Run(ctx context.Context, input string) (string, error)
	Execute(ctx context.Context, args string) (string, error)
	Parameters() map[string]interfaces.ParameterSpec
}

// ToolRunner is the interface that all executable tools implement (UI-level).
type ToolRunner interface {
	Name() string
	Description() string
	Run(ctx context.Context, input string) (string, error)
	Parameters() map[string]interfaces.ParameterSpec
}

// pendingTool represents a tool call extracted from an LLM response.
type pendingTool struct {
	name string
	args string
}

// sdktool wraps a sdkTool to satisfy ToolRunner.
type sdktool struct {
	inner sdkTool
}

func (s *sdktool) Name() string                                 { return s.inner.Name() }
func (s *sdktool) Description() string                          { return s.inner.Description() }
func (s *sdktool) Run(ctx context.Context, input string) (string, error) {
	return s.inner.Run(ctx, input)
}
func (s *sdktool) Parameters() map[string]interfaces.ParameterSpec { return s.inner.Parameters() }

// toolsList returns all available tools as ToolRunner instances.
func toolsList() []ToolRunner {
	return []ToolRunner{
		toolsEcho(),
		toolsTime(),
		toolsDate(),
		toolsRead(),
		toolsWrite(),
		toolsListTool(),
		toolsMkdir(),
		toolsShell(),
	}
}

func toolsEcho() ToolRunner      { return &sdktool{inner: tools.NewEchoTool()} }
func toolsTime() ToolRunner      { return &sdktool{inner: tools.NewTimeTool()} }
func toolsDate() ToolRunner      { return &sdktool{inner: tools.NewDateTool()} }
func toolsRead() ToolRunner      { return &sdktool{inner: tools.NewReadTool()} }
func toolsWrite() ToolRunner     { return &sdktool{inner: tools.NewWriteTool()} }
func toolsListTool() ToolRunner  { return &sdktool{inner: tools.NewListTool()} }
func toolsMkdir() ToolRunner     { return &sdktool{inner: tools.NewMkdirTool()} }
func toolsShell() ToolRunner     { return &sdktool{inner: tools.NewShellTool()} }

// findToolByName returns a ToolRunner matching the given name, or nil.
func findToolByName(name string) ToolRunner {
	for _, t := range toolsList() {
		if t.Name() == name {
			return t
		}
	}
	return nil
}

// findSDKToolByName returns an agent.ToolRunner matching the given name, or nil.
func findSDKToolByName(name string) agent.ToolRunner {
	for _, t := range getSDKTools() {
		if t.Name() == name {
			return t
		}
	}
	return nil
}

// getSDKTools returns all available tools as agent.ToolRunner instances for SDK integration.
func getSDKTools() []agent.ToolRunner {
	uiTools := toolsList()
	result := make([]agent.ToolRunner, len(uiTools))
	for i, t := range uiTools {
		result[i] = t
	}
	return result
}