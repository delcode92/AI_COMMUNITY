// ─────────────────────────────────────────────────────────────────────────────
// AgentTool — the ONE interface every skill must implement.
// Built-in JS functions and remote API adapters both satisfy this contract.
// ─────────────────────────────────────────────────────────────────────────────

export type ToolParamType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface ToolParam {
  type: ToolParamType;
  description: string;
  required?: boolean;
  enum?: string[];         // restrict to specific values
  default?: unknown;
}

export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  meta?: {
    durationMs: number;
    source: 'builtin' | 'api';
    cached?: boolean;
  };
}

export interface AgentTool {
  // Identity
  name: string;
  description: string;          // Claude reads this to decide when to call
  category: string;             // e.g. "data", "communication", "utility"

  // Schema for Claude's tool_use (auto-converted by SkillRouter)
  params: Record<string, ToolParam>;

  // The actual implementation — could be a pure function or an HTTP call
  call(input: Record<string, unknown>, ctx: AgentContext): Promise<ToolCallResult>;

  // Optional: auth config needed for API tools
  auth?: ToolAuth;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth descriptor — only needed for API-backed tools
// ─────────────────────────────────────────────────────────────────────────────

export type AuthType = 'bearer' | 'api_key' | 'basic' | 'oauth2' | 'none';

export interface ToolAuth {
  type: AuthType;
  // For bearer/api_key: the key name to look up in the agent's credential store
  credentialKey?: string;
  // For oauth2: a callback the tool provides to refresh tokens
  refreshToken?: () => Promise<string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP Adapter — convenience base for REST/GraphQL API tools.
// Extend this instead of implementing AgentTool from scratch for API tools.
// ─────────────────────────────────────────────────────────────────────────────

export interface HttpAdapterConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeout?: number;            // ms, default 10_000
  retries?: number;            // default 2
  rateLimit?: {
    requestsPerMinute: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow types
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowStep {
  id: string;
  toolName: string;
  // Static input OR dynamic function of previous step results
  input: Record<string, unknown> | ((prev: StepResult[]) => Record<string, unknown>);
  condition?: (prev: StepResult[]) => boolean;
  label?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
}

export interface StepResult {
  stepId: string;
  toolName: string;
  result: ToolCallResult;
  durationMs: number;
}

export interface WorkflowRun {
  runId: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  steps: StepResult[];
  startedAt: number;
  completedAt?: number;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation & session
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: ToolCallLog[];
}

export interface ToolCallLog {
  toolName: string;
  input: Record<string, unknown>;
  result: ToolCallResult;
  durationMs: number;
}

export interface AgentContext {
  sessionId: string;
  history: ChatMessage[];
  credentials: Record<string, string>;   // credential store for API tools
  metadata?: Record<string, unknown>;
}
