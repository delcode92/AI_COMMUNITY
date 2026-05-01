import { AgentTool, ToolCallResult, AgentContext } from './types';

export class SkillRouter {
  private tools = new Map<string, AgentTool>();

  // ── Registration ──────────────────────────────────────────────────────────

  register(tool: AgentTool): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered. Use replace() to overwrite.`);
    }
    this.tools.set(tool.name, tool);
    console.info(`[SkillRouter] ✓ ${tool.name} (${tool.category})`);
    return this;
  }

  registerMany(tools: AgentTool[]): this {
    tools.forEach((t) => this.register(t));
    return this;
  }

  replace(tool: AgentTool): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  unregister(name: string): this {
    this.tools.delete(name);
    return this;
  }

  // ── Lookup ────────────────────────────────────────────────────────────────

  get(name: string): AgentTool {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool "${name}" not found. Registered: ${this.list().map((t) => t.name).join(', ')}`);
    return tool;
  }

  list(category?: string): AgentTool[] {
    const all = Array.from(this.tools.values());
    return category ? all.filter((t) => t.category === category) : all;
  }

  categories(): string[] {
    return [...new Set(this.list().map((t) => t.category))];
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  async call(
    name: string,
    input: Record<string, unknown>,
    ctx: AgentContext
  ): Promise<ToolCallResult> {
    const tool = this.get(name);
    const t0 = performance.now();
    try {
      const result = await tool.call(input, ctx);
      return {
        ...result,
        meta: { ...result.meta, durationMs: Math.round(performance.now() - t0), source: result.meta?.source ?? 'builtin' },
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
        meta: { durationMs: Math.round(performance.now() - t0), source: 'builtin' },
      };
    }
  }

  // ── Claude integration ────────────────────────────────────────────────────
  // Converts registered tools to the format Anthropic's API expects.

  toClaudeTools() {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties: Object.fromEntries(
          Object.entries(tool.params).map(([key, param]) => [
            key,
            {
              type: param.type,
              description: param.description,
              ...(param.enum ? { enum: param.enum } : {}),
            },
          ])
        ),
        required: Object.entries(tool.params)
          .filter(([, p]) => p.required)
          .map(([k]) => k),
      },
    }));
  }
}
