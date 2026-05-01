#!/usr/bin/env node
/**
 * Cooney Backend Server
 * Plain JavaScript - no TypeScript needed!
 */

const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Create Express router
const { setupApiRoutes } = require('./dist/routes/api.js');

// Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

// SQLite database
const db = new Database(process.env.SQLITE_PATH || './data/cooney.db');

// Initialize DB tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    skill TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    mastered_concepts TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  
  CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    skill TEXT NOT NULL,
    question TEXT NOT NULL,
    options TEXT,
    correct_answer TEXT NOT NULL,
    user_answer TEXT,
    is_correct INTEGER DEFAULT 0,
    explanation TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  
  CREATE TABLE IF NOT EXISTS roadmaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    goal TEXT NOT NULL,
    steps TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    current_step INTEGER DEFAULT 0,
    completed_steps INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  
  CREATE TABLE IF NOT EXISTS diagrams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    skill TEXT NOT NULL,
    prompt TEXT NOT NULL,
    diagram TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    skill TEXT,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Setup API routes
setupApiRoutes(
  app,
  redisClient,
  process.env.OPENROUTER_API_KEY || '',
  db,
  process.env.DEFAULT_MODEL || 'openai/gpt-oss-120b:free'
);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    redis: true,
    db: 'connected',
    sqlitePath: process.env.SQLITE_PATH || './data/cooney.db'
  });
});

// Start server
redisClient.connect().then(() => {
  console.log('Redis connected');
  app.listen(PORT, () => {
    console.log(`🚀 Cooney Backend on port ${PORT}`);
    console.log(`📚 SQLite: ${process.env.SQLITE_PATH || './data/cooney.db'}`);
    console.log(`🗨️  Redis: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
  });
});
