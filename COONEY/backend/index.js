#!/usr/bin/env node
/**
 * Cooney Backend Server - Plain JavaScript Entry Point
 */

const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');
const Database = require('better-sqlite3');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Import routes
const { setupApiRoutes } = require('./routes/api');

// Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Error:', err));

// SQLite database
const db = new Database(process.env.SQLITE_PATH || './data/cooney.db');

// Initialize DB tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, skill TEXT NOT NULL,
    level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  
  CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, skill TEXT NOT NULL,
    question TEXT NOT NULL, options TEXT, correct_answer TEXT NOT NULL,
    explanation TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS roadmaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL,
    title TEXT NOT NULL, goal TEXT NOT NULL, steps TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS diagrams (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL,
    skill TEXT NOT NULL, prompt TEXT NOT NULL, diagram TEXT NOT NULL
  );
`);

// Setup API routes
setupApiRoutes(app, redisClient, process.env.OPENROUTER_API_KEY || '', db, process.env.DEFAULT_MODEL || 'openai/gpt-oss-120b:free');

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
    console.log('🚀 Cooney Backend on port', PORT);
    console.log('📚 SQLite:', process.env.SQLITE_PATH || './data/cooney.db');
    console.log('🗨️  Redis:', process.env.REDIS_URL || 'redis://localhost:6379');
  });
});
