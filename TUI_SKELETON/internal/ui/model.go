package ui

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"aicommunity.omniq.my.id/cliagent/internal/agent"
)

// ── Tea messages ─────────────────────────────────────────────────────────────

type streamTokenMsg string
type streamDoneMsg struct{}
type streamErrMsg struct{ err error }

// ── Chat entry ───────────────────────────────────────────────────────────────

type chatEntry struct {
	role    string // "user" | "assistant"
	content string
}

// ── Model ────────────────────────────────────────────────────────────────────

type Model struct {
	viewport     viewport.Model
	textarea     textarea.Model
	client       *agent.Client
	history      []agent.Message
	entries      []chatEntry
	streaming    bool
	streamBuf    strings.Builder
	cancelStream context.CancelFunc
	streamCh     <-chan agent.StreamChunk
	err          string
	width        int
	height       int
	modelName    string
}

func New() Model {
	ta := textarea.New()
	ta.Placeholder = "Type a message… (Enter sends · Alt+Enter newline · Ctrl+C quit)"
	ta.Focus()
	ta.CharLimit = 4000
	ta.SetWidth(80)
	ta.SetHeight(3)
	ta.ShowLineNumbers = false
	ta.KeyMap.InsertNewline.SetKeys("alt+enter")

	vp := viewport.New(80, 20)
	vp.SetContent("")

	return Model{
		viewport:  vp,
		textarea:  ta,
		client:    agent.NewClient(),
		modelName: getModelName(),
	}
}


func getModelName() string {
	if v := os.Getenv("MODEL_NAME"); v != "" {
		return v
	}
	return "anthropic/claude-3.5-sonnet"
}

func (m Model) Init() tea.Cmd {
	return textarea.Blink
}

// ── Update ───────────────────────────────────────────────────────────────────

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m = m.recalcLayout()

	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyCtrlC:
			if m.cancelStream != nil {
				m.cancelStream()
			}
			return m, tea.Quit

		case tea.KeyEnter:
			if m.streaming {
				break
			}
			input := strings.TrimSpace(m.textarea.Value())
			if input == "" {
				break
			}
			m.textarea.Reset()
			m.err = ""
			m.history = append(m.history, agent.Message{Role: "user", Content: input})
			m.entries = append(m.entries, chatEntry{role: "user", content: input})
			m.streaming = true
			m.streamBuf.Reset()
			m.viewport.SetContent(m.renderMessages())
			m.viewport.GotoBottom()
			var streamCmd tea.Cmd
			m, streamCmd = m.startStream()
			cmds = append(cmds, streamCmd)
		}

	case streamTokenMsg:
		m.streamBuf.WriteString(string(msg))
		current := m.streamBuf.String()
		if len(m.entries) > 0 && m.entries[len(m.entries)-1].role == "assistant" {
			m.entries[len(m.entries)-1].content = current
		} else {
			m.entries = append(m.entries, chatEntry{role: "assistant", content: current})
		}
		m.viewport.SetContent(m.renderMessages())
		m.viewport.GotoBottom()
		cmds = append(cmds, readToken(m.streamCh))

	case streamDoneMsg:
		m.streaming = false
		m.history = append(m.history, agent.Message{Role: "assistant", Content: m.streamBuf.String()})
		m.viewport.SetContent(m.renderMessages())
		m.viewport.GotoBottom()

	case streamErrMsg:
		m.streaming = false
		m.err = msg.err.Error()
		// drop partial assistant entry
		if len(m.entries) > 0 && m.entries[len(m.entries)-1].role == "assistant" {
			m.entries = m.entries[:len(m.entries)-1]
		}
		m.viewport.SetContent(m.renderMessages())
		m.viewport.GotoBottom()
	}

	var taCmd, vpCmd tea.Cmd
	m.textarea, taCmd = m.textarea.Update(msg)
	m.viewport, vpCmd = m.viewport.Update(msg)
	cmds = append(cmds, taCmd, vpCmd)

	return m, tea.Batch(cmds...)
}

func (m Model) startStream() (Model, tea.Cmd) {
	ctx, cancel := context.WithCancel(context.Background())
	m.cancelStream = cancel
	ch := m.client.Send(ctx, m.history)
	m.streamCh = ch
	return m, readToken(ch)
}

func readToken(ch <-chan agent.StreamChunk) tea.Cmd {
	return func() tea.Msg {
		token, ok := <-ch
		if !ok {
			return streamDoneMsg{}
		}
		if token.Err != nil {
			return streamErrMsg{err: token.Err}
		}
		if token.Done {
			return streamDoneMsg{}
		}
		return streamTokenMsg(token.Content)
	}
}

// ── Layout ───────────────────────────────────────────────────────────────────

func (m Model) recalcLayout() Model {
	const (
		statusH = 1
		inputH  = 5 // rounded border(2) + textarea(3)
		divH    = 1
	)
	vpH := m.height - statusH - inputH - divH
	if vpH < 1 {
		vpH = 1
	}
	m.viewport.Width = m.width
	m.viewport.Height = vpH
	m.textarea.SetWidth(m.width - 4)
	m.viewport.SetContent(m.renderMessages())
	return m
}

// ── View ─────────────────────────────────────────────────────────────────────

func (m Model) View() string {
	if m.width == 0 {
		return "Loading…"
	}

	divider := DividerStyle.Render(strings.Repeat("─", m.width))

	border := InputBorderStyle
	if !m.streaming {
		border = InputFocusedBorderStyle
	}
	inputBox := border.Width(m.width - 2).Render(m.textarea.View())

	return lipgloss.JoinVertical(lipgloss.Left,
		m.viewport.View(),
		divider,
		inputBox,
		m.renderStatusBar(),
	)
}

func (m Model) renderStatusBar() string {
	left := StatusKeyStyle.Render(" ◆ ") + StatusModelStyle.Render(m.modelName)

	var mid string
	switch {
	case m.streaming:
		mid = WaitingStyle.Render("   generating…")
	case m.err != "":
		mid = ErrorStyle.Render("   ✗ " + m.err)
	default:
		mid = SubtleStyle.Render("   ready")
	}

	right := SubtleStyle.Render("  ctrl+c quit · alt+enter newline ")

	used := lipgloss.Width(left) + lipgloss.Width(mid) + lipgloss.Width(right)
	pad := m.width - used
	if pad < 0 {
		pad = 0
	}

	bar := lipgloss.JoinHorizontal(lipgloss.Top,
		left, mid, strings.Repeat(" ", pad), right,
	)
	return StatusBarStyle.Width(m.width).Render(bar)
}

func (m Model) renderMessages() string {
	if len(m.entries) == 0 {
		return SubtleStyle.PaddingLeft(2).Render("\n  Start a conversation…\n")
	}

	w := m.width - 4
	if w < 20 {
		w = 20
	}

	var sb strings.Builder
	for i, e := range m.entries {
		if i > 0 {
			sb.WriteString("\n")
		}
		switch e.role {
		case "user":
			sb.WriteString(UserLabelStyle.PaddingLeft(2).Render("you"))
			sb.WriteString("\n")
			sb.WriteString(MessageStyle.PaddingLeft(4).Width(w).Render(e.content))
		case "assistant":
			content := e.content
			if m.streaming && i == len(m.entries)-1 {
				content += WaitingStyle.Render("▌")
			}
			sb.WriteString(AssistantLabelStyle.PaddingLeft(2).Render("assistant"))
			sb.WriteString("\n")
			sb.WriteString(MessageStyle.PaddingLeft(4).Width(w).Render(content))
		}
		sb.WriteString("\n")
	}

	if m.err != "" {
		sb.WriteString(fmt.Sprintf("\n%s\n", ErrorStyle.PaddingLeft(4).Render("✗ "+m.err)))
	}

	return sb.String()
}
