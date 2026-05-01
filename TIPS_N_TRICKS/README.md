# Tips & Tricks for AI Development

**Context:** Practical shortcuts and problem-solving techniques.

## Development Tips

### Debugging Agent Loops
- Add verbose logging for tool calls
- Limit max turns to prevent infinite loops
- Use dry-run mode to test tool schemas

### Prompt Engineering Shortcuts
- Few-shot examples boost consistency
- Chain-of-thought prompts improve reasoning
- Role prompts set appropriate behavior

### Cost Optimization
- Cache frequent tool results
- Use smaller models for simple tasks
- Pre-compute embeddings for static docs

### Testing Strategies
- Mock LLM responses for deterministic tests
- Record real conversations for regression
- Test edge cases: empty input, very long input

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Infinite tool calls | Set max_iterations limit |
| Hallucinations | Add factual constraint in system prompt |
| Slow responses | Enable caching, batch requests |
| Cost spike | Implement cost tracking per conversation |
| Context errors | Implement summarization for long chats |

## Productivity Hacks

- Use TypeScript for safer refactors
- Build tool schemas first, tests second
- Keep system prompts in separate files
- Version control model configurations

---

*Practical tips for AI agent development.*
