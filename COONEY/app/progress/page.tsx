'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'

export default function ProgressPage() {
  const [activeTab, setActiveTab] = useState<'stats' | 'quiz' | 'roadmap'>('stats')

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-[#2D3E50] mb-2">Your Learning Progress</h1>
        <p className="text-gray-600 mb-8">Track your XP, quizzes, and learning roadmaps</p>

        <div className="grid grid-cols-3 gap-6">
          <ProgressSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
          <ProgressContent activeTab={activeTab} />
        </div>
      </div>
    </div>
  )
}

function ProgressSidebar({ activeTab, setActiveTab }) {
  return (
    <Card className="bg-white border-gray-200 p-6 h-fit">
      <h3 className="font-semibold text-gray-700 mb-4">Progress</h3>
      <nav className="space-y-2">
        <button
          className={`w-full text-left px-4 py-3 font-medium rounded-lg transition-colors ${
            activeTab === 'stats'
              ? 'bg-[#1DD7C0] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Overall Stats
        </button>
        <button
          className={`w-full text-left px-4 py-3 font-medium rounded-lg transition-colors ${
            activeTab === 'quiz'
              ? 'bg-[#1DD7C0] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('quiz')}
        >
          📝 Quiz History
        </button>
        <button
          className={`w-full text-left px-4 py-3 font-medium rounded-lg transition-colors ${
            activeTab === 'roadmap'
              ? 'bg-[#1DD7C0] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('roadmap')}
        >
          🗺️ My Roadmaps
        </button>
      </nav>
    </Card>
  )
}

function ProgressContent({ activeTab }) {
  if (activeTab === 'stats') {
    return <StatsPanel />
  }
  if (activeTab === 'quiz') {
    return <QuizPanel />
  }
  if (activeTab === 'roadmap') {
    return <RoadmapPanel />
  }
}

function StatsPanel() {
  return (
    <Card className="bg-white border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-[#2D3E50] mb-6">Overall Statistics</h2>
      
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="text-center p-6 bg-gray-50 rounded-xl">
          <div className="text-4xl font-bold text-[#1DD7C0] mb-2">0</div>
          <div className="text-sm text-gray-600">Total XP</div>
        </div>
        <div className="text-center p-6 bg-gray-50 rounded-xl">
          <div className="text-4xl font-bold text-[#1DD7C0] mb-2">0</div>
          <div className="text-sm text-gray-600">Quizzes Taken</div>
        </div>
        <div className="text-center p-6 bg-gray-50 rounded-xl">
          <div className="text-4xl font-bold text-[#1DD7C0] mb-2">0</div>
          <div className="text-sm text-gray-600">Roadmaps Created</div>
        </div>
        <div className="text-center p-6 bg-gray-50 rounded-xl">
          <div className="text-4xl font-bold text-[#1DD7C0] mb-2">0</div>
          <div className="text-sm text-gray-600">Diagrams Created</div>
        </div>
      </div>

      <h3 className="font-semibold text-gray-700 mb-4">Progress by Skill</h3>
      <div className="space-y-4">
        {['Science', 'Math', 'Physics', 'Programming', 'AI/ML'].map((skill, i) => (
          <div key={skill} className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700">{skill}</span>
              <span className="text-gray-500">Level {i + 1} • {i * 100} XP</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#1DD7C0] to-[#16bfaa] transition-all duration-500"
                style={{ width: `${i * 20}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function QuizPanel() {
  return (
    <Card className="bg-white border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-[#2D3E50] mb-6">Quiz History</h2>
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📝</div>
        <h3 className="text-xl font-medium text-gray-700 mb-2">No quizzes taken yet</h3>
        <p className="text-gray-500">Start learning and generating quizzes to see your history here!</p>
      </div>
    </Card>
  )
}

function RoadmapPanel() {
  return (
    <Card className="bg-white border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-[#2D3E50] mb-6">My Learning Roadmaps</h2>
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🗺️</div>
        <h3 className="text-xl font-medium text-gray-700 mb-2">No roadmaps created yet</h3>
        <p className="text-gray-500">Use the Roadmap tool to create personalized learning paths!</p>
      </div>
    </Card>
  )
}
