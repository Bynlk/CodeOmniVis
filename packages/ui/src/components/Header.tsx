interface HeaderProps {
  query?: string
  onQueryChange?: (query: string) => void
}

export default function Header({ query, onQueryChange }: HeaderProps) {
  return (
    <header className="bg-slate-800 border-b border-slate-700 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h1 className="text-xl font-bold text-white">
            <span className="text-primary-400">Omni</span>Vis
          </h1>
          <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
            Architecture Visualizer
          </span>
        </div>

        <div className="flex items-center space-x-4">
          {/* 搜索框 */}
          {onQueryChange && (
            <div className="relative">
              <input
                type="text"
                value={query || ''}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Search nodes... (⌘K)"
                className="w-64 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 transition-colors"
                aria-label="Search nodes"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                ⌘K
              </span>
            </div>
          )}

          <button
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm transition-colors"
            aria-label="Refresh graph"
          >
            Refresh
          </button>
        </div>
      </div>
    </header>
  )
}
