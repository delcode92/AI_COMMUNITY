# Cooney - Learning Buddy

**Cooney** is an AI-powered learning companion that helps users master Science, Math, Physics, Programming, and AI/ML through interactive conversations, diagrams, quizzes, and personalized roadmaps.

## Key Features
- **Skill-based Learning**: Switch between 5 focus areas (Science, Math, Physics, Programming, AI/ML)
- **Web Search & Summarize**: Find and summarize learning resources from the web
- **Diagram Generation**: Create markup-based diagrams from text descriptions
- **Quiz System**: Generate quizzes to test understanding
- **Roadmap Generator**: Create personalized learning paths
- **Progress Tracking**: SQLite database for user progress and achievements
- **Context Memory**: Redis-powered chat history and context windows

# Cooney - Learning Buddy Phases

## Phase 1: Core Chat Interface
- [ ] Basic chat UI with message display
- [ ] Skill dropdown selector (Science, Math, Physics, Programming, AI/ML)
- [ ] Simple text input and send button
- [ ] Mock responses for each skill

## Phase 2: Backend Setup
- [ ] Express.js server setup
- [ ] API routes for chat endpoints
- [ ] SQLite database for user progress tracking
- [ ] Basic user session management

## Phase 3: AI Integration
- [ ] Connect to AI API (OpenRouter/Groq)
- [ ] Skill-based prompt engineering
- [ ] Streaming responses

## Phase 4: Web Search & Summarize
- [ ] Web scraping/s_search integration
- [ ] Content summarization
- [ ] Source attribution

## Phase 5: Diagram Generation
- [ ] Text-to-markup diagram prompts
- [ ] Render diagrams in chat (ASCII/Unicode)
- [ ] Save diagram history

## Phase 6: Quiz System
- [ ] AI-generated quiz questions
- [ ] Quiz display and results
- [ ] Progress tracking in SQLite

## Phase 7: Roadmap Generator
- [ ] User goal input
- [ ] AI-powered roadmap creation
- [ ] Display as interactive steps
- [ ] Save roadmap progress to SQLite

## Phase 8: Deployment
- [ ] Production build
- [ ] Hosting setup
- [ ] Environment variables

## Phase 9: Context Memory (Redis)
- [ ] Redis server setup
- [ ] Chat history storage
- [ ] Context window management
- [ ] Memory decay configuration

## Backend Stack
- **Runtime**: Node.js (Express.js)
- **Frontend**: Next.js (API proxy for CORS resolution)
- **Database**: SQLite (for user progress, quizzes, roadmaps)
- **Cache**: Redis (context windows, chat memory)
- **AI API**: OpenRouter/Groq
- **Search**: Python tools (ddgs) via API calls

## AI Agent Workflows

### Skill Router
When user selects a skill, the agent routes to appropriate workflow:
- **Science**: Research → Explain → Diagram → Quiz
- **Math**: Problem → Solve → Visualize → Practice
- **Physics**: Concept → Example → Simulation → Test
- **Programming**: Code → Debug → Optimize → Quiz
- **AI/ML**: Theory → Example → Code → Project

### Tools Pipeline
1. **Web Search**: DuckDuckGo API for current information
2. **Summarize**: AI condenses search results
3. **Diagram**: Convert explanations to markup diagrams
4. **Quiz**: Generate multiple-choice questions
5. **Roadmap**: Create step-by-step learning paths

### Skill-based Prompts
Each skill has dedicated system prompts:
- **Science**: Focus on experimental method and evidence
- **Math**: Emphasize problem-solving and logical reasoning
- **Physics**: Connect concepts to real-world phenomena
- **Programming**: Code examples and best practices
- **AI/ML**: Theory with practical applications

### Context Memory (Redis)
- **Chat History**: Store last 100 messages per user session
- **Context Windows**: 4K token sliding window for relevance
- **Memory Decay**: Auto-expire old conversations after 24h
- **Session Management**: User-specific Redis keys for isolation

### API Proxy (Next.js)
- **CORS Resolution**: Proxy backend requests through Next.js API routes
- **Environment Abstraction**: Hide API keys and endpoints from client
- **Request Rewriting**: Rewrite external API calls to internal routes
- **Rate Limiting**: Implement request throttling at proxy layer