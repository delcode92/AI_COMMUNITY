How Output Gets Sent to the TUI — Full Trace

    Here's the complete data flow, step by step, through the actual code:

    ---

    1. User hits Enter → Update() in model.go (line ~140)

    When the user types a message and presses Enter:

     1 // Append to history + UI entries
     2 m.history = append(m.history, agent.Message{Role: "user", Content: input})
     3 m.entries = append(m.entries, chatEntry{role: "user", content: input})
     4 m.streaming = true
     5 m.streamBuf.Reset()
     6 m.viewport.SetContent(m.renderMessages())  // show the user's message
     7 return m, m.startStream()                  // kick off streaming

    ---

    2. startStream() opens the HTTP stream → returns a readToken command

     1 func (m *Model) startStream() tea.Cmd {
     2     ctx, cancel := context.WithCancel(context.Background())
     3     m.cancelFn = cancel
     4     ch := m.send(ctx, m.history)     // calls client.Send() → HTTP POST to OpenRouter
     5     m.streamCh = ch
     6     return readToken(ch)             // ← schedules ONE read from the channel
     7 }

    client.Send() in client.go opens a streaming HTTP connection and pushes StreamChunk values into a Go channel as tokens arrive.

    ---

    3. readToken() — the Bridge Between Channel and Bubble Tea

      1 func readToken(ch <-chan agent.StreamChunk) tea.Cmd {
      2     return func() tea.Msg {
      3         if msg, ok := <-ch; ok {
      4             if msg.Done { return streamDoneMsg{} }
      5             if msg.Err != nil { return streamErrMsg{err: msg.Err} }
      6             return streamTokenMsg(msg.Content)  // ← wraps token as a Tea message
      7         }
      8         return streamDoneMsg{}
      9     }
     10 }

    This returns one tea.Cmd that reads one token from the channel and turns it into a streamTokenMsg that Bubble Tea will deliver back to Update().

    ---

    4. Bubble Tea feeds the message back into Update() — THE KEY HAPPENS HERE

     1 case streamTokenMsg:                      // line ~188
     2     m.streamBuf.WriteString(string(msg))  // accumulate raw tokens
     3     m.updateAssistantEntry(string(msg))    // append to last "assistant" entry
     4     m.viewport.SetContent(m.renderMessages())  // ← RENDER TO TERMINAL
     5     return m, readToken(m.streamCh)        // ← RE-SCHEDULE next read (the fix!)

    This is the output pipeline. Each token:
     1. Gets appended to streamBuf (raw text)
     2. Gets appended to the last chatEntry in m.entries (structured UI data)
     3. m.renderMessages() formats ALL entries with Lipgloss styling (including **bold** via renderBoldMarkdown)
     4. m.viewport.SetContent(...) pushes the formatted string into the viewport
     5. Bubble Tea calls View() automatically, which composites viewport.View() + divider + input box + status bar → drawn to the terminal
     6. readToken(m.streamCh) is returned as the next command, creating a loop

    This is exactly the bug we fixed. Without returning readToken(m.streamCh), only the first token was ever read. After that, no more commands were scheduled, so the stream
    appeared to hang on "generating…".

    ---

    5. When the stream ends → streamDoneMsg

     1 case streamDoneMsg:                       // line ~195
     2     m.streaming = false
     3     m.onStreamDone(m.streamBuf.String())   // process the full response

    onStreamDone() (line ~430) is a method on *Model and checks for, in priority order:
     - Clarification requests → sets mode = "clarify"
     - Workflows (strict: 2+ steps AND at least one tool) → sets mode = "workflow"
     - Tool commands (standalone, extracted via 4 regex patterns) → calls m.applyManualTool() → sets mode = "tool_confirm"

    ---

    6. Tool confirmation prompt (Bug 2 fix)

     1 // in onStreamDone(), standalone tool detection branch
     2 if tools := m.extractToolCommands(response); len(tools) > 0 {
     3     m.applyManualTool(...)    // sets mode="tool_confirm", appends "Execute tool X? (y/n)" entry
     4     m.updateView()            // ← THIS WAS MISSING. Without it, the viewport never refreshes
     5     return
     6 }

    applyManualTool() is now a method on *Model (line ~690 in model.go). It adds the confirmation entry to m.entries, but previously never called
    m.updateView(). Adding m.updateView() (which calls m.viewport.SetContent(m.renderMessages())) fixes this — consistent with the clarify and workflow
    branches above it, which already called m.updateView().

    ---

    7. The Mode State Machine

    The agent has four modes, stored in m.mode:

     "" (empty)         — Normal chat. Enter sends user message to LLM.
     "clarify"          — LLM asked a clarifying question. Next Enter sends user's answer back to LLM.
     "workflow"         — LLM proposed a multi-step workflow. Next Enter confirms and advances to next step.
     "tool_confirm"     — A tool is ready to execute. Next Enter runs the tool.

    Routing in Update() (KeyEnter handler, line ~168):
     1 if m.streaming { return m, nil }     ← Block Enter during streaming (Bug 7 fix)
     2 if m.mode == "clarify"  → handleClarifyInput(input)
     3 if m.mode == "workflow" → handleWorkflowConfirm(input)
     4 if m.mode == "tool_confirm" → handleToolConfirm(input)
     5 else → normal message (default branch)

    ---

    8. Enter key streaming guard (Bug 7 fix)

     1 case tea.KeyEnter:
     2     if m.streaming {
     3         return m, nil    // ← BLOCK Enter during streaming
     4     }                    //     (previously used `break` which fell through)

    The old code used `break` which fell through to the textarea processing at the bottom of Update(),
    allowing the user to inject text into the textarea while a stream was in progress. Changing to
    `return m, nil` short-circuits the entire function, preventing any input during streaming.

    ---

    9. The render chain: View() → renderMessages() → Lipgloss + Bold Markdown

      1 View()
      2  ├── m.viewport.View()           ← shows chat history
      3  │    └── renderMessages()       ← formats each chatEntry with styles
      4  │         ├── UserLabelStyle    ← "you" in orange
      5  │         ├── MessageStyle      ← user text (normal)
      6  │         ├── AssistantLabelStyle ← "assistant" in green
      7  │         ├── MessageBoldStyle  ← **bold** text in assistant responses
      8  │         └── renderBoldMarkdown() parses **text** pattern
      9  ├── DividerStyle                ← horizontal line
     10  ├── inputBox                    ← textarea (where user types)
     11  └── renderStatusBar()           ← "generating..." / "ready" / model name

    **Bold markdown rendering** (new feature):
    renderBoldMarkdown() (line ~830) scans assistant message text for **text** patterns.
    Each match is rendered using MessageBoldStyle (Bold: true) while non-bold text uses MessageStyle.
    This is applied only to assistant entries via renderMessages() at line ~800.

    ---

    10. Tool Call Extraction — Four Regex Patterns (model_tools.go)

    m.extractToolCommands() in model_tools.go uses four patterns to find tool calls:

     Pattern 1: /tool {"tool":"name","args":[...]}
                Standard explicit tool command

     Pattern 2: {"tool":"name","args":[...]}
                Bare JSON object with tool/args keys

     Pattern 3: Markdown code block format
                > <tool {"tool":"name","args":[...]}
                >>>tool {"tool":"name","args":[...]}

     Pattern 4: OpenAI-style XML-wrapped tool calls (NEW)
                <toolname>{"command":"...","args":[...]}</toolname>
                The inner JSON uses "command" (alias for "tool") and "args" keys.
                Detected after Patterns 1-3, with the same dedup logic.

    parseAndAddTool() (line ~50) accepts both "tool" and "command" as the name key,
    making it work with both standard JSON ({tool, args}) and OpenAI-style ({command, args}).

    ---

    Summary of ALL bugs fixed


    ┌──────────────────────────┬──────────────────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────┐
    │ Bug                      │ Root Cause                                                            │ Fix                                                                              │
    ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
    │ Streaming hang           │ readToken() was called once in startStream() but never                │ Return readToken(m.streamCh) inside the streamTokenMsg case, creating a read    │
    │                          │ re-scheduled after each token                                         │ loop                                                                              │
    ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
    │ Invisible tool prompt    │ applyManualTool() appended a confirmation entry to m.entries but      │ Added m.updateView() after applyManualTool() in onStreamDone(), matching the    │
    │                          │ never called m.updateView()                                          │ clarify and workflow branches                                                    │
    ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
    │ Over-eager workflow      │ parseWorkflow matched any numbered list (even without tools)         │ parseWorkflow now requires 2+ steps AND at least one step with a tool call      │
    ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
    │ Tool confirm empty Enter │ handleToolConfirm only matched "y"/"yes" literally                   │ Empty input ("") is now treated as auto-confirm alongside "y"/"yes"             │
    ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
    │ Value receiver mutation  │ handleToolConfirm was (m Model) — all mutations were lost            │ Changed to (m *Model) — mutations persist in the returned model                 │
    ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
    │ Missing workflow mode    │ onStreamDone workflow branch never set m.mode = "workflow"           │ Added m.mode = "workflow" — without this KeyEnter routed to the default branch   │
    ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
    │ Enter passthrough        │ KeyEnter handler used `break` which fell through to textarea logic    │ Changed to `return m, nil` to fully block input while streaming                 │
    └──────────────────────────┴──────────────────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────┘

    Summary of ALL features added


    ┌──────────────────────────────┬────────────────────────────────────────────────────────────────────────────┐
    │ Feature                      │ Description                                                                    │
    ├──────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
    │ Bold markdown rendering      │ Assistant responses with **text** are rendered using MessageBoldStyle           │
    ├──────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
    │ OpenAI-style tool extraction │ <toolname>{command,args}</toolname> format detected and parsed                 │
    ├──────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
    │ Command alias "command" key  │ parseAndAddTool accepts both "tool" and "command" as the tool name JSON key     │
    ├──────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
    │ Code cleanup                 │ Removed duplicate extractToolCommands/parseToolJSON from model.go; removed      │
    │                              │ unused regexp import; removed debug KeyRunes handler                           │
    └──────────────────────────────┴────────────────────────────────────────────────────────────────────────────────┘




The Full Recursive Agent ↔ User Loop

    The entire back-and-forth is driven by Bubble Tea's `Update()` → `View()` event loop combined with channel-based streaming and state machine mode switching. Here's every path:

    ---

    The Core Event Loop

     1 Bubble Tea starts → calls Init() → returns textarea.Blink
     2                     ↓
     3             waits for tea.Msg
     4                     ↓
     5         ┌───────────┼───────────────────┐
     6         ▼           ▼                   ▼
     7    tea.KeyMsg   streamTokenMsg    streamDoneMsg
     8    (user types)  (token arrives)   (stream ends)

    Every time Update() returns a tea.Cmd, Bubble Tea executes it and sends the result back as the next tea.Msg, creating the recursion.

    ---

    Path 1: Normal Message → LLM Response → Done

      1 User types + Enter
      2   → Update() case tea.KeyEnter
      3     → m.streaming is false, m.mode is "" → normal branch
      4     → m.startStream()
      5       → m.send(ctx, m.history)           // HTTP POST to OpenRouter
      6       → returns readToken(ch)            // Bubble Tea schedules one read
      7         → Channel delivers streamTokenMsg
      8           → Update() appends token to entry, renders viewport
      9           → returns readToken(m.streamCh)  // ← RE-SCHEDULES (the loop)
     10             → Channel delivers next streamTokenMsg
     11               → ... (repeats for every token) ...
     12                 → Channel delivers streamDoneMsg
     13                   → Update() calls m.onStreamDone(fullResponse)
     14                     → history appended with full response (deferred in onStreamDone)
     15                     → m.streaming = false
     16                     → returns nil (no more cmds, wait for user input)

    ---

    Path 2: Clarification (Recursive Back-and-Forth)

    When LLM answers with a clarifying question:

      1 onStreamDone(response)
      2   → parseClarification(response) returns true
      3     → m.mode = "clarify"
      4     → m.entries appended with question
      5     → m.updateView()              // show the question
      6     → returns
      7
      8 User types their clarification + Enter
      9   → Update() case tea.KeyEnter
     10     → m.mode == "clarify"
     11       → m.handleClarifyInput(input)
     12         → m.mode = ""
     13         → m.history.append(user answer)
     14         → m.streaming = true
     15         → returns m.startStream()   // ← SENDS BACK TO LLM
     16           → ... streaming loop repeats ...
     17             → onStreamDone called again
     18               → parseClarification check again
     19               → OR workflow/tool detection

    This is the recursive user↔AI loop. Each round: user input → LLM stream → onStreamDone → potentially another clarification → user input → etc.

    ---

    Path 3: Workflow with Tool Execution (The Recursive Function-Call Loop)

    This is the most complex path. The LLM outputs a workflow with tool calls:

      1 onStreamDone(response)
      2   → parseWorkflow(response) finds todos (strict: 2+ steps AND ≥1 tool)
      3     → m.mode = "workflow"
      4     → m.pendingTodos = [
      5          {Action: "Search the web", ToolCmd: `{"tool":"shell","args":["curl ..."]}`},
      6          {Action: "Write a report"}
      7        ]
      8     → m.stepIndex = 0
      9     → m.entries appended with formatted todo list + "Proceed? (y/Enter=yes, n=no)"
     10     → m.updateView()
     11     → returns

    User hits Enter to confirm:

     1 Update() case tea.KeyEnter
     2   → m.mode == "workflow"
     3     → m.handleWorkflowConfirm(input)
     4       → input is "y" or "" (auto-confirm) → m.runNextStep()
     5       → input is "n" → cancels workflow, returns nil

    runNextStep() (line ~557):

      1 func (m *Model) runNextStep() tea.Cmd {
      2     // Base case: all steps done
      3     if step >= len(todos) → "Workflow completed!" + save to memory + return nil
      4
      5     todo := m.pendingTodos[m.stepIndex]
      6
      7     if todo.ToolCmd != "" {
      8         // Parse the tool JSON from the workflow
      9         m.mode = "tool_confirm"
     10         m.pendingTool = findToolByName(req.Tool)
     11         m.pendingArgs = strings.Join(req.Args, " ")
     12         // Append: "Execute tool shell with args curl...? (y/n)"
     13         m.updateView()                   // ← SHOW TOOL CONFIRMATION
     14         return nil                       // wait for user y/n
     15     }
     16
     17     // No tool → auto-advance to next step
     18     m.stepIndex++
     19     return m.runNextStep()               // ← RECURSIVE to next step
     20 }

    User confirms tool → `handleToolConfirm()`:

      1 func (m *Model) handleToolConfirm(input string) (tea.Model, tea.Cmd) {
      2     // "y", "yes", or "" (empty) → confirm
      3       output, err := m.pendingTool.Run(context.Background(), m.pendingArgs)
      4       // e.g., runs: shell("curl -s https://example.com")
      5       // Output: "HTTP/1.1 200 OK..."
      6
      7       // Append result to conversation
      8       m.entries = append(m.entries, chatEntry{
      9           role: "assistant",
     10           content: fmt.Sprintf("Executed %s(%s) → %s", toolName, args, output),
     11       })
     12
     13       // Re-trigger LLM stream with tool result in context
     14       m.pendingTool = nil
     15       m.pendingArgs = ""
     16
     17       if len(m.pendingTodos) > 0 {
     18         // Still in workflow → advance to next step
     19         return m, m.runNextStep()         // ← continue workflow
     20       }
     21
     22       // Standalone tool: re-trigger LLM
     23       m.streaming = true
     24       m.streamBuf.Reset()
     25       return m, m.startStream()           // ← SENDS tool result BACK TO LLM
     26 }

    This creates the recursive chain:

      1 User prompt: "Research and summarize example.com"
      2   → LLM streams: "I'll search example.com, then write a report"
      3   → onStreamDone: workflow = [{Search, shell("curl ...")}, {Write report}]
      4   → Workflow confirmation prompt shown
      5   → User confirms "y"
      6   → runNextStep() → tool confirmation prompt shown
      7   → User confirms "y"
      8   → shell("curl ...") executes locally
      9   → Tool output fed back into m.history
     10   → runNextStep() or startStream() sends enriched context back to LLM
     11   → LLM streams next step or final answer
     12   → onStreamDone: next workflow step or "no more tools → Done"
     13   → Workflow complete → "Workflow completed!" saved to .memory/memory.md

    ---

    Path 4: Manual Tool (User-Initiated /tool)

      1 User types: /tool {"tool":"echo","args":["hello world"]}
      2   → Update() case strings.HasPrefix(input, "/tool ")
      3     → m.applyManualTool(input)
      4       → sets m.mode = "tool_confirm"
      5       → appends "Execute tool echo with args hello world? (y/n)"
      6       → m.updateView()  ← FIX: now the prompt renders
      7     → m.viewport.GotoBottom()
      8     → returns nil (wait for y/n)
      9
     10 User types "y" (or just Enter)
     11   → Update() case tea.KeyEnter
     12     → m.mode == "tool_confirm"
     13       → m.handleToolConfirm("y")
     14         → tool.Run() executes locally
     15         → result appended to entries
     16         → m.startStream() → sends result back to LLM
     17           → ... streaming loop ...

    ---

    Where Each Piece Lives

    ┌──────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
    │ File                         │ What It Does                                                                                                         │
    ├──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
    │ internal/ui/model.go         │ Main state machine: Update(), onStreamDone(), startStream(), runNextStep(), handleToolConfirm(), handleClarifyInput(),│
    │                              │ handleWorkflowConfirm(), readToken(), renderMessages(), updateView(), renderBoldMarkdown()                             │
    ├──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
    │ internal/ui/model_tools.go   │ extractToolCommands() — 4 regex patterns (/, bare JSON, markdown code block, OpenAI XML); parseAndAddTool()           │
    ├──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
    │ internal/ui/model_sdk.go     │ wrapSDKStream() — SDK mode tool execution during streaming; startSDKStream()                                           │
    ├──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
    │ internal/ui/styles.go        │ Lipgloss styles: UserLabelStyle, AssistantLabelStyle, MessageBoldStyle, ClarificationStyle, WorkflowProposalStyle, etc.│
    ├──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
    │ internal/agent/client.go     │ Send() — raw HTTP streaming to OpenRouter, returns <-chan StreamChunk                                                  │
    ├──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
    │ internal/agent/sdk_agent.go  │ SDKAgent.RunStream() — SDK-managed streaming with built-in tool calling; StreamEvent channel                           │
    └──────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

    ---

    The Recursion in One Sentence

    `readToken()` → `streamTokenMsg` → `Update()` → `readToken()` is the streaming loop, while `onStreamDone()` → mode change → user input → `startStream()` → `onStreamDone()` is
    the conversational recursion. Tool execution inserts itself into this loop by running locally, feeding the result back into m.history, and calling startStream() again to send
    the enriched context to the LLM.