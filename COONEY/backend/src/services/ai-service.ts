import { createClient } from 'redis';
import { SkillConfig } from './skill-loader';

export interface ChatOptions {
  userId: string;
  skill: SkillConfig;
  message: string;
  contextWindow: number;
  model?: string; // Optional model override
}

export class AIService {
  private redisClient: ReturnType<typeof createClient> | null = null;
  private openRouterKey: string;
  private defaultModel: string;

  constructor(
    redisClient: any,
    openRouterKey: string,
    defaultModel: string = 'mistralai/mistral-7b-instruct:free'
  ) {
    this.redisClient = redisClient;
    this.openRouterKey = openRouterKey;
    this.defaultModel = defaultModel;
  }

  async chat(options: ChatOptions): Promise<string> {
    const { userId, skill, message, contextWindow = 10, model } = options;

    // Get context from Redis
    const contextKey = `chat:${userId}`;
    const history = await this.getContextHistory(contextKey, contextWindow);

    // Build messages array
    const messages = [
      {
        role: 'system' as const,
        content: skill.system_prompt
      },
      ...history.map((m: any) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content
      })),
      { role: 'user' as const, content: message }
    ];

    // Use provided model or default
    const selectedModel = model || this.defaultModel;

    // Call OpenRouter API
    return await this.callOpenRouter(messages);
  }

  async callOpenRouter(messages: any[], tools?: any[]): Promise<{
    content?: string;
    choices?: { message?: { content: string }; tool_calls?: any[] }[];
  }> {
    const response = await fetch('https://api.openrouter.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://cooney.ai',
        'X-Title': 'Cooney Learning Buddy'
      },
      body: JSON.stringify({
        model: this.defaultModel,
        messages,
        ...(tools && tools.length > 0 && { tools })
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content,
      choices: data.choices,
      tool_calls: data.choices?.[0]?.tool_calls
    };
  }

  private async getContextHistory(key: string, limit: number): Promise<any[]> {
    if (!this.redisClient) return [];

    const items = await this.redisClient.lRange(key, 0, limit - 1);
    return items.map(item => JSON.parse(item)).reverse();
  }

  private async saveContext(key: string, role: 'user' | 'assistant', content: string) {
    if (!this.redisClient) return;

    await this.redisClient.lPush(key, JSON.stringify({ role, content }));
  }
}
