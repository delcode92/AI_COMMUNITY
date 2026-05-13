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
     3. m.renderMessages() formats ALL entries with Lipgloss styling
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

    onStreamDone() (line ~430) then checks for:
     - Clarification requests → sets mode = "clarify"
     - Workflows → sets mode = "workflow", parses todo steps
     - Tool commands → calls applyManualTool() → sets mode = "tool_confirm"

    ---

    6. Tool confirmation prompt (Bug 2 fix)

     1 // in onStreamDone(), tool detection branch (line ~464):
     2 if tools := extractToolCommands(response); len(tools) > 0 {
     3     m.applyManualTool(...)    // sets mode="tool_confirm", appends "Execute tool X? (y/n)" entry
     4     m.updateView()            // ← THIS WAS MISSING. Without it, the viewport never refreshes
     5     return
     6 }

    applyManualTool() adds the confirmation entry to m.entries, but never updated the viewport. The user never saw the prompt. Adding m.updateView() (which calls
    m.viewport.SetContent(m.renderMessages())) fixes this — consistent with the clarify and workflow branches above it, which already called m.updateView().

    ---

    7. The render chain: View() → renderMessages() → Lipgloss

      1 View()
      2  ├── m.viewport.View()           ← shows chat history
      3  │    └── renderMessages()       ← formats each chatEntry with styles
      4  │         ├── UserLabelStyle    ← "you" in cyan
      5  │         ├── MessageStyle      ← user text
      6  │         ├── AssistantLabelStyle ← "assistant" in green
      7  │         └── MessageStyle      ← assistant response text
      8  ├── DividerStyle                ← horizontal line
      9  ├── inputBox                    ← textarea (where user types)
     10  └── renderStatusBar()           ← "generating..." / "ready" / model name

    ---

    Summary of the two bugs and their fixes


    ┌──────────────────┬────────────────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────┐
    │ Bug              │ Root Cause                                                         │ Fix                                                                           │
    ├──────────────────┼────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
    │ Streaming hang   │ readToken() was called once in startStream() but never             │ Return readToken(m.streamCh) inside the streamTokenMsg case, creating a       │
    │                  │ re-scheduled after each token                                      │ read-loop                                                                     │
    ├──────────────────┼────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
    │ Invisible tool   │ applyManualTool() appended a confirmation entry to m.entries but   │ Added m.updateView() after applyManualTool() in onStreamDone(), matching the  │
    │ prompt           │ never called m.updateView()                                        │ clarify and workflow branches                                                 │
    └──────────────────┴────────────────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────┘


    Both fixes are in /Users/Admin/Documents/project/AI_COMMUNITY/TUI_SKELETON/internal/ui/model.go.




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
      3     → m.startStream()
      4       → m.send(ctx, m.history)           // HTTP POST to OpenRouter
      5       → returns readToken(ch)            // Bubble Tea schedules one read
      6         → Channel delivers streamTokenMsg
      7           → Update() appends token to entry, renders viewport
      8           → returns readToken(m.streamCh)  // ← RE-SCHEDULES (the loop)
      9             → Channel delivers next streamTokenMsg
     10               → ... (repeats for every token) ...
     11                 → Channel delivers streamDoneMsg
     12                   → Update() calls m.onStreamDone(fullResponse)
     13                     → history appended with full response
     14                     → m.streaming = false
     15                     → returns nil (no more cmds, wait for user input)

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
      2   → parseWorkflow(response) finds todos
      3     → m.pendingTodos = [
      4          {Action: "Search the web", ToolCmd: `{"tool":"shell","args":["curl ..."]}`},
      5          {Action: "Write a report"}
      6        ]
      7     → m.stepIndex = 0
      8     → m.entries appended with formatted todo list
      9     → m.updateView()
     10     → returns

    Now the user doesn't type anything — the workflow drives itself.

    User hits Enter (or the workflow auto-advances):

     1 Update() case tea.KeyEnter
     2   → m.mode == "workflow"
     3     → m.handleWorkflowConfirm(input)
     4       → input is "y" or "" (auto-confirm)
     5       → returns m.runNextStep()

    runNextStep() at line ~557:

      1 func (m *Model) runNextStep() tea.Cmd {
      2     todo := m.pendingTodos[m.stepIndex]     // step 0: "Search the web"
      3
      4     if todo.ToolCmd != "" {
      5         // Parse the tool JSON from the workflow
      6         m.mode = "tool_confirm"
      7         m.pendingTool = findToolByName(req.Tool)  // e.g., "shell"
      8         m.pendingArgs = strings.Join(req.Args, " ")
      9         // Append: "Execute tool shell with args curl...? (y/n)"
     10         m.updateView()                   // ← SHOW TOOL CONFIRMATION
     11         return nil                       // wait for user y/n
     12     }
     13
     14     // No tool → just advance
     15     m.stepIndex++
     16     return m.runNextStep()               // ← RECURSIVE to next step
     17 }

    User confirms tool → `handleToolConfirm()`:

      1 func (m *Model) handleToolConfirm(input string) (tea.Model, tea.Cmd) {
      2     if lower == "y" || lower == "yes" {
      3         // EXECUTE THE TOOL ← THIS IS THE KEY
      4         output, err := m.pendingTool.Run(context.Background(), m.pendingArgs)
      5         // e.g., runs: shell("curl -s https://example.com")
      6         // Output: "HTTP/1.1 200 OK..."
      7
      8         // Append result to conversation
      9         m.entries = append(m.entries, chatEntry{
     10             role: "assistant",
     11             content: fmt.Sprintf("Executed %s(%s) → %s", toolName, args, output),
     12         })
     13
     14         // Re-trigger LLM stream with tool result in context
     15         m.streaming = true
     16         m.streamBuf.Reset()
     17         return m, m.startStream()         // ← SENDS tool result BACK TO LLM
     18     }
     19 }

    This creates the recursive chain:

      1 User prompt: "Research and summarize example.com"
      2   → LLM streams: "I'll search example.com, then write a report"
      3   → onStreamDone: workflow = [{Search, shell("curl ...")}, {Write report}]
      4   → Tool confirmation prompt shown
      5   → User confirms "y"
      6   → shell("curl ...") executes locally
      7   → Tool output fed back into m.history
      8   → startStream() sends entire conversation (including tool output) back to LLM
      9   → LLM streams: "Here's the summary of example.com..."
     10   → onStreamDone: no more tools needed
     11   → Done. Wait for next user input.

    ---

    Path 4: Manual Tool (User-Initiated /tool)

      1 User types: /tool {"tool":"echo","args":["hello world"]}
      2   → Update() case strings.HasPrefix(input, "/tool ")
      3     → m.applyManualTool(input)
      4       → sets m.mode = "tool_confirm"
      5       → appends "Execute tool echo with args hello world? (y/n)"
      6       → BUG WAS HERE: m.updateView() was missing → prompt invisible
      7     → m.updateView()  ← FIX: now the prompt renders
      8     → returns nil (wait for y/n)
      9
     10 User types "y"
     11   → Update() case tea.KeyEnter
     12     → m.mode == "tool_confirm"
     13       → m.handleToolConfirm("y")
     14         → tool.Run() executes locally
     15         → result appended to entries
     16         → m.startStream() → sends result back to LLM
     17           → ... streaming loop ...

    ---

    Where Each Piece Lives


    ┌─────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
    │ File                        │ What It Does                                                                                                                              │
    ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
    │ internal/ui/model.go        │ Main state machine: Update(), onStreamDone(), startStream(), runNextStep(), handleToolConfirm(), handleClarifyInput(),                    │
    │                             │ handleWorkflowConfirm(), readToken(), renderMessages(), updateView()                                                                      │
    ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
    │ internal/ui/model_tools.go  │ extractToolCommands() — regex parser that finds /tool {json} in LLM output                                                                │
    ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
    │ internal/ui/model_sdk.go    │ wrapSDKStream() — SDK mode tool execution during streaming; startSDKStream()                                                              │
    ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
    │ internal/agent/client.go    │ Send() — raw HTTP streaming to OpenRouter, returns <-chan StreamChunk                                                                     │
    ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
    │ internal/agent/sdk_agent.go │ SDKAgent.RunStream() — SDK-managed streaming with built-in tool calling; StreamEvent channel                                              │
    └─────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

    ---

    The Recursion in One Sentence

    `readToken()` → `streamTokenMsg` → `Update()` → `readToken()` is the streaming loop, while `onStreamDone()` → mode change → user input → `startStream()` → `onStreamDone()` is
    the conversational recursion. Tool execution inserts itself into this loop by running locally, feeding the result back into m.history, and calling startStream() again to send
    the enriched context to the LLM.
