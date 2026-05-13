package ui

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"

	"aicommunity.omniq.my.id/cliagent/internal/agent"
	"aicommunity.omniq.my.id/cliagent/internal/skill"
	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/redis/go-redis/v9"
)

// ── Messages ────────────────────────────────────────────────────────────────

type streamTokenMsg string
type streamDoneMsg struct{}
type streamErrMsg struct{ err error }
type compressTokenMsg string
type compressDoneMsg struct{}

// DebugMsg is a message for in-app debug output.
type DebugMsg struct{ Msg string }

// ── Chat entry ──────────────────────────────────────────────────────────────

type chatEntry struct {
	role    string
	content string
}

// ── reAct & Workflow types ──────────────────────────────────────────────────

type ReactState struct {
	NeedsClarification bool     `json:"needs_clarification"`
	MissingContext     []string `json:"missing_context"`
	Question           string   `json:"question"`
	Timestamp          string   `json:"timestamp"`
}

type todoItem struct {
	Action  string
	ToolCmd string
}

// ── Model ───────────────────────────────────────────────────────────────────

type Model struct {
	viewport   viewport.Model
	textarea   textarea.Model
	client     *agent.Client
	sdkAgent   *agent.SDKAgent
	history    []agent.Message
	entries    []chatEntry
	streaming  bool
	streamBuf  *strings.Builder
	cancelFn   context.CancelFunc
	streamCh   <-chan agent.StreamChunk
	err        string

	// State machine: "", "workflow", "tool_confirm", "clarify"
	mode         string
	pendingTodos []todoItem
	stepIndex    int
	awaitYes     bool
	pendingTool  ToolRunner
	pendingArgs  string

	skillMap     map[string]skill.Skill
	currentSkill *skill.Skill
	redisClient  *redis.Client
	sessionID    string
	modelName    string
	useSDK       bool

	compressBuf *strings.Builder
	compressCh  <-chan agent.StreamChunk

	showCmds  bool
	cmdInput  string
	cmdSelect int

	debugLines []string
	width      int
	height     int
}

// ── Init ────────────────────────────────────────────────────────────────────

func New() Model {
	globalPrompt, _ := loadFile(".system/system.md")
	skillMap, _ := skill.LoadSkills("skills")

	var currentSkill *skill.Skill
	for _, s := range skillMap {
		currentSkill = &s
		break
	}

	redisClient := newRedisClient()
	sessionID := envOr("SESSION_ID", "default")

	var history []agent.Message
	if globalPrompt != "" {
		history = append(history, agent.Message{Role: "system", Content: globalPrompt})
	}
	if currentSkill != nil {
		history = append(history, agent.Message{Role: "system", Content: currentSkill.SystemPrompt})
	}

	if redisClient != nil {
		if saved, err := loadHistory(redisClient, sessionID); err == nil && len(saved) > 0 {
			history = saved
		}
	}

	useSDK := strings.ToLower(envOr("USE_SDK", "")) == "true"
	var sdkAgent *agent.SDKAgent
	if useSDK {
		var err error
		sdkAgent, err = agent.NewSDKAgentFromTools(getSDKTools())
		if err != nil {
			fmt.Fprintf(os.Stderr, "SDK init error: %v\n", err)
			useSDK = false
		}
	}

	ta := textarea.New()
	ta.Placeholder = "Type a message… (Enter sends · Alt+Enter newline · / for commands · Ctrl+C quit)"
	ta.Focus()
	ta.CharLimit = 4000
	ta.SetWidth(80)
	ta.SetHeight(3)
	ta.ShowLineNumbers = false
	ta.KeyMap.InsertNewline.SetKeys("alt+enter")

	vp := viewport.New(80, 20)
	vp.SetContent("")

	return Model{
		viewport:     vp,
		textarea:     ta,
		client:       agent.NewClient(),
		sdkAgent:     sdkAgent,
		history:      history,
		modelName:    envOr("MODEL_NAME", "anthropic/claude-3.5-sonnet"),
		streamBuf:    &strings.Builder{},
		skillMap:     skillMap,
		currentSkill: currentSkill,
		redisClient:  redisClient,
		sessionID:    sessionID,
		compressBuf:  &strings.Builder{},
		useSDK:       useSDK,
		debugLines:   make([]string, 0, 5),
	}
}

func (m Model) Init() tea.Cmd { return textarea.Blink }

// ── Update ──────────────────────────────────────────────────────────────────

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.recalcLayout()
		m.viewport.GotoBottom()

	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyCtrlC:
			if m.cancelFn != nil {
				m.cancelFn()
			}
			_ = m.saveHistory()
			return m, tea.Quit

		case tea.KeyRunes:
			if len(msg.Runes) > 0 && msg.Runes[0] == 'd' {
				m.addDebug("debug keypress")
			}

		case tea.KeyUp:
			if m.showCmds {
				matches := filterCommands(m.cmdInput)
				if len(matches) > 0 {
					m.cmdSelect = (m.cmdSelect - 1 + len(matches)) % len(matches)
					m.textarea.SetValue(matches[m.cmdSelect])
				}
			}
			return m, nil

		case tea.KeyDown:
			if m.showCmds {
				matches := filterCommands(m.cmdInput)
				if len(matches) > 0 {
					m.cmdSelect = (m.cmdSelect + 1) % len(matches)
					m.textarea.SetValue(matches[m.cmdSelect])
				}
			}
			return m, nil

		case tea.KeyTab:
			val := m.textarea.Value()
			if strings.HasPrefix(val, "/") && !strings.Contains(val, " ") {
				matches := filterCommands(val)
				if len(matches) == 1 {
					m.textarea.SetValue(matches[0] + " ")
					m.showCmds = false
				} else if len(matches) > 1 {
					m.showCmds = true
					m.cmdInput = val
					m.cmdSelect = 0
				}
			}
			return m, nil

		case tea.KeyEnter:
			if m.streaming {
				break
			}

			input := strings.TrimSpace(m.textarea.Value())
			if input == "" {
				break
			}

			if m.mode == "clarify" {
				return m.handleClarifyInput(input)
			}
			if m.mode == "workflow" {
				return m.handleWorkflowConfirm(input)
			}
			if m.mode == "tool_confirm" {
				return m.handleToolConfirm(input)
			}

			m.textarea.Reset()
			m.err = ""
			m.showCmds = false

			switch {
			case input == "/":
				m.entries = append(m.entries, chatEntry{role: "assistant", content: getAvailableCommands()})
				m.viewport.SetContent(m.renderMessages())
				m.viewport.GotoBottom()
				return m, nil

			case strings.HasPrefix(input, "/skill "):
				m.applySkillSwitch(input)
				m.viewport.SetContent(m.renderMessages())
				m.viewport.GotoBottom()
				_ = m.saveHistory()
				return m, nil

			case input == "/compress":
				return m.startCompress()

			case strings.HasPrefix(input, "/tool "):
				m.applyManualTool(input)
				m.viewport.SetContent(m.renderMessages())
				m.viewport.GotoBottom()
				return m, nil

			default:
				m.history = append(m.history, agent.Message{Role: "user", Content: input})
				m.entries = append(m.entries, chatEntry{role: "user", content: input})
				m.streaming = true
				m.streamBuf.Reset()
				m.viewport.SetContent(m.renderMessages())
				m.viewport.GotoBottom()
				return m, m.startStream()
			}
		}
	}

	// Stream processing
	switch msg := msg.(type) {
	case streamTokenMsg:
		m.streamBuf.WriteString(string(msg))
		m.updateAssistantEntry(string(msg))
		m.viewport.SetContent(m.renderMessages())
		return m, readToken(m.streamCh)

	case compressTokenMsg:
		m.compressBuf.WriteString(string(msg))
		m.viewport.SetContent(m.renderMessages())
		return m, readCompressToken(m.compressCh)

	case compressDoneMsg:
		m.streaming = false
		m.saveCompressResult()

	case streamDoneMsg:
		m.streaming = false
		m.onStreamDone(m.streamBuf.String())

	case streamErrMsg:
		m.streaming = false
		m.onStreamError(msg.err)

	case DebugMsg:
		m.addDebug(msg.Msg)
	}

	var taCmd, vpCmd tea.Cmd
	m.textarea, taCmd = m.textarea.Update(msg)
	m.viewport, vpCmd = m.viewport.Update(msg)
	cmds = append(cmds, taCmd, vpCmd)

	taVal := m.textarea.Value()
	if strings.HasPrefix(taVal, "/") && !strings.Contains(taVal, " ") {
		m.showCmds = true
		m.cmdInput = taVal
	} else {
		m.showCmds = false
	}

	return m, tea.Batch(cmds...)
}

// ── Handler methods ─────────────────────────────────────────────────────────

func (m Model) handleClarifyInput(input string) (tea.Model, tea.Cmd) {
	m.mode = ""
	m.clearReactState()
	m.history = append(m.history, agent.Message{Role: "user", Content: input})
	m.streaming = true
	m.streamBuf.Reset()
	m.viewport.SetContent(m.renderMessages())
	m.viewport.GotoBottom()
	return m, m.startStream()
}

func (m Model) handleWorkflowConfirm(input string) (tea.Model, tea.Cmd) {
	lower := strings.ToLower(input)
	if lower == "y" || lower == "yes" || input == "" {
		m.mode = ""
		return m, m.runNextStep()
	}
	m.mode = ""
	m.pendingTodos = nil
	m.entries = append(m.entries, chatEntry{role: "assistant", content: "Workflow cancelled."})
	m.viewport.SetContent(m.renderMessages())
	m.viewport.GotoBottom()
	return m, nil
}

func (m *Model) handleToolConfirm(input string) (tea.Model, tea.Cmd) {
	lower := strings.ToLower(input)
	if lower == "y" || lower == "yes" || input == "" {
		m.mode = ""
		if m.pendingTool == nil {
			return m, nil
		}
		output, err := m.pendingTool.Run(context.Background(), m.pendingArgs)
		if err != nil {
			m.entries = append(m.entries, chatEntry{role: "assistant", content: fmt.Sprintf("Tool %s error: %v", m.pendingTool.Name(), err)})
		} else {
			msg := fmt.Sprintf("Executed %s(%s) → %s", m.pendingTool.Name(), m.pendingArgs, strings.TrimSpace(output))
			m.entries = append(m.entries, chatEntry{role: "assistant", content: msg})
			m.history = append(m.history, agent.Message{Role: "user", Content: fmt.Sprintf("Tool %s output: %s", m.pendingTool.Name(), strings.TrimSpace(output))})
		}
		m.pendingTool = nil
		m.pendingArgs = ""
		m.updateViewSave()
		_ = m.saveHistory()
		// If in workflow, continue to next step
		if len(m.pendingTodos) > 0 {
			return m, m.runNextStep()
		}
		// Standalone tool: re-trigger LLM
		m.streaming = true
		m.streamBuf.Reset()
		return m, m.startStream()
	}
	if lower == "n" || lower == "no" {
		m.mode = ""
		m.pendingTool = nil
		m.pendingTodos = nil
		m.entries = append(m.entries, chatEntry{role: "assistant", content: "Cancelled."})
		m.updateView()
		return m, nil
	}
	return m, nil
}

func (m *Model) applySkillSwitch(input string) {
	skillName := strings.TrimSpace(strings.TrimPrefix(input, "/skill "))
	if s, ok := m.skillMap[skillName]; ok {
		m.currentSkill = &s
		filtered := []agent.Message{}
		for _, msg := range m.history {
			if msg.Role == "system" {
				if len(filtered) == 0 {
					filtered = append(filtered, msg) // keep global prompt
				}
			} else {
				filtered = append(filtered, msg)
			}
		}
		filtered = append(filtered, agent.Message{Role: "system", Content: s.SystemPrompt})
		m.history = filtered
		m.entries = append(m.entries, chatEntry{role: "assistant", content: fmt.Sprintf("Switched to skill **%s**", s.Name)})
	} else {
		m.err = fmt.Sprintf("Unknown skill: %s", skillName)
	}
}

func (m Model) startCompress() (tea.Model, tea.Cmd) {
	m.streaming = true
	m.compressBuf.Reset()
	var sb strings.Builder
	for _, msg := range m.history {
		if msg.Role != "system" {
			sb.WriteString(fmt.Sprintf("%s: %s\n", msg.Role, msg.Content))
		}
	}
	for _, e := range m.entries {
		sb.WriteString(fmt.Sprintf("%s: %s\n", e.role, e.content))
	}
	ctx, cancel := context.WithCancel(context.Background())
	m.cancelFn = cancel
	compressMsgs := []agent.Message{
		{Role: "system", Content: "Summarize this conversation concisely. Format as bullet points:"},
		{Role: "user", Content: sb.String()},
	}
	ch := m.send(ctx, compressMsgs)
	m.streamCh = ch
	m.compressCh = ch
	return m, readCompressToken(ch)
}

func (m *Model) applyManualTool(input string) {
	var req struct {
		Tool string   `json:"tool"`
		Args []string `json:"args"`
	}
	if err := json.Unmarshal([]byte(strings.TrimPrefix(input, "/tool ")), &req); err != nil {
		m.err = fmt.Sprintf("Invalid tool: %v", err)
		return
	}
	m.pendingTool = findToolByName(req.Tool)
	m.pendingArgs = strings.Join(req.Args, " ")
	if m.pendingTool == nil {
		m.err = fmt.Sprintf("Unknown tool: %s", req.Tool)
		return
	}
	m.mode = "tool_confirm"
	m.awaitYes = true
	m.entries = append(m.entries, chatEntry{role: "assistant", content: fmt.Sprintf("Execute tool %s with args %s? (y/n)", m.pendingTool.Name(), m.pendingArgs)})
}

// readToken returns a command that reads stream tokens from the channel.
func readToken(ch <-chan agent.StreamChunk) tea.Cmd {
	return func() tea.Msg {
		if msg, ok := <-ch; ok {
			if msg.Done {
				return streamDoneMsg{}
			}
			if msg.Err != nil {
				return streamErrMsg{err: msg.Err}
			}
			return streamTokenMsg(msg.Content)
		}
		return streamDoneMsg{}
	}
}

// readCompressToken returns a command that reads compression tokens.
func readCompressToken(ch <-chan agent.StreamChunk) tea.Cmd {
	return func() tea.Msg {
		if msg, ok := <-ch; ok {
			if msg.Done {
				return compressDoneMsg{}
			}
			if msg.Err != nil {
				return streamErrMsg{err: msg.Err}
			}
			return compressTokenMsg(msg.Content)
		}
		return compressDoneMsg{}
	}
}

// updateAssistantEntry appends streaming tokens to the last assistant entry.
func (m *Model) updateAssistantEntry(token string) {
	if len(m.entries) > 0 && m.entries[len(m.entries)-1].role == "assistant" {
		m.entries[len(m.entries)-1].content += token
	} else {
		m.entries = append(m.entries, chatEntry{role: "assistant", content: token})
	}
}

// ── Stream completion handler ───────────────────────────────────────────────

func (m *Model) onStreamDone(response string) {
	defer func() {
		m.history = append(m.history, agent.Message{Role: "assistant", Content: response})
		_ = m.saveHistory()
	}()

	// 1. Check for clarification
	if needs, question, ctx := parseClarification(response); needs {
		m.mode = "clarify"
		_ = m.saveReactState(ReactState{
			NeedsClarification: true,
			MissingContext:     ctx,
			Question:           question,
			Timestamp:          time.Now().Format(time.RFC3339),
		})
		m.persistReactLog(question, ctx)
		m.entries = append(m.entries, chatEntry{role: "assistant", content: question})
		m.updateView()
		return
	}
	_ = m.clearReactState()

	// 2. Check for workflow (multi-step plan with at least one tool call)
	//    parseWorkflow is strict: requires 2+ steps AND at least one tool.
	//    Casual numbered lists return nil and fall through.
	if todos := parseWorkflow(response); len(todos) > 0 {
		m.mode = "workflow"
		m.pendingTodos = todos
		m.stepIndex = 0
		m.entries = append(m.entries, chatEntry{role: "assistant", content: formatTodoList(todos)})
		m.updateView()
		return
	}

	// 3. Check for explicit standalone tool commands (not part of a workflow)
	if tools := extractToolCommands(response); len(tools) > 0 {
		m.pendingTodos = nil
		m.applyManualTool(fmt.Sprintf(`/tool {"tool":"%s","args":[%s]}`, tools[0].name, formatArgsForJSON(tools[0].args)))
		m.updateView()
		return
	}
}

func formatArgsForJSON(args string) string {
	parts := strings.Fields(args)
	quoted := make([]string, len(parts))
	for i, p := range parts {
		quoted[i] = fmt.Sprintf(`"%s"`, p)
	}
	return strings.Join(quoted, ",")
}

// ── Workflow execution ──────────────────────────────────────────────────────

func (m *Model) runNextStep() tea.Cmd {
	if m.pendingTodos == nil || m.stepIndex >= len(m.pendingTodos) {
		m.mode = ""
		m.pendingTodos = nil
		m.entries = append(m.entries, chatEntry{role: "assistant", content: "Workflow completed!"})
		m.addDebug("workflow done")
		m.updateView()
		_ = m.appendWorkflowToMemory()
		return nil
	}

	todo := m.pendingTodos[m.stepIndex]
	m.addDebug(fmt.Sprintf("step %d: %s", m.stepIndex, todo.Action))
	m.history = append(m.history, agent.Message{Role: "user", Content: fmt.Sprintf("Executing: %s", todo.Action)})
	m.entries = append(m.entries, chatEntry{role: "user", content: fmt.Sprintf("Executing: %s", todo.Action)})

	if todo.ToolCmd != "" {
		var req struct {
			Tool string   `json:"tool"`
			Args []string `json:"args"`
		}
		if err := json.Unmarshal([]byte(todo.ToolCmd), &req); err == nil {
			m.mode = "tool_confirm"
			m.pendingTool = findToolByName(req.Tool)
			m.pendingArgs = strings.Join(req.Args, " ")
			if m.pendingTool != nil {
				m.entries = append(m.entries, chatEntry{role: "assistant", content: fmt.Sprintf("Execute tool %s with args %s? (y/n)", req.Tool, m.pendingArgs)})
				m.updateView()
				return nil
			}
		}
	}

	m.stepIndex++
	if cmd := m.runNextStep(); cmd != nil {
		return cmd
	}
	return nil
}

// ── Streaming ───────────────────────────────────────────────────────────────

func (m *Model) startStream() tea.Cmd {
	ctx, cancel := context.WithCancel(context.Background())
	m.cancelFn = cancel
	ch := m.send(ctx, m.history)
	m.streamCh = ch
	return readToken(ch)
}

func (m *Model) send(ctx context.Context, messages []agent.Message) <-chan agent.StreamChunk {
	if m.useSDK && m.sdkAgent != nil {
		var sb strings.Builder
		for _, msg := range messages {
			sb.WriteString(fmt.Sprintf("%s: %s\n", msg.Role, msg.Content))
		}
		stream, err := m.sdkAgent.RunStream(ctx, sb.String())
		if err != nil {
			ch := make(chan agent.StreamChunk)
			close(ch)
			return ch
		}
		return wrapSDKStream(stream)
	}
	return m.client.Send(ctx, messages)
}

// ── View ────────────────────────────────────────────────────────────────────

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

	if m.showCmds {
		matches := filterCommands(m.cmdInput)
		if len(matches) > 0 {
			var comp strings.Builder
			comp.WriteString(SubtleStyle.PaddingLeft(2).Render("Commands:"))
			for i, match := range matches {
				comp.WriteString("\n")
				if i == m.cmdSelect {
					comp.WriteString(HighlightStyle.PaddingLeft(4).Render("▶ " + match))
				} else {
					comp.WriteString(SubtleStyle.PaddingLeft(4).Render(match))
				}
			}
			inputBox = lipgloss.JoinVertical(lipgloss.Left, inputBox, comp.String())
		}
	}

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
	if len(m.debugLines) > 0 {
		right = SubtleStyle.Render("  [" + strings.Join(m.debugLines, " | ") + "]  ctrl+c quit · alt+enter newline ")
	}
	used := lipgloss.Width(left) + lipgloss.Width(mid) + lipgloss.Width(right)
	pad := m.width - used
	if pad < 0 {
		pad = 0
	}
	bar := lipgloss.JoinHorizontal(lipgloss.Top, left, mid, strings.Repeat(" ", pad), right)
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
			if m.streaming && m.compressBuf.Len() > 0 {
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

func (m *Model) updateView() {
	m.viewport.SetContent(m.renderMessages())
	m.viewport.GotoBottom()
}

func (m *Model) updateViewSave() {
	m.updateView()
	_ = m.saveHistory()
}

func (m *Model) recalcLayout() {
	const statusH, inputH, divH = 1, 5, 1
	vpH := m.height - statusH - inputH - divH
	if vpH < 1 {
		vpH = 1
	}
	m.viewport.Width = m.width
	m.viewport.Height = vpH
	m.textarea.SetWidth(m.width - 4)
	m.viewport.SetContent(m.renderMessages())
}

func (m *Model) addDebug(msg string) {
	m.debugLines = append(m.debugLines, msg)
	if len(m.debugLines) > 5 {
		m.debugLines = m.debugLines[len(m.debugLines)-5:]
	}
}

// ── Persistence ─────────────────────────────────────────────────────────────

func (m *Model) saveHistory() error {
	if m.redisClient == nil {
		return nil
	}
	ctx := context.Background()
	data, err := json.Marshal(m.history)
	if err != nil {
		return err
	}
	return m.redisClient.Set(ctx, fmt.Sprintf("session:%s:history", m.sessionID), data, 0).Err()
}

func loadHistory(client *redis.Client, sessionID string) ([]agent.Message, error) {
	ctx := context.Background()
	data, err := client.Get(ctx, fmt.Sprintf("session:%s:history", sessionID)).Bytes()
	if err != nil {
		return nil, err
	}
	var history []agent.Message
	return history, json.Unmarshal(data, &history)
}

func (m *Model) saveReactState(state ReactState) error {
	if m.redisClient == nil {
		return nil
	}
	ctx := context.Background()
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}
	return m.redisClient.Set(ctx, fmt.Sprintf("session:%s:react_state", m.sessionID), data, 0).Err()
}

func (m *Model) clearReactState() error {
	if m.redisClient == nil {
		return nil
	}
	ctx := context.Background()
	return m.redisClient.Del(ctx, fmt.Sprintf("session:%s:react_state", m.sessionID)).Err()
}

func (m *Model) persistReactLog(question string, ctx []string) {
	os.MkdirAll(".memory/react_logs", 0755)
	f, err := os.OpenFile(fmt.Sprintf(".memory/react_logs/%s.log", m.sessionID), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()
	data, _ := json.MarshalIndent(map[string]interface{}{
		"question":        question,
		"missing_context": ctx,
		"timestamp":       time.Now().Format(time.RFC3339),
	}, "", "  ")
	f.WriteString(string(data) + "\n")
}

func (m *Model) appendWorkflowToMemory() error {
	if m.pendingTodos == nil {
		return nil
	}
	os.MkdirAll(".memory", 0755)
	f, err := os.OpenFile(".memory/memory.md", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	fmt.Fprintf(f, "\n## Workflow %s\n\n", time.Now().Format("2006-01-02 15:04:05"))
	for i, t := range m.pendingTodos[:m.stepIndex] {
		fmt.Fprintf(f, "• Step %d: %s\n", i+1, t.Action)
		if t.ToolCmd != "" {
			fmt.Fprintln(f, t.ToolCmd)
		}
	}
	return nil
}

func (m *Model) saveCompressResult() {
	if m.compressBuf.Len() == 0 {
		return
	}
	os.MkdirAll(".memory", 0755)
	f, err := os.OpenFile(".memory/memory.md", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		m.err = "Failed to save compression"
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "\n## Summary %s\n\n%s\n", time.Now().Format("2006-01-02 15:04:05"), m.compressBuf.String())
	m.entries = append(m.entries, chatEntry{role: "assistant", content: "Compressed and saved to .memory/memory.md"})
}

func (m *Model) onStreamError(err error) {
	if strings.Contains(err.Error(), "streaming") {
		m.useSDK = false
		return
	}
	m.err = err.Error()
	if len(m.entries) > 0 && m.entries[len(m.entries)-1].role == "assistant" {
		m.entries = m.entries[:len(m.entries)-1]
	}
}

func (m *Model) Close() error {
	if m.redisClient != nil {
		return m.redisClient.Close()
	}
	return nil
}

// ── reAct / Clarification detection ─────────────────────────────────────────

func parseClarification(response string) (bool, string, []string) {
	lower := strings.ToLower(response)
	markers := []string{
		"could you clarify", "please specify", "what type", "which data",
		"more information", "i need to know", "before i can", "to proceed",
		"could you tell me", "please provide", "i would need",
	}
	for _, marker := range markers {
		if strings.Contains(lower, marker) {
			return true, response, extractMissingContext(response)
		}
	}
	return false, "", nil
}

func extractMissingContext(response string) []string {
	var missing []string
	for _, line := range strings.Split(response, "\n") {
		t := strings.TrimSpace(line)
		if strings.HasPrefix(t, "-") || strings.HasPrefix(t, "•") || strings.HasPrefix(t, "*") {
			item := strings.TrimSpace(strings.TrimPrefix(t, "-"))
			item = strings.TrimSpace(strings.TrimPrefix(item, "•"))
			item = strings.TrimSpace(strings.TrimPrefix(item, "*"))
			lower := strings.ToLower(item)
			if item != "" && !strings.Contains(lower, "could you") && !strings.Contains(lower, "please") {
				missing = append(missing, item)
			}
		}
	}
	return missing
}

// ── Workflow parsing ────────────────────────────────────────────────────────

// parseWorkflow extracts a todo list from LLM output.
// Only returns a workflow when there are 2+ steps AND at least one step
// involves a tool call. Casual numbered lists are ignored so the agent
// answers directly instead of prompting for workflow confirmation.
func parseWorkflow(input string) []todoItem {
	var todos []todoItem
	lines := strings.Split(input, "\n")
	for i := 0; i < len(lines); i++ {
		line := strings.TrimSpace(lines[i])
		action := extractStepAction(line)
		if action == "" {
			continue
		}
		toolCmd := ""
		if i+1 < len(lines) && isToolLine(strings.TrimSpace(lines[i+1])) {
			toolCmd = strings.TrimSpace(lines[i+1])
			i++
		}
		todos = append(todos, todoItem{Action: action, ToolCmd: toolCmd})
	}
	if len(todos) < 2 {
		return nil
	}
	hasTool := false
	for _, t := range todos {
		if t.ToolCmd != "" {
			hasTool = true
			break
		}
	}
	if !hasTool {
		return nil
	}
	return todos
}

// extractStepAction detects step lines by common patterns and extracts the action.
func extractStepAction(line string) string {
	// Match "Step N:" or "N." prefixes
	lower := strings.ToLower(line)
	for _, prefix := range []string{"step ", ""} {
		for n := 1; n <= 20; n++ {
			p := fmt.Sprintf("step %d:", n)
			if strings.HasPrefix(lower, p) {
				action := strings.TrimSpace(strings.TrimPrefix(line, fmt.Sprintf("Step %d:", n)))
				if action == "" {
					return line
				}
				return action
			}
			alt := fmt.Sprintf("%d.", n)
			if strings.HasPrefix(line, alt) {
				action := strings.TrimSpace(strings.TrimPrefix(line, alt))
				if action == "" {
					return line
				}
				return action
			}
		}
		_ = prefix // avoid unused var
		break
	}
	// Also try direct "Step N:" case-insensitive
	stepIdx := strings.ToLower(line)
	if idx := strings.Index(stepIdx, "step "); idx >= 0 {
		rest := line[idx+5:]
		for n := 1; n <= 20; n++ {
			num := fmt.Sprintf("%d:", n)
			if strings.HasPrefix(rest, num) {
				action := strings.TrimSpace(rest[len(num):])
				if action == "" {
					return line
				}
				return action
			}
		}
	}
	if strings.HasPrefix(line, "- ") || strings.HasPrefix(line, "* ") || strings.HasPrefix(line, "• ") {
		return strings.TrimSpace(line[2:])
	}
	return ""
}

func isToolLine(line string) bool {
	return strings.HasPrefix(line, "/tool") || strings.Contains(line, `{"tool":`)
}

func formatTodoList(todos []todoItem) string {
	var sb strings.Builder
	sb.WriteString("**Proposed Workflow:**\n\n")
	for i, t := range todos {
		sb.WriteString(fmt.Sprintf("• Step %d: %s\n", i+1, t.Action))
		if t.ToolCmd != "" {
			sb.WriteString(t.ToolCmd + "\n")
		}
	}
	sb.WriteString("\nProceed? (y/Enter=yes, n=no)")
	return sb.String()
}

// ── Tool command extraction ─────────────────────────────────────────────────

func extractToolCommands(response string) []pendingTool {
	var tools []pendingTool
	seen := make(map[string]bool)

	toolPattern := regexp.MustCompile(`(?i)/tool\s*(\{[^}]*"tool"[^}]*\})`)
	for _, match := range toolPattern.FindAllStringSubmatch(response, -1) {
		if len(match) > 1 && !seen[match[1]] {
			seen[match[1]] = true
			if pt := parseToolJSON(match[1]); pt.name != "" {
				tools = append(tools, pt)
			}
		}
	}

	jsonPattern := regexp.MustCompile(`\{[^{}]*"tool"\s*:\s*"[^"]+"[^{}]*"args"\s*:\s*\[[^\]]*\][^{}]*\}`)
	for _, match := range jsonPattern.FindAllString(response, -1) {
		if !seen[match] {
			seen[match] = true
			if pt := parseToolJSON(match); pt.name != "" {
				tools = append(tools, pt)
			}
		}
	}

	codeBlockPattern := regexp.MustCompile(`(?:>>>|\s*>\s*<?)tool\s*(\{[^}]+\})`)
	for _, match := range codeBlockPattern.FindAllStringSubmatch(response, -1) {
		if len(match) > 1 && !seen[match[1]] {
			seen[match[1]] = true
			if pt := parseToolJSON(match[1]); pt.name != "" {
				tools = append(tools, pt)
			}
		}
	}

	return tools
}

func parseToolJSON(raw string) pendingTool {
	var parsed struct {
		Tool string   `json:"tool"`
		Args []string `json:"args"`
	}
	if err := json.Unmarshal([]byte(raw), &parsed); err == nil && parsed.Tool != "" {
		return pendingTool{name: parsed.Tool, args: strings.Join(parsed.Args, " ")}
	}
	return pendingTool{}
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// loadGlobalPrompt loads a global prompt from a file path.
func loadGlobalPrompt(path string) (string, error) {
	return loadFile(path)
}

// ExecuteTool executes a named tool with given args.
func ExecuteTool(name string, args []string) (string, error) {
	t := findToolByName(name)
	if t == nil {
		return "", fmt.Errorf("unknown tool: %s", name)
	}
	return t.Run(context.Background(), strings.Join(args, " "))
}

// parseWorkflowFromLLM calls parseWorkflow and returns a pointer.
func (m *Model) parseWorkflowFromLLM(input string) *[]todoItem {
	todos := parseWorkflow(input)
	if len(todos) == 0 {
		return nil
	}
	return &todos
}

// setDebug is a test-friendly debug setter.
func (m *Model) setDebug(msg string) {
	m.addDebug(msg)
}

func loadFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func newRedisClient() *redis.Client {
	url := envOr("REDIS_URL", "localhost:6379")
	opts, err := redis.ParseURL("redis://" + url)
	if err != nil {
		return redis.NewClient(&redis.Options{Addr: url})
	}
	return redis.NewClient(opts)
}

func getAvailableCommands() string {
	return `**Available Commands:**

/skill <name>     - Switch to a different skill
/compress         - Compress conversation to .memory/memory.md
/tool {"tool":"name","args":["arg1"]} - Execute a whitelisted tool
/                    - Show this help`
}

func commands() []string {
	return []string{"/compress", "/skill <name>", "/tool {\"tool\":\"name\",\"args\":[\"arg1\"]}"}
}

func filterCommands(prefix string) []string {
	var matches []string
	for _, cmd := range commands() {
		if strings.HasPrefix(cmd, prefix) {
			matches = append(matches, cmd)
		}
	}
	return matches
}