package ui

import (
	"context"
	"fmt"
	"strings"

	"aicommunity.omniq.my.id/cliagent/internal/agent"
	tea "github.com/charmbracelet/bubbletea"
)

// wrapSDKStream converts SDK StreamEvent channel to StreamChunk channel.
// When the SDK emits a tool_call event, the tool is executed immediately
// and the result is included inline in the stream.
func wrapSDKStream(evCh <-chan agent.StreamEvent) <-chan agent.StreamChunk {
	ch := make(chan agent.StreamChunk)

	go func() {
		defer close(ch)

		for ev := range evCh {
			switch {
			case ev.Error != nil:
				ch <- agent.StreamChunk{Err: ev.Error}
			case ev.Done:
				ch <- agent.StreamChunk{Done: true}
			case ev.Type == "content":
				ch <- agent.StreamChunk{Content: ev.Content}
			case ev.Type == "tool_call":
				tool := findSDKToolByName(ev.ToolName)
				if tool == nil {
					ch <- agent.StreamChunk{Content: fmt.Sprintf("\n[Tool %s not found]\n", ev.ToolName)}
					continue
				}

				result, err := tool.Run(context.Background(), ev.ToolArgs)
				if err != nil {
					ch <- agent.StreamChunk{Content: fmt.Sprintf("\n[Tool %s error: %v]\n", ev.ToolName, err)}
				} else {
					ch <- agent.StreamChunk{Content: fmt.Sprintf("\n[%s result: %s]\n", ev.ToolName, strings.TrimSpace(result))}
				}
			}
		}
	}()

	return ch
}

// startSDKStream initiates streaming with the SDK agent.
func (m *Model) startSDKStream() tea.Cmd {
	var sb strings.Builder
	for _, msg := range m.history {
		sb.WriteString(fmt.Sprintf("%s: %s\n", msg.Role, msg.Content))
	}

	toolList := getSDKTools()
	sdkAgent, err := agent.NewSDKAgentFromTools(toolList)
	if err != nil {
		m.err = fmt.Sprintf("SDK init error: %v", err)
		m.updateView()
		return nil
	}
	m.sdkAgent = sdkAgent

	ctx, cancel := context.WithCancel(context.Background())
	m.cancelFn = cancel

	evCh, err := sdkAgent.RunStream(ctx, sb.String())
	if err != nil {
		m.err = fmt.Sprintf("SDK stream error: %v", err)
		m.updateView()
		return nil
	}

	ch := wrapSDKStream(evCh)
	m.streamCh = ch
	return readToken(ch)
}