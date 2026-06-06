import type { TabId, TabConfig } from '../../types/tabs'

interface TabPanelProps {
  activeTab: TabId | null
  tabs: TabConfig[]
}

export function TabPanel({ activeTab, tabs }: TabPanelProps) {
  const PanelComponent = activeTab
    ? tabs.find(t => t.id === activeTab)?.panelComponent ?? null
    : null

  if (!PanelComponent) return null

  return (
    <div className="absolute left-0 right-0 top-0 z-10 max-h-64 overflow-y-auto
                    border-b border-slate-600 bg-slate-800/95 backdrop-blur-sm
                    shadow-xl animate-slideDown">
      <PanelComponent />
    </div>
  )
}
