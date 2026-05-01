import { AgentTool, AgentContext, ToolCallResult, HttpAdapterConfig, ToolAuth, ToolParam } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// HttpToolAdapter
//
// Extend this to create any API-backed tool. You only need to implement:
//   - name, description, category, params
//   - buildRequest(input, ctx) → { url, method, body?, extraHeaders? }
//   - parseResponse(status, body) → ToolCallResult
//
// Auth injection, retries, rate limiting, and timeouts are handled for you.
// ─────────────────────────────────────────────────────────────────────────────

export interface RequestSpec {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  extraHeaders?: Record<string, string>;
}

export abstract class HttpToolAdapter implements AgentTool {
  abstract name: string;
  abstract description: string;
  abstract category: string;
  abstract params: Record<string, ToolParam>;
  abstract auth?: ToolAuth;

  protected abstract config: HttpAdapterConfig;
  protected abstract buildRequest(input: Record<string, unknown>, ctx: AgentContext): RequestSpec;
  protected abstract parseResponse(status: number, body: unknown): ToolCallResult;

  async call(input: Record<string, unknown>, ctx: AgentContext): Promise<ToolCallResult> {
    const spec = this.buildRequest(input, ctx);
    const url = spec.url.startsWith('http') ? spec.url : `${this.config.baseUrl}${spec.url}`;
    const method = spec.method ?? 'POST';
    const timeout = this.config.timeout ?? 10_000;
    const retries = this.config.retries ?? 2;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.defaultHeaders,
      ...spec.extraHeaders,
    };

    // Inject auth from credential store
    if (this.auth && this.auth.type !== 'none' && this.auth.credentialKey) {
      const credential = ctx.credentials[this.auth.credentialKey];
      if (!credential) {
        return { success: false, error: `Missing credential "${this.auth.credentialKey}" for tool "${this.name}"` };
      }
      if (this.auth.type === 'bearer') headers['Authorization'] = `Bearer ${credential}`;
      if (this.auth.type === 'api_key') headers['X-API-Key'] = credential;
      if (this.auth.type === 'basic') headers['Authorization'] = `Basic ${btoa(credential)}`;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const res = await fetch(url, {
          method,
          headers,
          body: spec.body !== undefined ? JSON.stringify(spec.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timer);

        let body: unknown;
        const ct = res.headers.get('content-type') ?? '';
        body = ct.includes('application/json') ? await res.json() : await res.text();

        return { ...this.parseResponse(res.status, body), meta: { durationMs: 0, source: 'api' } };
      } catch (err) {
        lastError = err as Error;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1))); // exponential back-off
        }
      }
    }

    return { success: false, error: lastError?.message ?? 'Request failed', meta: { durationMs: 0, source: 'api' } };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Example: how to implement a REST API tool using the adapter
//
// export class WeatherTool extends HttpToolAdapter {
//   name = 'get_weather';
//   description = 'Get current weather for a city';
//   category = 'data';
//   params = {
//     city: { type: 'string' as const, description: 'City name', required: true },
//   };
//   auth = { type: 'api_key' as const, credentialKey: 'OPENWEATHER_KEY' };
//   protected config = { baseUrl: 'https://api.openweathermap.org/data/2.5' };
//
//   protected buildRequest(input: Record<string, unknown>, ctx: AgentContext) {
//     return {
//       url: `/weather?q=${input.city}&appid=${ctx.credentials['OPENWEATHER_KEY']}`,
//       method: 'GET' as const,
//     };
//   }
//
//   protected parseResponse(status: number, body: unknown): ToolCallResult {
//     if (status !== 200) return { success: false, error: `HTTP ${status}` };
//     const d = body as { name: string; main: { temp: number }; weather: { description: string }[] };
//     return { success: true, data: { city: d.name, temp: d.main.temp, description: d.weather[0].description } };
//   }
// }
// ─────────────────────────────────────────────────────────────────────────────
