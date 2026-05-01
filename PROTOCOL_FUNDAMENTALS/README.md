# Protocol Fundamentals

**Context:** Communication protocols for AI agent interoperability.

## Model Context Protocol (MCP)

MCP is a standardized protocol for connecting AI models to external tools and resources.

### MCP Components

- **Tools**: Functions the model can call
- **Resources**: Readable data sources
- **Prompts**: Predefined conversation templates
- **Capabilities**: What the server can do

### Why MCP Matters

- Standardized tool interface for any LLM
- Hot-swap tools without changing model
- Decouples agent from specific model provider

## Other Relevant Protocols

### OpenAPI/Swagger
- API specification format
- Tool schema generation

### JSON-RPC / WebSocket
- Real-time communication patterns
- Streaming large responses

### Event-Driven Architectures
- Pub/sub for agent collaboration
- Async tool execution callbacks

## Protocol Design Principles

1. **Simplicity**: Easy to understand and implement
2. **Extensibility**: Grow without breaking changes
3. **Idempotency**: Safe to retry
4. **Error resilience**: Handle failures gracefully

---

*Protocols that enable AI agent communication.*
