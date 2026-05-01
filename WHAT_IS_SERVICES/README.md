# What Are Services

**Context:** Understanding service architecture for AI agent systems.

## Service Patterns

### Microservices for AI
- **Chat Service**: Handles user conversations
- **Tool Service**: Manages tool registrations and execution
- **Memory Service**: Manages conversation history and context
- **Skill Service**: Loads and validates skill configurations
- **Embedding Service**: Generates and manages embeddings

### Monolith vs Microservices
- **Monolith**: Simpler deployment, shared memory (good for small agents)
- **Microservices**: Better scaling, isolated failures (good for production)

## Service Communication

- **RPC**: Direct function calls between services
- **HTTP APIs**: RESTful interface for tools
- **Message Queue**: For async tool execution
- **WebSocket**: For streaming responses

## Deploying AI Services

### Containerization
- Docker/Podman for consistent environments
- Resource limits for GPU/memory

### Orchestration
- Kubernetes for scaling
- Service mesh for observability
- Secret management for API keys

## Monitoring Services

- Health checks for each service
- Metrics: latency, throughput, error rates
- Tracing: request flow across services
- Logging: structured, centralized logs

---

*Service architecture concepts for AI agents.*
