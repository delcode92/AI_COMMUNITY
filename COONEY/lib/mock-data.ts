/**
 * Mock data for Cooney
 * In production, this will be replaced with real API calls
 */

export interface Message {
  id: string
  content: string
  sender: 'user' | 'cooney'
  timestamp: Date
  toolCalls?: any[]
}

export interface Skill {
  id: string
  name: string
  description: string
  createdAt: Date
}

// Mock skills for frontend display
export const mockSkills: Skill[] = [
  { id: 'ai/ml-guide', name: 'AI/ML Guide', description: 'Understand artificial intelligence and machine learning', createdAt: new Date() },
  { id: 'math-tutor', name: 'Math Tutor', description: 'Understand mathematical concepts and solve problems', createdAt: new Date() },
  { id: 'physics-explorer', name: 'Physics Explorer', description: 'Learn about forces, motion, energy, and the physical world', createdAt: new Date() },
  { id: 'coding-coach', name: 'Coding Coach', description: 'Learn programming concepts and build applications', createdAt: new Date() },
  { id: 'science-guide', name: 'Science Guide', description: 'Explore scientific concepts, experiments, and discoveries', createdAt: new Date() },
]

// Mock tools for frontend display
export interface Tool {
  id: string
  name: string
  description: string
  icon: string
}

export const mockTools: Tool[] = [
  { id: 'file-reader', name: 'File Reader', description: 'Read and analyze files from your local system', icon: '📁' },
  { id: 'web-search', name: 'Web Search', description: 'Search the web for current information and documentation', icon: '🌐' },
  { id: 'code-executor', name: 'Code Executor', description: 'Run code snippets in multiple programming languages', icon: '💻' },
  { id: 'math-calculator', name: 'Math Calculator', description: 'Perform complex mathematical calculations and visualizations', icon: '🔢' },
  { id: 'image-generator', name: 'Image Generator', description: 'Create images from text descriptions using AI', icon: '🎨' },
  { id: 'data-analyzer', name: 'Data Analyzer', description: 'Analyze data sets and generate insights', icon: '📊' },
]

// Load skills from API instead of hardcoding
export async function loadSkills() {
  try {
    const response = await fetch('/api/skills')
    if (response.ok) {
      return await response.json()
    }
  } catch (error) {
    console.error('Failed to load skills:', error)
  }
  
  // Fallback to defaults if API fails
  return [
    { id: 'ai/ml-guide', name: 'AI/ML Guide', description: 'Understand artificial intelligence and machine learning' },
    { id: 'math-tutor', name: 'Math Tutor', description: 'Understand mathematical concepts and solve problems' },
    { id: 'physics-explorer', name: 'Physics Explorer', description: 'Learn about forces, motion, energy, and the physical world' },
    { id: 'coding-coach', name: 'Coding Coach', description: 'Learn programming concepts and build applications' },
    { id: 'science-guide', name: 'Science Guide', description: 'Explore scientific concepts, experiments, and discoveries' },
  ]
}

// Mock initial messages
export const mockMessages: Message[] = [
  {
    id: '1',
    content: '👋 Hi! I\'m Cooney, your AI learning companion. Select a skill above to get started!',
    sender: 'cooney',
    timestamp: new Date(),
  },
]

// Default skill (first one)
export const defaultSkill = async () => {
  const skills = await loadSkills()
  return skills[0]?.id || 'ai/ml-guide'
}
