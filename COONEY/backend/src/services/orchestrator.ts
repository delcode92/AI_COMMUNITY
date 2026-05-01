// Agent Orchestrator - Adapted from SIMPLE_AI_AGENT core
// Keeps calling tools with LLM-driven function calling, Redis context management

import { createClient } from 'redis';
import { SkillLoader, SkillConfig } from './skill-loader';
import { AIService } from './ai-service';

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, any>;
  input_schema?: any;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  toolName: string;
  input: Record<string, any>;
  result: string | object;
  durationMs: number;
  success: boolean;
}

export interface OpenRouterResponse {
  choices?: {
    message?: { role: string; content: string; tool_calls?: ToolCall[] };
    finish_reason?: string;
    tool_calls?: ToolCall[];
  }[];
  content?: string;
}

export class AgentOrchestrator {
  private readonly MAX_ITERATIONS = 8;
  private readonly CONTEXT_WINDOW = 20;
  private redisClient: ReturnType<typeof createClient> | null = null;

  constructor(aiService: AIService, redisClient?: any) {
    // Use Redis if available (from Cooney's existing Redis integration)
    if (redisClient) {
      this.redisClient = redisClient;
    }
  }

  /**
   * Main agent loop - processes user message with tool calling
   * Returns final response + tool execution trace
   */
  async process(userId: string, skillId: string, message: string): Promise<{
    content: string;
    toolCalls: ToolResult[];
    iterations: number;
  }> {
    const skillLoader = new SkillLoader();
    const skill = await skillLoader.getSkillById(skillId);
    const aiService = new AIService(this.redisClient, process.env.OPENROUTER_API_KEY || '');

    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    let iteration = 0;
    const toolResults: ToolResult[] = [];

    // Get context from Redis (Cooney's existing memory system)
    const contextKey = `chat:${userId}`;
    let messages: any[] = [];

    if (this.redisClient) {
      try {
        // Get last N messages (context window)
        const history = await this.redisClient.lRange(contextKey, 0, -1);
        messages = history.map((h: any) => {
          try {
            const parsed = JSON.parse(h);
            return { role: parsed.role, content: parsed.content };
          } catch {
            return null;
          }
        }).filter((m: any) => m !== null);

        // Keep only relevant context
        if (skill.system_prompt) {
          // Remove old system prompts if they exist
          messages = messages.filter((m: any) => m.role !== 'system');
          // Add current skill context
          messages.unshift({
            role: 'system',
            content: skill.system_prompt
          });
        }
      } catch (error) {
        console.warn('Could not load Redis context:', error);
        messages = skill.system_prompt 
          ? [{ role: 'system', content: skill.system_prompt }]
          : [];
      }
    }

    // Add user message
    messages.push({ role: 'user', content: message });

    // Register tools (4 base tools like your SIMPLE_AI_AGENT)
    const tools = this.getTools();

    // Agentic loop - keep going while LLM wants to call tools
    while (iteration < this.MAX_ITERATIONS) {
      iteration++;

      try {
        // Call OpenRouter (like your callAPI method)
        const response = await this.callOpenRouter(messages, tools, skill.system_prompt);

        // Check if LLM wants to call tools
        // OpenRouter returns tool_calls in choices[0].message.tool_calls
        // Format: [{type: "function", id: "...", function: {name: "...", arguments: "..."}}]
        let calls = response.choices?.[0]?.message?.tool_calls;
        
        // Transform OpenRouter format if needed
        if (calls && calls.length > 0 && calls[0]?.type === 'function') {
          calls = calls.map(c => ({
            id: c.id,
            name: c.function?.name,
            arguments: c.function?.arguments
          }));
        }

        if (calls && calls.length > 0) {
          // Filter valid calls (must have name AND arguments)
          const validCalls = calls.filter(c => c.name && c.arguments);

          if (validCalls.length === 0) {
            // LLM returned broken tool calls - return fallback text
            const textContent = response.choices?.[0]?.message?.content || 'Unable to generate response';
            messages.push({
              role: 'assistant',
              content: textContent
            });
            continue;
          }

          // Execute each tool call
          for (const call of validCalls) {
            const t0 = Date.now();
            const toolName = call.name;
            const toolArgs = JSON.parse(call.arguments);

            console.log(`[Orchestrator] Executing tool: ${toolName}`);

            // Execute tool
            const result = await this.executeTool(toolName, toolArgs, userId, skillId, aiService);
            const durationMs = Date.now() - t0;

            toolResults.push({
              toolName,
              input: toolArgs,
              result,
              durationMs,
              success: true
            });

            // Add tool result to messages (using simplified format for OpenRouter compatibility)
            messages.push({
              role: 'user',
              content: `[Tool: ${toolName}] Result: ${typeof result === 'object' ? JSON.stringify(result) : result}`
            });
          }

          // Add assistant's tool call message (for debugging)
          messages.push({
            role: 'assistant',
            content: `Executed tool: ${validCalls.map(c => c.name).join(', ')}`
          });

          continue; // Keep loop - LLM will process tool results
        }

        // LLM satisfied - got final text response
        const finalText = response.choices?.[0]?.message?.content || 
                         response.content || 'No response generated';

        // Save to Redis context (Cooney's memory system)
        if (this.redisClient) {
          try {
            await this.saveContextToRedis(contextKey, messages);
          } catch (error) {
            console.warn('Could not save Redis context:', error);
          }
        }

        return {
          content: finalText,
          toolCalls: toolResults,
          iterations: iteration
        };

      } catch (error) {
        console.error('Orchestrator iteration error:', error);
        iteration++;
        
        // Save accumulated context even on error
        if (this.redisClient) {
          await this.saveContextToRedis(contextKey, messages).catch(() => {});
        }
        
        continue;
      }
    }

    throw new Error(`Max iterations (${this.MAX_ITERATIONS}) reached in agent loop`);
  }

  private getTools(): ToolDef[] {
    return [
      {
        name: 'web_search',
        description: 'Search the web for current information, references, and latest developments',
        parameters: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'What to search for online' }
          },
          required: ['query'],
          input_schema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' }
            },
            required: ['query']
          }
        }
      },
      {
        name: 'create_diagram',
        description: 'Generate ASCII/Unicode diagram to visualize concepts, processes, or structures',
        parameters: {
          type: 'object' as const,
          properties: {
            topic: { type: 'string', description: 'Subject to visualize' },
            style: {
              type: 'string',
              description: 'Diagram type: flow, hierarchy, process, cycle, mindmap, or general'
            }
          },
          required: ['topic'],
          input_schema: {
            type: 'object',
            properties: {
              topic: { type: 'string', description: 'What to diagram' },
              style: { type: 'string', description: 'Optional diagram style' }
            },
            required: ['topic']
          }
        }
      },
      {
        name: 'generate_quiz',
        description: 'Create multiple choice quiz questions to test understanding of a topic',
        parameters: {
          type: 'object' as const,
          properties: {
            topic: { type: 'string', description: 'What to quiz on' },
            count: {
              type: 'integer',
              description: 'Number of questions (3-10)',
              default: 5
            }
          },
          required: ['topic'],
          input_schema: {
            type: 'object',
            properties: {
              topic: { type: 'string', description: 'Quiz topic' },
              count: { type: 'integer', description: 'How many questions' }
            },
            required: ['topic']
          }
        }
      },
      {
        name: 'create_roadmap',
        description: 'Generate step-by-step learning path with milestones and resources',
        parameters: {
          type: 'object' as const,
          properties: {
            goal: { type: 'string', description: 'Learning objective or skill to master' },
            level: {
              type: 'string',
              description: 'Beginner, Intermediate, or Advanced',
              enum: ['Beginner', 'Intermediate', 'Advanced']
            }
          },
          required: ['goal'],
          input_schema: {
            type: 'object',
            properties: {
              goal: { type: 'string', description: 'Learning goal' },
              level: { type: 'string', enum: ['Beginner', 'Intermediate', 'Advanced'] }
            },
            required: ['goal']
          }
        }
      }
    ];
  }

  private async callOpenRouter(messages: any[], tools: ToolDef[], systemPrompt: string): Promise<OpenRouterResponse> {
    // Convert tools to OpenAI function format (like your callAPI)
    const functions = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }));

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Cooney Learning Assistant'
      },
      body: JSON.stringify({
        model: process.env.DEFAULT_MODEL || 'openai/gpt-oss-120b:free',
        max_tokens: 4096,
        messages,
        tools: functions.length ? functions : undefined,
        tool_choice: functions.length ? 'auto' : undefined
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter API error ${res.status}: ${err.substring(0, 200)}`);
    }

    return res.json();
  }

  private async executeTool(
    name: string,
    args: Record<string, any>,
    userId: string,
    skillId: string,
    aiService: AIService
  ): Promise<string | object> {
    const skillLoader = new SkillLoader();
    const skill = await skillLoader.getSkillById(skillId);

    if (!skill) {
      return { success: false, error: `Skill not found: ${skillId}` };
    }

    switch (name) {
      case 'web_search':
        return await this.searchWeb(args.query);

      case 'create_diagram':
        const diagramPrompt = `Create ASCII/Unicode ${args.style || 'diagram'} for: "${args.topic}". Educational and clear.`;
        const diagramResponse = await this.callAISimple(
          skill.system_prompt || diagramPrompt, 
          diagramPrompt
        );
        return diagramResponse || 'Diagram generation failed';

      case 'generate_quiz':
        const quizCount = args.count || 5;
        const quizPrompt = `Generate ${quizCount} multiple choice questions about "${args.topic}". Format as JSON array with question, options (A-D), correct_answer, and explanation.`;
        
        try {
          const quizResult = await this.callAISimple(
            skill.system_prompt || 'You are a quiz generator', 
            quizPrompt
          );
          const questions = JSON.parse(quizResult || '[]');
          return { success: true, questions, count: questions.length };
        } catch {
          return { success: false, raw: quizResult };
        }

      case 'create_roadmap':
        const levelText = args.level ? ` at ${args.level} level` : '';
        const roadmapPrompt = `Create step-by-step learning roadmap${levelText} for: "${args.goal}"`;
        
        const roadmapResult = await this.callAISimple(
          skill.system_prompt || roadmapPrompt, 
          roadmapPrompt
        );
        
        return roadmapResult || 'Roadmap generation failed';

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  }

  private async searchWeb(query: string): Promise<object> {
    try {
      const res = await fetch('http://localhost:7777/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, max_results: 5 })
      });
      const results = await res.json();
      return {
        success: true,
        query,
        results,
        summary: `${results.length} sources found`
      };
    } catch (e: any) {
      return { success: false, error: 'Search service unavailable', details: e.message };
    }
  }

  private async callAISimple(systemPrompt: string, userPrompt: string): Promise<string> {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Cooney Learning Assistant'
      },
      body: JSON.stringify({
        model: process.env.DEFAULT_MODEL || 'openai/gpt-oss-120b:free',
        max_tokens: 2048,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter API error ${res.status}: ${err.substring(0, 200)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || data.content || null;
  }

  private async saveContextToRedis(key: string, messages: any[]): Promise<void> {
    if (!this.redisClient) return;

    // Remove old context entries
    const existing = await this.redisClient.lRange(key, 0, -1);
    const startIdx = Math.max(0, existing.length - this.CONTEXT_WINDOW);
    const trimmed = existing.slice(startIdx);

    // Add new messages
    for (const msg of messages) {
      trimmed.push(JSON.stringify(msg));
    }

    // Keep last 20 messages (context window)
    const final = trimmed.slice(-this.CONTEXT_WINDOW);
    await this.redisClient.del(key);
    await this.redisClient.lPush(key, ...final);
    await this.redisClient.expire(key, 86400);
  }

  /**
   * Stream processing - yields response chunks as they arrive
   * Returns an async generator
   */
  async *processStream(userId: string, skillId: string, message: string): AsyncGenerator<any> {
    const skillLoader = new SkillLoader();
    const skill = await skillLoader.getSkillById(skillId);

    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    let iteration = 0;
    const toolResults: ToolResult[] = [];

    const contextKey = `chat:${userId}`;
    let messages: any[] = [];

    if (this.redisClient) {
      try {
        const history = await this.redisClient.lRange(contextKey, 0, -1);
        messages = history.map((h: any) => {
          try {
            const parsed = JSON.parse(h);
            return { role: parsed.role, content: parsed.content };
          } catch {
            return null;
          }
        }).filter((m: any) => m !== null);

        if (skill.system_prompt) {
          messages = messages.filter((m: any) => m.role !== 'system');
          messages.unshift({
            role: 'system',
            content: skill.system_prompt
          });
        }
      } catch (error) {
        messages = skill.system_prompt
          ? [{ role: 'system', content: skill.system_prompt }]
          : [];
      }
    }

    messages.push({ role: 'user', content: message });

    while (iteration < this.MAX_ITERATIONS) {
      iteration++;

      try {
        // For streaming, we need to collect all chunks first, then process
        // because tool calls need the complete response
        const stream = await this.callOpenRouterStream(messages, skill.system_prompt);

        let finalResponse: any = null;
        let buffer = '';
        
        for await (const chunk of stream) {
          buffer += chunk;
        }

        // Parse the accumulated SSE data into a complete response
        try {
          // Each chunk is a JSON object - we need to merge them
          // The final chunk has finish_reason set
          const chunks = buffer.trim().split('\n').map(l => l.replace(/^data: /, ''));
          const partialResponses = chunks
            .filter(c => c && c !== '[DONE]')
            .map(c => JSON.parse(c));
          
          // Merge all chunks into a single response
          finalResponse = this.mergeStreamChunks(partialResponses);
        } catch (parseError) {
          console.warn('Failed to parse stream chunks:', parseError);
          yield { type: 'error', data: { error: 'Failed to parse stream response' } };
          return;
        }

        // Check for tool calls
        const calls = finalResponse?.choices?.[0]?.message?.tool_calls;

        // Transform OpenRouter format
        let transformedCalls = calls;
        if (calls && calls.length > 0 && calls[0]?.type === 'function') {
          transformedCalls = calls.map((c: any) => ({
            id: c.id,
            name: c.function?.name,
            arguments: c.function?.arguments
          }));
        }

        if (transformedCalls && transformedCalls.length > 0) {
          const validCalls = transformedCalls.filter((c: any) => c.name && c.arguments);

          if (validCalls.length > 0) {
            for (const call of validCalls) {
              const toolName = call.name;
              let toolArgs;
              try {
                toolArgs = JSON.parse(call.arguments);
              } catch {
                toolArgs = {};
              }

              yield { type: 'tool_start', data: { toolName } };

              const result = await this.executeTool(toolName, toolArgs, userId, skillId);
              toolResults.push({ toolName, input: toolArgs, result, success: true });

              messages.push({
                role: 'user',
                content: `[Tool: ${toolName}] Result: ${typeof result === 'object' ? JSON.stringify(result) : result}`
              });

              yield { type: 'tool_end', data: { toolName, result } };
            }
            continue;
          }
        }

        // Final text response
        const finalText = finalResponse?.choices?.[0]?.message?.content || 'No response generated';
        yield { type: 'done', data: { content: finalText, toolResults, iterations: iteration } };

        // Save to Redis
        if (this.redisClient) {
          await this.saveContextToRedis(contextKey, [...messages, { role: 'assistant', content: finalText }]);
        }

        return;

      } catch (error: any) {
        console.error('Stream error:', error);
        yield { type: 'error', data: { error: error.message } };
        return;
      }
    }

    yield { type: 'done', data: { content: 'Max iterations reached', toolResults, iterations: this.MAX_ITERATIONS } };
  }

  /**
   * Merge SSE stream chunks into a complete response
   */
  private mergeStreamChunks(chunks: any[]): any {
    if (!chunks || chunks.length === 0) return null;
    
    // Start with the first chunk
    const merged = JSON.parse(JSON.stringify(chunks[0]));
    
    // Merge subsequent chunks
    for (let i = 1; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk.choices?.[0]?.delta) continue;
      
      const delta = chunk.choices[0].delta;
      const mergedChoice = merged.choices[0];
      
      // Merge content
      if (delta.content) {
        mergedChoice.message.content = (mergedChoice.message.content || '') + delta.content;
      }
      
      // Merge tool calls
      if (delta.tool_calls && delta.tool_calls.length > 0) {
        mergedChoice.message.tool_calls = mergedChoice.message.tool_calls || [];
        for (const tc of delta.tool_calls) {
          const existing = mergedChoice.message.tool_calls.find((t: any) => t.id === tc.id);
          if (existing) {
            existing.function.arguments = (existing.function.arguments || '') + (tc.function?.arguments || '');
          } else {
            mergedChoice.message.tool_calls.push(tc);
          }
        }
      }
      
      // Copy finish_reason from final chunk
      if (chunk.choices?.[0]?.finish_reason) {
        mergedChoice.finish_reason = chunk.choices[0].finish_reason;
      }
    }
    
    return merged;
  }

  private async callOpenRouterStream(messages: any[], systemPrompt: string): Promise<any> {
    const functions = this.getTools().map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }));

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Cooney Learning Assistant'
      },
      body: JSON.stringify({
        model: process.env.DEFAULT_MODEL || 'openai/gpt-oss-120b:free',
        max_tokens: 4096,
        messages,
        tools: functions,
        tool_choice: 'auto',
        stream: true
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter API error ${res.status}: ${err.substring(0, 200)}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    return {
      [Symbol.asyncIterator]: async function* () {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Handle SSE format: data: {...}\n\n
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6); // Remove 'data: ' prefix
              if (data === '[DONE]') continue;
              yield data + '\n';
            }
          }
        }
      }
    };
  }
}
