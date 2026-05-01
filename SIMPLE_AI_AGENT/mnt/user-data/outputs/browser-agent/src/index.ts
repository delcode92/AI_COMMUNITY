import { SkillRouter } from './core/skillRouter';
import { AgentOrchestrator } from './core/orchestrator';
import { WorkflowEngine } from './workflows/engine';
import { BrowserStorage } from './storage';
import { builtinTools } from './skills/builtins';

export { AgentTool, HttpAdapterConfig, ToolCallResult, Workflow, WorkflowStep, ChatMessage, AgentContext } from './core/types';
export { HttpToolAdapter } from './core/httpToolAdapter';
export { SkillRouter } from './core/skillRouter';
export { AgentOrchestrator } from './core/orchestrator';
export { BrowserStorage } from './storage';
export { builtinTools } from './skills/builtins';

// ─────────────────────────────────────────────────────────────────────────────
// createAgent — convenience factory that bootstraps the full platform
// ─────────────────────────────────────────────────────────────────────────────

export async function createAgent(config: {
  apiKey: string;
  systemPrompt?: string;
  extraTools?: import('./core/types').AgentTool[];
}): Promise<AgentOrchestrator> {
  const storage = new BrowserStorage();
  await storage.init();

  const router = new SkillRouter();
  router.registerMany(builtinTools);
  if (config.extraTools) router.registerMany(config.extraTools);

  const engine = new WorkflowEngine(router, storage);

  return new AgentOrchestrator(
    router,
    engine,
    storage,
    config.apiKey,
    config.systemPrompt
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage example (run in browser console or a Vite/webpack project):
//
// import { createAgent, HttpToolAdapter } from './src';
//
// // 1. Create an API-backed tool
// class JokeApi extends HttpToolAdapter {
//   name = 'get_joke';
//   description = 'Get a random programming joke';
//   category = 'fun';
//   params = {};
//   auth = undefined;
//   protected config = { baseUrl: 'https://official-joke-api.appspot.com' };
//   protected buildRequest() { return { url: '/jokes/programming/random', method: 'GET' as const }; }
//   protected parseResponse(status: number, body: unknown) {
//     if (status !== 200) return { success: false, error: `HTTP ${status}` };
//     const [j] = body as { setup: string; punchline: string }[];
//     return { success: true, data: { setup: j.setup, punchline: j.punchline } };
//   }
// }
//
// // 2. Boot the agent
// const agent = await createAgent({
//   apiKey: 'sk-ant-...',
//   extraTools: [new JokeApi()],
// });
//
// // 3. Chat
// const reply = await agent.chat('Tell me a programming joke', 'my-session');
// console.log(reply);
//
// // 4. Or run a workflow
// const run = await agent.runWorkflow({
//   id: 'demo',
//   name: 'Date + count demo',
//   description: '',
//   steps: [
//     { id: 'get-date', toolName: 'date_utils', input: { operation: 'now' } },
//     { id: 'count',    toolName: 'text_utils', input: (prev) => ({
//         operation: 'word_count',
//         text: JSON.stringify(prev[0].result.data),
//     })},
//   ],
// }, 'my-session');
// console.log(run);
// ─────────────────────────────────────────────────────────────────────────────
