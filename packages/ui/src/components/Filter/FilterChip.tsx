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
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-ds-xs transition-all ${
        active
          ? 'bg-surface-hover text-content ring-1 ring-border-strong'
          : 'bg-surface text-content-muted hover:bg-surface-hover hover:text-content-secondary'
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
