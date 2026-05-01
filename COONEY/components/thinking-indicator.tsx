interface ThinkingIndicatorProps {
  activeTool?: 'chat' | 'search' | 'quiz' | 'diagram' | 'roadmap';
}

export function ThinkingIndicator({ activeTool }: ThinkingIndicatorProps) {
  return (
    <div className="flex items-start gap-3 bg-gray-100 border-l-4 border-[#1DD7C0] rounded-lg px-6 py-4 max-w-md">
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-[#1DD7C0] opacity-10 animate-pulse" />
        <div className="relative w-10 h-10 rounded-full bg-[#1DD7C0] flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-[#2D3E50] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        <p className="text-sm font-medium text-[#2D3E50]">
          Cooney is{activeTool ? ` working on ${activeTool}...` : ' thinking...'}
        </p>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          {activeTool === 'search' && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#1DD7C0] rounded-full animate-pulse" />
              Searching DuckDuckGo...
            </span>
          )}
          {activeTool === 'quiz' && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#1DD7C0] rounded-full animate-pulse" />
              Generating quiz questions...
            </span>
          )}
          {activeTool === 'diagram' && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#1DD7C0] rounded-full animate-pulse" />
              Creating visual representation...
            </span>
          )}
          {activeTool === 'roadmap' && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#1DD7C0] rounded-full animate-pulse" />
              Designing learning path...
            </span>
          )}
          {(!activeTool || activeTool === 'chat') && (
            <span>Processing your question...</span>
          )}
        </div>
      </div>
    </div>
  )
}
