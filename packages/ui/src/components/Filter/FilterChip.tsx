interface FilterChipProps {
  active: boolean
  label: string
  emoji?: string
  color?: string
  onClick: () => void
}

export function FilterChip({ active, label, emoji, color, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-all ${
        active
          ? 'bg-slate-600 text-white ring-1 ring-slate-500'
          : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
      }`}
    >
      {color && (
        <span
          className="h-2 w-2 rounded-full"
          style={{
            backgroundColor: active ? color : 'transparent',
            border: `1px solid ${color}`,
          }}
        />
      )}
      {emoji && <span>{emoji}</span>}
      <span className={active ? '' : 'line-through opacity-60'}>{label}</span>
    </button>
  )
}
