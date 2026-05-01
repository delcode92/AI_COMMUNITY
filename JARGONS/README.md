# AI Jargon Dictionary

**Context:** Essential terminology for understanding AI agent development.

## Core Terms

### Agent
An autonomous system that perceives its environment, makes decisions, and takes actions to achieve goals.

### Agentic Workflow
An iterative process where an LLM decides when and how to use tools, looping until a final response is generated.

### Function Calling / Tool Use
Mechanism for LLMs to output structured data that triggers external functions.

### RAG (Retrieval-Augmented Generation)
Technique that retrieves relevant context from external knowledge before generating responses.

### System Prompt
Instructions给 LLM about its role, behavior, and constraints.

### Context Window
The amount of conversation history the LLM can "remember" at once.

### Embedding
Numerical representation of text that captures semantic meaning.

### Tool Schema
JSON schema defining a tool's name, description, and parameters for LLM understanding.

### Orchestration
Managing the flow of agent decisions, tool calls, and responses.

## Concepts for AI Agents

- **Skill**: AI persona/context defined in configuration
- **Tool**: API endpoint for functionality
- **Trigger**: Condition that initiates tool execution
- **Circuit Breaker**: Fails gracefully when tool repeatedly fails
- **Idempotency**: Operation produces same result when repeated

---

*Terminology reference for AI agent development.*
