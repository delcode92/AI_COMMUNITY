import { Application, Request, Response } from 'express';
import { SkillLoader } from '../services/skill-loader';
import { AIService } from '../services/ai-service';
import { AgentOrchestrator } from '../services/orchestrator';
import Database from 'better-sqlite3';

export function setupApiRoutes(
  app: Application,
  redisClient: any,
  openRouterKey: string,
  db: Database.Database,
  defaultModel: string = 'openai/gpt-oss-120b:free'
) {
  const skillLoader = new SkillLoader();
  const aiService = new AIService(redisClient, openRouterKey, defaultModel);
  const orchestrator = new AgentOrchestrator(aiService, redisClient);

  // Add models endpoint
  app.get('/api/models', (req: Request, res: Response) => {
    res.json({
      openrouter: [
        'openai/gpt-oss-120b:free',
        'microsoft/Phi-3.5-mini-instruct',
        'anthropic/claude-3-haiku-20240307',
        'google/gemma-7b-it',
        'cohere/command-r',
      ],
    });
  });

  // Get available skills
  app.get('/api/skills', async (req: Request, res: Response) => {
    try {
      const skills = await skillLoader.loadAll();
      res.json(skills.map(s => ({
        id: s.file || s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: s.name,
        description: s.description
      })));
    } catch (error) {
      res.status(500).json({ error: 'Failed to load skills' });
    }
  });

  // Get skill details
  app.get('/api/skills/:id', async (req: Request, res: Response) => {
    const skillId = req.params.id.toLowerCase();
    const config = await skillLoader.getSkillById(skillId);
    
    if (!config) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    
    res.json(config);
  });

  // Create custom skill via AI
  app.post('/api/skills/create', async (req: Request, res: Response) => {
    const { message, userId } = req.body;

    if (!message || !userId) {
      return res.status(400).json({ error: 'Message and userId required' });
    }

    try {
      const skill = await skillLoader.getSkillById('ai-ml');
      const prompt = `Create a new skill definition. Return YAML with name, description, version, and system_prompt only.`;

      const result = await orchestrator.process(userId, 'ai-ml', prompt);

      res.json({ skillYaml: result.content });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to create skill' });
    }
  });

  // Save custom skill (user confirms generated skill)
  app.post('/api/skills/save', async (req: Request, res: Response) => {
    const { name, description, system_prompt, userId } = req.body;

    if (!name || !description || !system_prompt) {
      return res.status(400).json({ error: 'name, description, and system_prompt required' });
    }

    try {
      const yaml = `name: ${name}
description: ${description}
version: 1.0.0

system_prompt: |
  ${system_prompt.replace(/\n+/g, '\n  ')}`;
      
      const fs = require('fs');
      const path = require('path');
      const customPath = path.join(__dirname, '../../skills/custom');
      
      if (!fs.existsSync(customPath)) {
        fs.mkdirSync(customPath, { recursive: true });
      }
      
      const filename = `${name.toLowerCase().replace(/\s+/g, '-')}.md`;
      fs.writeFileSync(path.join(customPath, filename), yaml);

      res.json({ success: true, filename, message: `Skill "${name}" saved to custom skills` });
    } catch (error: any) {
      res.status(500).json({ error: `Failed to save skill: ${error.message}` });
    }
  });

  // Main chat (with agent orchestration loop)
  app.post('/api/chat', async (req: Request, res: Response) => {
    const { message, skillId, userId, model } = req.body;

    if (!message || !skillId || !userId) {
      return res.status(400).json({ error: 'Message, skillId, and userId required' });
    }

    try {
      const result = await orchestrator.process(userId, skillId, message);
      
      res.json({
        reply: result.content,
        toolCalls: result.toolCalls,
        iterations: result.toolCalls.length
      });
    } catch (error: any) {
      console.error('Chat orchestrator error:', error);
      res.status(500).json({ error: 'Orchestration failed', details: error.message });
    }
  });

  // Streaming chat endpoint
  app.get('/api/chat/stream', async (req: Request, res: Response) => {
    const { message, skillId, userId } = req.query;

    if (!message || !skillId || !userId) {
      return res.status(400).json({ error: 'Message, skillId, and userId required' });
    }

    try {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      const stream = orchestrator.processStream(userId, skillId, message as string);

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      res.end();
    } catch (error: any) {
      console.error('Stream error:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', data: { error: error.message } })}\n\n`);
      res.end();
    }
  });

  // Quiz generation
  app.post('/api/quiz', async (req: Request, res: Response) => {
    const { message, skillId, userId, quizCount = 5 } = req.body;

    if (!message || !skillId) {
      return res.status(400).json({ error: 'Message and skillId required' });
    }

    try {
      const skill = await skillLoader.getSkillById(skillId);
      if (!skill) {
        return res.status(404).json({ error: `Skill not found: ${skillId}` });
      }
      
      const prompt = `Generate ${quizCount} multiple choice quiz questions about: ${message}. Format as JSON array with question, options (A-D), correct_answer, and explanation for each.`;

      const quizJson = await aiService.chat({
        userId,
        skill,
        message: prompt,
        contextWindow: 10
      });

      // Parse JSON (simplified - in production add error handling)
      try {
        const questions = JSON.parse(quizJson);

        // Save to SQLite
        const insertQuiz = db.prepare(`
          INSERT INTO quizzes (user_id, skill, question, options, correct_answer, explanation)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const q of questions) {
          insertQuiz.run(userId, skillId, q.question, JSON.stringify(q.options), q.correct_answer, q.explanation || '');
        }

        res.json({ questions });
      } catch {
        res.json({ raw: quizJson, error: 'Could not parse quiz as JSON' });
      }
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to generate quiz' });
    }
  });

  // Roadmap generation
  app.post('/api/roadmap', async (req: Request, res: Response) => {
    const { message, skillId, userId, goal } = req.body;

    if (!message || !skillId) {
      return res.status(400).json({ error: 'Message and skillId required' });
    }

    try {
      const skill = await skillLoader.getSkillById(skillId);
      if (!skill) {
        return res.status(404).json({ error: `Skill not found: ${skillId}` });
      }
      
      const prompt = `Create a step-by-step learning roadmap for: ${message}. Goal: ${goal || 'Master this topic'}. Include 5-10 steps with descriptions.`;

      const roadmap = await aiService.chat({
        userId,
        skill,
        message: prompt,
        contextWindow: 10
      });

      // Save to SQLite
      const stmt = db.prepare(`
        INSERT INTO roadmaps (user_id, title, goal, steps, steps)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(userId, 'New Learning Roadmap', goal || message, roadmap, '[]');

      res.json({ roadmap });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to generate roadmap' });
    }
  });

  // Diagram generation (ASCII/Unicode)
  app.post('/api/diagram', async (req: Request, res: Response) => {
    const { message, skillId, userId } = req.body;

    if (!message || !skillId) {
      return res.status(400).json({ error: 'Message and skillId required' });
    }

    try {
      const skill = await skillLoader.getSkillById(skillId);
      if (!skill) {
        return res.status(404).json({ error: `Skill not found: ${skillId}` });
      }
      
      const prompt = `Create a text-based diagram (ASCII/Unicode art) to visualize: ${message}. Make it clear and educational.`;

      const diagram = await aiService.chat({
        userId,
        skill,
        message: prompt,
        contextWindow: 10
      });

      // Save to SQLite
      db.prepare(`
        INSERT INTO diagrams (user_id, skill, prompt, diagram)
        VALUES (?, ?, ?, ?)
      `).run(userId, skillId, prompt, diagram);

      res.json({ diagram });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to generate diagram' });
    }
  });

  // Web search
  app.post('/api/search', async (req: Request, res: Response) => {
    const { query, skillId, userId } = req.body;

    if (!query || !skillId) {
      return res.status(400).json({ error: 'Query and skillId required' });
    }

    try {
      // Call DuckDuckGo search service
      const response = await fetch('http://localhost:7777/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, max_results: 10 })
      });

      if (!response.ok) throw new Error('Search service error');

      const results = await response.json();

      // Save to SQLite
      const stmt = db.prepare(`
        INSERT INTO progress (user_id, skill, xp) VALUES (?, ?, ?)
        ON CONFLICT(user_id, skill) DO UPDATE SET xp = progress.xp + ?, updated_at = CURRENT_TIMESTAMP
      `);
      stmt.run(userId, skillId, 10, 10);

      const skill = await skillLoader.getSkillById(skillId);

      // Summarize results
      const summary = await aiService.chat({
        userId,
        skill,
        message: `Summarize these search results into key learning points:\n\n${JSON.stringify(results)}`,
        contextWindow: 20
      });

      res.json({ results, summary });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Failed to search' });
    }
  });
}
