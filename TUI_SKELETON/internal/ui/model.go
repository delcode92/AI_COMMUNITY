package ui

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/redis/go-redis/v9"
	"aicommunity.omniq.my.id/cliagent/internal/agent"
	"aicommunity.omniq.my.id/cliagent/internal/skill"
)

// ── Tea messages ─────────────────────────────────────────────────────────────

type streamTokenMsg string
type streamDoneMsg struct{}
type streamErrMsg struct{ err error }
type compressTokenMsg string
type compressDoneMsg struct{ summary string }

// ── Chat entry ───────────────────────────────────────────────────────────────

type chatEntry struct {
	role    string // "user" | "assistant"
	content string
}

// ── Tool config ─────────────────────────────────────────────────────────────

// ExecuteTool runs a whitelisted tool and returns its output.
func ExecuteTool(name string, args []string) (string, error) {
	whitelist := os.Getenv("TOOL_WHITELIST")
	if whitelist == "" {
		whitelist = "echo,time,date"
	}
	allowed := strings.Split(whitelist, ",")
	allowedSet := make(map[string]bool)
	for _, a := range allowed {
		allowedSet[strings.TrimSpace(a)] = true
	}

	if !allowedSet[name] {
		return "", fmt.Errorf("tool %q not in whitelist", name)
	}

	toolPath := fmt.Sprintf("tools/%s", name)
	cmd := exec.Command(toolPath, args...)
	cmd.Dir = "."
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), err
	}
	return string(output), nil
}

// ── Model ────────────────────────────────────────────────────────────────────

type Model struct {
	viewport     viewport.Model
	textarea     textarea.Model
	client       *agent.Client
	history      []agent.Message
	entries      []chatEntry
	streaming    bool
	streamBuf    *strings.Builder
	cancelStream context.CancelFunc
	streamCh     <-chan agent.StreamChunk
	err          string
	width        int
	height       int
	modelName    string
	skillMap     map[string]skill.Skill
	currentSkill *skill.Skill
	redisClient  *redis.Client
	sessionID    string
	compressBuf  *strings.Builder
	compressCh   <-chan agent.StreamChunk
}

func loadGlobalPrompt(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func loadOrCreateRedisClient() *redis.Client {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "localhost:6379"
	}
	opts, err := redis.ParseURL(fmt.Sprintf("redis://%s", redisURL))
	if err != nil {
		return redis.NewClient(&redis.Options{Addr: redisURL})
	}
	return redis.NewClient(opts)
}

func (m *Model) saveHistory() error {
	if m.redisClient == nil {
		return nil
	}
	ctx := context.Background()
	data, err := json.Marshal(m.history)
	if err != nil {
		return err
	}
	key := fmt.Sprintf("session:%s:history", m.sessionID)
	return m.redisClient.Set(ctx, key, data, 0).Err()
}

func (m *Model) loadHistory() ([]agent.Message, error) {
	if m.redisClient == nil {
		return nil, fmt.Errorf("redis client not initialized")
	}
	ctx := context.Background()
	key := fmt.Sprintf("session:%s:history", m.sessionID)
	data, err := m.redisClient.Get(ctx, key).Bytes()
	if err != nil {
		return nil, err
	}
	var history []agent.Message
	if err := json.Unmarshal(data, &history); err != nil {
		return nil, err
	}
	return history, nil
}

func New() Model {
	globalPrompt, err := loadGlobalPrompt(".system/system.md")
	if err != nil {
		fmt.Fprintf(os.Stderr, "warning: could not load global prompt: %v\n", err)
	}

	skillMap, _ := skill.LoadSkills("skills")
	redisClient := loadOrCreateRedisClient()
	sessionID := os.Getenv("SESSION_ID")
	if sessionID == "" {
		sessionID = "default"
	}

	var history []agent.Message
	if globalPrompt != "" {
		history = append(history, agent.Message{Role: "system", Content: globalPrompt})
	}

	var currentSkill *skill.Skill
	for _, s := range skillMap {
		currentSkill = &s
		break
	}

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

	m := Model{
		history:      history,
		viewport:     vp,
		textarea:     ta,
		client:       agent.NewClient(),
		modelName:    getModelName(),
		streamBuf:    &strings.Builder{},
		skillMap:     skillMap,
		currentSkill: currentSkill,
		redisClient:  redisClient,
		sessionID:    sessionID,
		compressBuf:  &strings.Builder{},
	}

	loadedHistory, err := m.loadHistory()
	if err == nil && len(loadedHistory) > 0 {
		m.history = loadedHistory
	}

	if m.currentSkill != nil {
		skillMsg := agent.Message{Role: "system", Content: m.currentSkill.SystemPrompt}
		found := false
		for _, msg := range m.history {
			if msg.Content == skillMsg.Content {
				found = true
				break
			}
		}
		if !found {
			m.history = append(m.history, skillMsg)
		}
	}

	return m
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

// startCompress sends history to LLM for summarization
func (m Model) startCompress() (Model, tea.Cmd) {
	var convText strings.Builder
	for _, msg := range m.history {
		if msg.Role != "system" {
			convText.WriteString(fmt.Sprintf("%s: %s\n", msg.Role, msg.Content))
		}
	}
	for _, e := range m.entries {
		convText.WriteString(fmt.Sprintf("%s: %s\n", e.role, e.content))
	}

	compressMsg := []agent.Message{
		{Role: "system", Content: "Summarize this conversation concisely, preserving key points and decisions. Format as bullet points:"},
		{Role: "user", Content: convText.String()},
	}

	ctx, cancel := context.WithCancel(context.Background())
	m.cancelStream = cancel
	ch := m.client.Send(ctx, compressMsg)
	m.streamCh = ch
	m.compressCh = ch
	return m, readCompressToken(ch)
}

func readCompressToken(ch <-chan agent.StreamChunk) tea.Cmd {
	return func() tea.Msg {
		token, ok := <-ch
		if !ok {
			return compressDoneMsg{}
		}
		if token.Err != nil {
			return compressDoneMsg{summary: fmt.Sprintf("Error: %v", token.Err)}
		}
		if token.Done {
			return compressDoneMsg{}
		}
		return compressTokenMsg(token.Content)
	}
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
			_ = m.saveHistory()
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

			if strings.HasPrefix(input, "/skill ") {
				skillName := strings.TrimSpace(strings.TrimPrefix(input, "/skill "))
				if s, ok := m.skillMap[skillName]; ok {
					m.currentSkill = &s
					newHistory := []agent.Message{}
					for _, msg := range m.history {
						if msg.Role == "system" && msg != m.history[0] {
							continue
						}
						newHistory = append(newHistory, msg)
					}
					newHistory = append(newHistory, agent.Message{Role: "system", Content: s.SystemPrompt})
					m.history = newHistory
					m.entries = append(m.entries, chatEntry{role: "assistant", content: fmt.Sprintf("Switched to skill **%s**", s.Name)})
				} else {
					m.err = fmt.Sprintf("Unknown skill: %s", skillName)
				}
				m.viewport.SetContent(m.renderMessages())
				m.viewport.GotoBottom()
				_ = m.saveHistory()
				return m, nil
			}

			if input == "/compress" {
				m.streaming = true
				m.compressBuf.Reset()
				m.viewport.SetContent(m.renderMessages())
				m.viewport.GotoBottom()
				var compressCmd tea.Cmd
				m, compressCmd = m.startCompress()
				cmds = append(cmds, compressCmd)
				return m, tea.Batch(cmds...)
			}

			if strings.HasPrefix(input, "/tool ") {
				var toolReq struct {
					Tool string   `json:"tool"`
					Args []string `json:"args"`
				}
				toolInput := strings.TrimPrefix(input, "/tool ")
				if err := json.Unmarshal([]byte(toolInput), &toolReq); err != nil {
					m.err = fmt.Sprintf("Invalid tool request: %v", err)
				} else {
					result, err := ExecuteTool(toolReq.Tool, toolReq.Args)
					if err != nil {
						m.err = fmt.Sprintf("Tool error: %v", err)
					} else {
						m.entries = append(m.entries, chatEntry{role: "assistant", content: fmt.Sprintf("Tool output:\n%s", result)})
					}
				}
				m.viewport.SetContent(m.renderMessages())
				m.viewport.GotoBottom()
				return m, nil
			}

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

	case compressTokenMsg:
		m.compressBuf.WriteString(string(msg))
		m.viewport.SetContent(m.renderMessages())
		cmds = append(cmds, readCompressToken(m.compressCh))

	case compressDoneMsg:
		m.streaming = false
		summary := m.compressBuf.String()
		if summary != "" {
			memoryFile := ".memory/memory.md"
			os.MkdirAll(".memory", 0755)
			timestamp := time.Now().Format("2006-01-02 15:04:05")
			content := fmt.Sprintf("\n## Summary %s\n\n%s\n", timestamp, summary)
			f, _ := os.OpenFile(memoryFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
			f.WriteString(content)
			f.Close()
			m.entries = append(m.entries, chatEntry{role: "assistant", content: fmt.Sprintf("Conversation compressed and saved to %s", memoryFile)})
		}
		m.viewport.SetContent(m.renderMessages())
		m.viewport.GotoBottom()

	case streamDoneMsg:
		m.streaming = false
		m.history = append(m.history, agent.Message{Role: "assistant", Content: m.streamBuf.String()})
		m.viewport.SetContent(m.renderMessages())
		m.viewport.GotoBottom()
		_ = m.saveHistory()

	case streamErrMsg:
		m.streaming = false
		m.err = msg.err.Error()
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
		inputH  = 5
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
			if m.streaming && i == len(m.entries)-1 && m.compressBuf != nil && m.compressBuf.Len() > 0 {
				content = m.compressBuf.String()
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

// Close closes the Redis client.
func (m *Model) Close() error {
	if m.redisClient != nil {
		return m.redisClient.Close()
	}
	return nil
}