'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'

export function ProgressPanel() {
  const [activeTab, setActiveTab] = useState<'stats' | 'quiz' | 'roadmap'>('stats')

  return (
    <Card className="bg-white border-gray-200 p-6">
      <div className="flex gap-4 border-b border-gray-200 mb-4">
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'stats'
              ? 'bg-[#1DD7C0] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Stats
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'quiz'
              ? 'bg-[#1DD7C0] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('quiz')}
        >
          📝 Quizzes
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'roadmap'
              ? 'bg-[#1DD7C0] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('roadmap')}
        >
          🗺️ Roadmaps
        </button>
      </div>

      {activeTab === 'stats' && <StatsPanel />}
      {activeTab === 'quiz' && <QuizPanel />}
      {activeTab === 'roadmap' && <RoadmapPanel />}
    </Card>
  )
}

function StatsPanel() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="text-3xl font-bold text-[#1DD7C0]">0</div>
          <div className="text-sm text-gray-600">Total XP</div>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="text-3xl font-bold text-[#1DD7C0]">0</div>
          <div className="text-sm text-gray-600">Quizzes Taken</div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-gray-700">Progress by Skill</h4>
        {['Science', 'Math', 'Physics', 'Programming', 'AI/ML'].map((skill, i) => (
          <div key={skill} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{skill}</span>
              <span className="text-gray-500">Level {i + 1} • {i * 100} XP</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1DD7C0] transition-all duration-500"
                style={{ width: `${i * 20}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuizPanel() {
  return (
    <div className="space-y-3">
      <div className="text-center text-gray-500 py-8">
        <p className="text-sm">No quizzes taken yet. Start learning to generate quizzes!</p>
      </div>
    </div>
  )
}

function RoadmapPanel() {
  return (
    <div className="space-y-3">
      <div className="text-center text-gray-500 py-8">
        <p className="text-sm">No roadmaps created yet. Create a learning roadmap to get started!</p>
      </div>
    </div>
  )
}
