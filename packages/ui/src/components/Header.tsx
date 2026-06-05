export default function Header() {
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
