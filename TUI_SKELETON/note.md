# TUI Agent — Architecture & Bug Fix Log

## How Output Gets Sent to the TUI — Full Trace

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

    **How the tokens flow to your screen:**

    The LLM doesn't send the full answer at once. Instead, OpenRouter streams the
    response as small text chunks (tokens) over a single HTTP connection. Each chunk
    arrives in the Go channel via `client.Send()`. `readToken()` reads ONE chunk,
    wraps it as a `streamTokenMsg`, and Bubble Tea delivers it back to `Update()`.
    There, the token is appended to `m.streamBuf` and the viewport is re-rendered —
    so you literally see the response appear character-by-character in the terminal.
    After rendering, `readToken(m.streamCh)` is returned as the next scheduled
    command, creating a loop that keeps reading until the stream ends
    (`msg.Done == true`). This is the core fix from earlier: without re-scheduling
    readToken, only the first token was ever read and the stream appeared to hang.

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

    onStreamDone() (line ~506) is a method on *Model and checks for, in priority order:
     1. Clarification requests → sets mode = "clarify"
     2. Workflows (strict: 2+ steps AND at least one tool) → calls extractToolCommands() first, passes detected tools to parseWorkflow() → sets mode = "workflow"
     3. Standalone tool calls (4 regex patterns, including OpenAI XML) → single tool → applyManualTool(); multiple tools → queue as workflow steps

    ---

    Where Each Piece Lives

    ┌──────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
    │ File                         │ What It Does                                                                                                         │
    ├──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
    │ internal/ui/model.go         │ Main state machine: Update(), onStreamDone(), startStream(), runNextStep(), handleToolConfirm(), handleClarifyInput(),│
    │                              │ handleWorkflowConfirm(), readToken(), renderMessages(), updateView(), renderBoldMarkdown(), isToolLine(), regexpMatch(),│
    │                              │ parseWorkflow(), extractStepAction(), formatArgsForJSON(), parseWorkflowFromLLM()                                      │
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

    `readToken()` → `streamTokenMsg` → `Update()` → `readToken()` is the streaming loop, while `onStreamDone()` → `extractToolCommands()` → `parseWorkflow()` → mode change → user input → `startStream()` → `onStreamDone()` is
    the conversational recursion. Tool execution inserts itself into this loop by running locally, feeding the result back into m.history, and calling startStream() again to send
    the enriched context to the LLM.


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
    ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
    │ stepIndex never advanced │ runNextStep() called recursively but handleToolConfirm never did      │ Added m.stepIndex++ in handleToolConfirm when m.pendingTodos is non-empty        │
    │                          │ m.stepIndex++, causing the same tool step to loop infinitely          │ before calling runNextStep() — workflow now progresses correctly                │
    ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
    │ Empty Enter ignored      │ input == "" was checked BEFORE mode routing (clarify/workflow/       │ Moved mode checks BEFORE the empty-input guard so empty Enter reaches the       │
    │ in mode handlers         │ tool_confirm), so empty Enter in those modes fell through to `break` │ appropriate handler — enables auto-confirm on empty Enter for tool/workflow     │
    ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
    │ isToolLine blind to XML  │ isToolLine only checked for "/tool" prefix and `{"tool":` JSON,     │ Added `{"command":` check and `regexpMatch(`<\\w+>\\s*\\{`, line)` for         │
    │                          │ missing OpenAI-style `<toolname>{...}</toolname>` format             │ OpenAI XML-wrapped tool calls — workflow steps using this format now detected   │
    ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
    │ Only first tool executed │ onStreamDone extracted all tools via extractToolCommands but only    │ When multiple tools detected: if single tool use original prompt flow; if       │
    │                          │ passed tools[0] to applyManualTool, silently dropping the rest       │ multiple, convert all to pendingTodos and route through workflow machinery for  │
    │                          │                                                                              sequential execution with user confirmation per step                           │
    ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
    │ extractStepAction        │ 3 nested loops checking "Step N:", "N.", bullets, case variants —     │ Replaced with single regex:                                                     │
    │ overcomplicated          │ all doing the same thing in different ways                            │ `(?i)^(?:step\s+\d+:\s*|^\d+\.\s*|[-*•]\s+)(.*)`                               │
    ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
    │ Tools silently skipped   │ parseWorkflow stored raw LLM line as ToolCmd (e.g.                    │ parseWorkflow now takes `detectedTools []pendingTool` param from                │
    │ in workflows             │ `/tool {"tool":"read","args":["x"]}`). runNextStep tried               │ extractToolCommands() and builds clean JSON ToolCmd. No more format mismatch.   │
    │                          │ json.Unmarshal on it — `/tool ` prefix made it invalid JSON.          │                                                                                  │
    ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
    │ Silent failures in       │ If json.Unmarshal failed OR findToolByName returned nil, step was     │ Added error chat entries: "Tool parse error: ..." and "Unknown tool: ..."       │
    │ runNextStep              │ silently skipped — no error message, no user feedback                 │ so user sees why a step was skipped                                             │
    ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
    │ parseWorkflow only       │ parseWorkflow only looked at i+1 for tool lines. If LLM put tool      │ parseWorkflow now uses extractToolCommands() on the full response — handles     │
    │ checks next line         │ on same line as step, or separated by blank line, it was missed       │ all 4 formats (/, bare JSON, code block, OpenAI XML) anywhere in the output     │
    ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
    │ formatArgsForJSON        │ strings.Fields(args) split on whitespace — "hello world" became       │ Replaced with json.Marshal(parts) for proper JSON string quoting                │
    │ splits args wrong        │ two args ["hello", "world"] instead of one                            │                                                                                  │
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
    ├──────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
    │ Simplified step parsing      │ extractStepAction replaced 3 nested loops with single regex                    │
    ├──────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
    │ Reliable workflow tool       │ parseWorkflow now takes detectedTools param from extractToolCommands() —       │
    │ detection                    │ handles all 4 tool formats anywhere in LLM output, not just next-line           │
    ├──────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
    │ Error surfacing in workflows │ runNextStep shows "Tool parse error" and "Unknown tool" messages in chat       │
    ├──────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
    │ Proper JSON arg quoting      │ formatArgsForJSON uses json.Marshal instead of strings.Fields                  │
    └──────────────────────────────┴────────────────────────────────────────────────────────────────────────────────┘


─── Where the System Prompt Lives in the Code ──────────────────────────────────

When the app starts, the New() function (model.go line ~88) does this:

  1. Reads .system/system.md from disk via loadFile()
  2. Inserts it as the VERY FIRST message in m.history with role "system"
  3. Then appends the skill's system prompt after it (if a skill is loaded)
  4. Then if Redis has a saved conversation, that replaces everything (so saved
     history always wins over the default prompt)

Every time you send a message, startStream() calls m.send(ctx, m.history),
which sends the ENTIRE history slice — system prompt first, then all user and
assistant messages — to OpenRouter. The LLM sees the system message at index 0
and uses it to shape its personality, rules, and tool-calling behavior for the
whole session.

Why it's done this way:
  • The system prompt is loaded once at startup and never modified during the
    session, so the LLM always gets consistent baseline instructions.
  • It sits at the bottom of history (index 0), so newer messages have more
    influence, but the foundational rules from system.md are always present.
  • If Redis saves and restores a conversation, the saved messages replace the
    default history — this means a resumed session picks up exactly where it
    left off, with the user's past context but without re-injecting the system
    prompt on top.