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
     - Standalone tool calls (4 regex patterns, including OpenAI XML) → sets mode = "tool_confirm"

    ---

    Where Each Piece Lives

    ┌──────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
    │ File                         │ What It Does                                                                                                         │
    ├──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
    │ internal/ui/model.go         │ Main state machine: Update(), onStreamDone(), startStream(), runNextStep(), handleToolConfirm(), handleClarifyInput(),│
    │                              │ handleWorkflowConfirm(), readToken(), renderMessages(), updateView(), renderBoldMarkdown(), isToolLine(), regexpMatch()│
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