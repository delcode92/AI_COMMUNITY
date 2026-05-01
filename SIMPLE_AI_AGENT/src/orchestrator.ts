// AgentOrchestrator — the main entry point for LLM-powered conversations.
//
// How it works:
//  1. The user sends a message → chat() saves it to session history and calls the LLM API.
//  2. All registered tools are sent as function definitions so the LLM can choose to call them.
//  3. If the LLM responds with tool_calls (finish_reason === 'tool_calls'), we enter the agentic loop:
//     a) Execute each tool call → fire 'tool_call' and 'tool_result' events.
//     b) Append results to the message list and call the LLM again with updated context.
//  4. The loop repeats until the LLM returns a final text response (no more tool calls).
//  5. The final reply is saved to history and returned to the caller.
//
// Progress events (onProgress callback):
//   thinking → tool_call → tool_result → thinking_again → ... → done
//
import { SkillRouter } from './core/skillRouter';
import { WorkflowEngine } from './workflows/engine';
import { BrowserStorage } from './storage';
import { AgentContext, ChatMessage, Workflow, ToolCallLog } from './core/types';

const BASE_URL = import.meta.env.VITE_OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
const API_URL = `${BASE_URL}/chat/completions`;
const DEFAULT_MODEL = import.meta.env.VITE_MODEL ?? 'anthropic/claude-sonnet-4-5';

export const AVAILABLE_MODELS = [
  { id: DEFAULT_MODEL, label: 'gpt oss 120b' },
  { id: 'tencent/hy3-preview:free', label: 'Tencent hy3' },
  { id: 'google/gemma-4-31b-it:free', label: 'Gemma' },
  { id: 'openai/gpt-oss-20b', label: 'gpt oss 20 (PAID)' },
  { id: 'cohere/command-r7b-12-2024', label: 'cohere (PAID)' },
  { id: 'minimax/minimax-m2.5:free', label: 'minimax' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'nemotron' }
  ];

export type AgentEventType =
  | 'thinking'
  | 'tool_call'
  | 'tool_executing'
  | 'tool_result'
  | 'thinking_again'
  | 'done';

export interface AgentEvent {
  type: AgentEventType;
  toolName?: string;
  payload?: unknown;
}

export type AgentCallback = (ev: AgentEvent) => void;

interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string | ContentBlock[];
  tool_call_id?: string;
}

interface ContentBlock {
  type: string;
  [key: string]: unknown;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// instance class ini akan digunakan di main.ts dengan nama object -->  orchestrator
export class AgentOrchestrator {
  private apiKey: string;
  private model: string;

  constructor(
    private router: SkillRouter,
    private engine: WorkflowEngine,
    private storage: BrowserStorage,
    apiKey?: string,
    private systemPrompt = 'You are a helpful AI agent. Use available tools to complete tasks accurately.',
    model?: string
  ) {
    this.apiKey = apiKey ?? import.meta.env.VITE_OPENROUTER_API_KEY ?? '';
    this.model = model ?? DEFAULT_MODEL;

    if (!this.apiKey) {
      console.warn('[AgentOrchestrator] No API key provided. Set VITE_OPENROUTER_API_KEY in your .env file.');
    }
  }

  // ── Conversational chat with automatic tool use ───────────────────────────

  async chat(userMessage: string, sessionId: string, onProgress?: AgentCallback): Promise<string> {
    const ctx = this.getOrCreateContext(sessionId);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    this.storage.ls.appendMessage(sessionId, userMsg);

    const history = this.storage.ls.getHistory(sessionId);
    const messages: Message[] = history.map((m) => ({ role: m.role, content: m.content }));

    const tools = this.router.toClaudeTools();
    const toolCalls: ToolCallLog[] = [];

    onProgress?.({ type: 'thinking' });
    let response = await this.callAPI(messages, tools);

    // bagian penting dari orkestrasi, tetap terus proses sampai LLM `merasa cukup puas`, 
    // dengan tanda tidak ada lagi reponse yg mengharuskan eksekusi tools_call

    // Agentic loop — keep going while the model wants to call tools
    while (response.choices?.[0]?.finish_reason === 'tool_calls') {
      const assistantMsg = response.choices[0].message;
      const calls: ToolCall[] = assistantMsg.tool_calls ?? [];

      messages.push({ role: 'assistant', content: assistantMsg.content ?? '', ...( calls.length ? { tool_calls: calls } : {}) } as Message);

      for (const call of calls) {
        let input: Record<string, unknown> = {};
        try { input = JSON.parse(call.function.arguments); } catch { /* malformed JSON from model */ }

        onProgress?.({ type: 'tool_call', toolName: call.function.name, payload: input });

        const t0 = performance.now();
        const result = await this.router.call(call.function.name, input, ctx);
        const durationMs = Math.round(performance.now() - t0);

        onProgress?.({ type: 'tool_result', toolName: call.function.name, payload: { result, durationMs } });

        toolCalls.push({ toolName: call.function.name, input, result, durationMs });

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }

      onProgress?.({ type: 'thinking_again' });
      response = await this.callAPI(messages, tools);
    }

    const finalText = response.choices?.[0]?.message?.content ?? '';
    onProgress?.({ type: 'done' });

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: finalText,
      timestamp: Date.now(),
      toolCalls: toolCalls.length ? toolCalls : undefined,
    };
    this.storage.ls.appendMessage(sessionId, assistantMsg);

    return finalText;
  }

  // ── Run a predefined workflow ─────────────────────────────────────────────

  async runWorkflow(
    workflow: Workflow,
    sessionId: string,
    onStep?: Parameters<WorkflowEngine['run']>[2]
  ) {
    const ctx = this.getOrCreateContext(sessionId);
    return this.engine.run(workflow, ctx, onStep);
  }

  // ── Session management ────────────────────────────────────────────────────

  getOrCreateContext(sessionId: string): AgentContext {
    const existing = this.storage.ls.loadSession(sessionId);
    if (existing) return existing;

    const ctx: AgentContext = {
      sessionId,
      history: [],
      credentials: this.storage.ls.loadCredentials(),
    };
    this.storage.ls.saveSession(ctx);
    return ctx;
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  setModel(model: string): void {
    this.model = model;
  }

  setCredential(name: string, value: string): void {
    this.storage.ls.saveCredential(name, value);
  }

  // ── Internal API call (OpenRouter — OpenAI-compatible format) ────────────

  private async callAPI(messages: Message[], tools: ReturnType<SkillRouter['toClaudeTools']>) {
    // Convert Anthropic tool schema format → OpenAI function format for OpenRouter
    const functions = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Browser Agent Platform',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...messages,
        ],
        tools: functions.length ? functions : undefined,
        tool_choice: functions.length ? 'auto' : undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter API error ${res.status}: ${err}`);
    }

    return res.json();
  }
}
