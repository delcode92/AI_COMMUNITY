'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, PlusCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ThinkingIndicator } from '@/components/thinking-indicator'
import { mockMessages, loadSkills, defaultSkill, type Message } from '@/lib/mock-data'

export default function Dashboard() {
  const [messages, setMessages] = useState<Message[]>(mockMessages)
  const [input, setInput] = useState('')
  const [selectedSkill, setSelectedSkill] = useState<string>('') // Will be set by useEffect
  const [isThinking, setIsThinking] = useState(false)
  const [userId] = useState(() => `user-${Date.now()}`)
  const [activeTool, setActiveTool] = useState<'chat' | 'search' | 'quiz' | 'diagram' | 'roadmap' | null>(null)
  const [skills, setSkills] = useState<any[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showCreateSkill, setShowCreateSkill] = useState(false)
  const [customSkillYaml, setCustomSkillYaml] = useState('')
  const [confirmSkillName, setConfirmSkillName] = useState('')
  const [confirmSkillDesc, setConfirmSkillDesc] = useState('')
  const [confirmSkillPrompt, setConfirmSkillPrompt] = useState('')
  const [skillCreationStep, setSkillCreationStep] = useState<'describe' | 'review' | 'saved'>('describe')
  
  // Load skills on mount
  useEffect(() => {
    const init = async () => {
      const loadedSkills = await loadSkills()
      setSkills(loadedSkills)
      const defaultSkillId = loadedSkills[0]?.id || ''
      setSelectedSkill(defaultSkillId)
    }
    init()
  }, [])
  
  const currentSkill = skills.find((s) => s.id === selectedSkill)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isThinking])

  const callBackend = async (endpoint: string, body: any) => {
    const res = await fetch(`/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, userId }),
    })
    return res.json()
  }

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      sender: 'user',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsThinking(true)
    setActiveTool('chat')

    try {
      const data = await callBackend('chat', {
        message: input,
        skillId: selectedSkill,
      })

      if (data.reply) {
        const cooneyMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.reply,
          sender: 'cooney',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, cooneyMessage])
        
        // Show tool trace if tools were used
        if (data.toolCalls && data.toolCalls.length > 0) {
          const toolList = data.toolCalls.map((t: any) => {
            const inputStr = typeof t.input === 'object' 
              ? JSON.stringify(t.input).slice(0, 50) + '...'
              : t.input
            return `- ${t.toolName}: ${inputStr}`
          }).join('\n')
          
          const traceMsg: Message = {
            id: (Date.now() + 2).toString(),
            content: '\n---\n**Tools used:**\n' + toolList,
            sender: 'cooney',
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, traceMsg])
        }
      }
    } catch (error) {
      const mockResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: 'I got you! (Agent mode unavailable)',
        sender: 'cooney',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, mockResponse])
    } finally {
      setIsThinking(false)
    }
  }

  const handleSearch = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: `🔍 Search: ${input}`,
      sender: 'user',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsThinking(true)
    setActiveTool('search')

    try {
      const data = await callBackend('search', {
        query: input,
        skillId: selectedSkill,
      })

      if (data.summary) {
        const response: Message = {
          id: (Date.now() + 1).toString(),
          content: `**Summary:**\n${data.summary}\n\n**Sources:**\n${data.results.map((r: any) => `- ${r.title} (${r.url})`).join('\n')}`,
          sender: 'cooney',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, response])
      }
    } catch (error) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        content: 'Search failed.',
        sender: 'cooney',
        timestamp: new Date(),
      }])
    } finally {
      setIsThinking(false)
    }
  }

  const handleQuiz = async () => {
    if (!input.trim()) return

    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      content: `📝 Generate quiz on: ${input}`,
      sender: 'user',
      timestamp: new Date(),
    }])

    setInput('')
    setIsThinking(true)
    setActiveTool('quiz')

    try {
      const data = await callBackend('quiz', {
        message: input,
        skillId: selectedSkill,
        quizCount: 5,
      })

      if (data.questions) {
        const quizText = data.questions.map((q: any, i: number) => 
          `${i + 1}. ${q.question}\nOptions:\n${q.options?.map((o: string, j: number) => `${String.fromCharCode(65 + j)}. ${o}`).join('\n')}\nCorrect: ${q.correct_answer}\n`
        ).join('\n');

        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          content: `**Quiz Questions:**\n${quizText}`,
          sender: 'cooney',
          timestamp: new Date(),
        }])
      }
    } catch (error) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        content: 'Quiz generation failed.',
        sender: 'cooney',
        timestamp: new Date(),
      }])
    } finally {
      setIsThinking(false)
    }
  }

  const handleDiagram = async () => {
    if (!input.trim()) return

    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      content: `🎨 Generate diagram: ${input}`,
      sender: 'user',
      timestamp: new Date(),
    }])

    setInput('')
    setIsThinking(true)
    setActiveTool('diagram')

    try {
      const data = await callBackend('diagram', {
        message: input,
        skillId: selectedSkill,
      })

      if (data.diagram) {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          content: `**Diagram:**\n\`\`\`\n${data.diagram}\n\`\`\``,
          sender: 'cooney',
          timestamp: new Date(),
        }])
      }
    } catch (error) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        content: 'Diagram generation failed.',
        sender: 'cooney',
        timestamp: new Date(),
      }])
    } finally {
      setIsThinking(false)
    }
  }

  const handleRoadmap = async () => {
    if (!input.trim()) return

    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      content: `🗺️ Generate roadmap: ${input}`,
      sender: 'user',
      timestamp: new Date(),
    }])

    setInput('')
    setIsThinking(true)
    setActiveTool('roadmap')

    try {
      const data = await callBackend('roadmap', {
        message: input,
        skillId: selectedSkill,
      })

      if (data.roadmap) {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          content: `**Learning Roadmap:**\n\n${data.roadmap}`,
          sender: 'cooney',
          timestamp: new Date(),
        }])
      }
    } catch (error) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        content: 'Roadmap generation failed.',
        sender: 'cooney',
        timestamp: new Date(),
      }])
    } finally {
      setIsThinking(false)
    }
  }

  const handleCreateSkillDescribe = async () => {
    if (!input.trim()) return

    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      content: `✨ Create new skill: ${input}`,
      sender: 'user',
      timestamp: new Date(),
    }])

    setInput('')
    setIsThinking(true)
    setActiveTool('chat')

    try {
      const data = await callBackend('skills/create', {
        message: input,
        userId,
      })

      if (data.skillYaml) {
        setCustomSkillYaml(data.skillYaml)
        
        // Parse YAML fields
        const nameMatch = data.skillYaml.match(/name: (.+)/)
        const descMatch = data.skillYaml.match(/description: (.+)/)
        const promptMatch = data.skillYaml.match(/system_prompt: \|[\s\S]*(?:\n  |\n|$)(.*)/s)

        setConfirmSkillName(nameMatch ? nameMatch[1].trim() : '')
        setConfirmSkillDesc(descMatch ? descMatch[1].trim() : '')
        setConfirmSkillPrompt(promptMatch ? promptMatch[1].trim() : data.skillYaml)

        setSkillCreationStep('review')
        setShowCreateSkill(true)
      }
    } catch (error) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        content: 'Skill creation failed.',
        sender: 'cooney',
        timestamp: new Date(),
      }])
    } finally {
      setIsThinking(false)
    }
  }

  const handleSaveCustomSkill = async () => {
    try {
      const data = await callBackend('skills/save', {
        name: confirmSkillName,
        description: confirmSkillDesc,
        system_prompt: confirmSkillPrompt,
        userId,
      })

      if (data.success) {
        setSkillCreationStep('saved')
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          content: `✅ Skill "${confirmSkillName}" created successfully!`,
          sender: 'cooney',
          timestamp: new Date(),
        }])
      }
    } catch (error) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        content: 'Failed to save skill.',
        sender: 'cooney',
        timestamp: new Date(),
      }])
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-white to-gray-50">
      {/* Header - Skill Selector Only */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-[#2D3E50]">Cooney's Learning Space</h1>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">Skill:</label>
              <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                <SelectTrigger className="w-[200px] border-[#1DD7C0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {skills.map((skill) => (
                    <SelectItem key={skill.id} value={skill.id}>
                      {skill.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area - Scrollable */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <Card
                className={`max-w-md px-6 py-4 ${
                  message.sender === 'user'
                    ? 'bg-[#1DD7C0] text-white'
                    : 'bg-gray-100 text-gray-900 border-l-4 border-[#1DD7C0]'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p
                  className={`text-xs mt-2 ${
                    message.sender === 'user' ? 'text-[#1DD7C0]' : 'text-gray-500'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </Card>
            </div>
          ))}
          {isThinking && (
            <div className="flex justify-start">
              <ThinkingIndicator activeTool={activeTool as any} />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - Fixed at Bottom */}
      <div className="border-t border-gray-200 px-8 py-6 flex-shrink-0 bg-white/95 backdrop-blur">
        <div className="max-w-4xl mx-auto">
          {/* Tools Toolbar */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <Button onClick={() => { document.getElementById('chat-input')?.focus(); }} variant="outline" className="bg-[#1DD7C0] bg-opacity-10 hover:bg-[#1DD7C0] hover:bg-opacity-20">
              💬 Chat
            </Button>
            <Button onClick={async () => { setInput('Search about a topic...'); document.getElementById('chat-input')?.focus(); }} variant="outline" className="hover:bg-[#1DD7C0] hover:bg-opacity-20">
              🔍 Search
            </Button>
            <Button onClick={async () => { setInput('Create a diagram for...'); document.getElementById('chat-input')?.focus(); }} variant="outline" className="hover:bg-[#1DD7C0] hover:bg-opacity-20">
              🎨 Diagram
            </Button>
            <Button onClick={async () => { setInput('Generate quiz on...'); document.getElementById('chat-input')?.focus(); }} variant="outline" className="hover:bg-[#1DD7C0] hover:bg-opacity-20">
              📝 Quiz
            </Button>
            <Button onClick={async () => { setInput('Create learning roadmap for...'); document.getElementById('chat-input')?.focus(); }} variant="outline" className="hover:bg-[#1DD7C0] hover:bg-opacity-20">
              🗺️ Roadmap
            </Button>
          </div>

          <div className="flex gap-3">
            <Input
              id="chat-input"
              placeholder="Ask Cooney anything or use tools above..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              className="flex-1 border-gray-300"
            />
            <Button onClick={handleSend} className="bg-[#1DD7C0] hover:bg-[#16bfaa] text-[#2D3E50] font-semibold">
              <Send size={20} />
            </Button>
          </div>
        </div>
      </div>

      {/* Skill Creation Modal */}
      {showCreateSkill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-[#2D3E50]">
                  {skillCreationStep === 'describe' && '✨ Create New Skill with AI'}
                  {skillCreationStep === 'review' && '📝 Review Your Skill'}
                  {skillCreationStep === 'saved' && '✅ Skill Created!'}
                </h2>
                <Button variant="ghost" onClick={() => setShowCreateSkill(false)}>✕</Button>
              </div>

              {skillCreationStep === 'describe' && (
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Describe the skill you want to create. Be specific about what it teaches and who it's for.
                  </p>
                  <Input
                    placeholder="e.g., A chemistry tutor for high school students that explains reactions and periodic table concepts"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleCreateSkillDescribe} className="bg-[#1DD7C0]">
                      <Sparkles size={16} className="mr-2" />
                      Generate Skill
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateSkill(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {skillCreationStep === 'review' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Skill Name</label>
                    <Input
                      value={confirmSkillName}
                      onChange={(e) => setConfirmSkillName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <Input
                      value={confirmSkillDesc}
                      onChange={(e) => setConfirmSkillDesc(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
                    <textarea
                      className="w-full h-48 p-3 border rounded-lg font-mono text-sm"
                      value={confirmSkillPrompt}
                      onChange={(e) => setConfirmSkillPrompt(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveCustomSkill} className="bg-[#1DD7C0]">
                      Save Skill
                    </Button>
                    <Button variant="outline" onClick={() => setSkillCreationStep('describe')}>
                      Regenerate
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateSkill(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {skillCreationStep === 'saved' && (
                <div className="text-center space-y-4">
                  <div className="text-6xl">🎉</div>
                  <p className="text-gray-600">
                    Your custom skill has been saved to `/backend/skills/custom/`
                  </p>
                  <Button onClick={() => setShowCreateSkill(false)}>
                    Start Using It
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
