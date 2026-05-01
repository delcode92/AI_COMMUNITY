'use client'

import { useState } from 'react'
import { Trash2, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { mockSkills, type Skill } from '@/lib/mock-data'

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>(mockSkills)
  const [open, setOpen] = useState(false)
  const [skillName, setSkillName] = useState('')
  const [skillDescription, setSkillDescription] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const handleDeleteSkill = (id: string) => {
    setSkills(skills.filter((skill) => skill.id !== id))
  }

  const handleCreateSkill = () => {
    if (!skillName.trim() || !skillDescription.trim()) return

    const newSkill: Skill = {
      id: Date.now().toString(),
      name: skillName,
      description: skillDescription,
      createdAt: new Date(),
    }

    setSkills([...skills, newSkill])
    setSkillName('')
    setSkillDescription('')
    setAiPrompt('')
    setOpen(false)
  }

  const handleAiGenerate = () => {
    if (!skillDescription.trim()) return

    setIsGenerating(true)

    // Simulate AI generation of skill name from description
    setTimeout(() => {
      const skillNameSuggestions: Record<string, string[]> = {
        math: ['Calculus Master', 'Math Wizard', 'Algebra Expert', 'Number Crunchor'],
        physics: ['Physics Guide', 'Science Explainer', 'Quantum Helper', 'Motion Master'],
        language: ['Language Pro', 'Grammar Guide', 'Vocabulary Builder', 'Speech Coach'],
        history: ['History Expert', 'Timeline Guide', 'Era Specialist', 'Story Keeper'],
        writing: ['Writing Coach', 'Story Crafter', 'Essay Expert', 'Creative Writer'],
        coding: ['Code Mentor', 'Programming Guide', 'Developer Helper', 'Debug Expert'],
        default: ['Learning Master', 'Skill Expert', 'Knowledge Guide', 'Smart Tutor'],
      }

      let categoryKey = 'default'
      const descLower = skillDescription.toLowerCase()
      if (descLower.includes('math') || descLower.includes('calculus')) categoryKey = 'math'
      else if (descLower.includes('physics') || descLower.includes('science')) categoryKey = 'physics'
      else if (descLower.includes('language') || descLower.includes('english')) categoryKey = 'language'
      else if (descLower.includes('history') || descLower.includes('era')) categoryKey = 'history'
      else if (descLower.includes('writing') || descLower.includes('story')) categoryKey = 'writing'
      else if (descLower.includes('code') || descLower.includes('program')) categoryKey = 'coding'

      const suggestions = skillNameSuggestions[categoryKey]
      const generatedName = suggestions[Math.floor(Math.random() * suggestions.length)]

      setSkillName(generatedName)
      setIsGenerating(false)
    }, 1200)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#2D3E50] mb-2">Skills Management</h1>
          <p className="text-gray-600">Create and customize Cooney&apos;s learning skills</p>
        </div>

        {/* Create Skill Button */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="mb-8 bg-[#1DD7C0] hover:bg-[#16bfaa] text-[#2D3E50] font-semibold gap-2">
              <Plus size={20} />
              Create New Skill
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create a New Skill</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Skill Name */}
              <div>
                <label className="block text-sm font-medium text-[#2D3E50] mb-2">
                  Skill Name
                </label>
                <Input
                  placeholder="e.g., Math Tutor"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  className="border-gray-300"
                />
              </div>

              {/* Skill Description */}
              <div>
                <label className="block text-sm font-medium text-[#2D3E50] mb-2">
                  Skill Description
                </label>
                <Input
                  placeholder="What does this skill do?"
                  value={skillDescription}
                  onChange={(e) => setSkillDescription(e.target.value)}
                  className="border-gray-300"
                />
              </div>

              {/* AI Helper with Magic Wand */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleAiGenerate}
                  disabled={isGenerating || !skillDescription.trim()}
                  className="flex-1 bg-[#1DD7C0] hover:bg-[#16bfaa] text-[#2D3E50] gap-2"
                  title="Generate skill with AI based on description"
                >
                  <Sparkles size={18} />
                  {isGenerating ? 'Generating...' : 'Auto-Fill'}
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpen(false)
                    setSkillName('')
                    setSkillDescription('')
                    setIsGenerating(false)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateSkill}
                  disabled={!skillName.trim() || !skillDescription.trim()}
                  className="bg-[#2D3E50] hover:bg-[#1a2632] text-white"
                >
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Skills Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skills.map((skill) => (
            <Card
              key={skill.id}
              className="hover:shadow-lg transition-shadow border border-gray-200 hover:border-[#1DD7C0]"
            >
              <div className="p-6">
                <h3 className="font-bold text-lg text-[#2D3E50] mb-2">{skill.name}</h3>
                <p className="text-gray-600 text-sm mb-4">{skill.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {skill.createdAt.toLocaleDateString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteSkill(skill.id)}
                    className="text-red-500 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {skills.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No skills yet. Create one to get started!</p>
          </div>
        )}
      </div>
    </div>
  )
}
