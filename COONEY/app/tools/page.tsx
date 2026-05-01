'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { mockTools } from '@/lib/mock-data'

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-[#2D3E50] mb-2">Available Tools</h1>
          <p className="text-gray-600">
            Powerful functions and features Cooney can use to enhance your learning experience
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockTools.map((tool) => (
            <Card
              key={tool.id}
              className="hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-[#1DD7C0] overflow-hidden"
            >
              <div className="p-6">
                {/* Icon */}
                <div className="text-5xl mb-4">{tool.icon}</div>

                {/* Content */}
                <h3 className="font-bold text-xl text-[#2D3E50] mb-2">{tool.name}</h3>
                <p className="text-gray-600 text-sm mb-6">{tool.description}</p>

                {/* Button */}
                <Button
                  className="w-full bg-[#1DD7C0] hover:bg-[#16bfaa] text-[#2D3E50] font-semibold"
                >
                  Learn More
                </Button>
              </div>

              {/* Accent Bar */}
              <div className="h-1 bg-gradient-to-r from-[#1DD7C0] to-[#1DD7C0] opacity-30"></div>
            </Card>
          ))}
        </div>

        {/* Tools Stats */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-[#1DD7C0] bg-opacity-10 border border-[#1DD7C0] p-6">
            <div className="text-3xl font-bold text-[#1DD7C0] mb-2">{mockTools.length}+</div>
            <p className="text-gray-700 font-semibold">Tools Available</p>
          </Card>
          <Card className="bg-[#2D3E50] bg-opacity-10 border border-[#2D3E50] p-6">
            <div className="text-3xl font-bold text-[#2D3E50] mb-2">24/7</div>
            <p className="text-gray-700 font-semibold">Always Available</p>
          </Card>
          <Card className="bg-emerald-500 bg-opacity-10 border border-emerald-500 p-6">
            <div className="text-3xl font-bold text-emerald-600 mb-2">100%</div>
            <p className="text-gray-700 font-semibold">Learning Ready</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
