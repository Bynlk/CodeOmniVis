import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface WorkbenchShellProps {
  commandBar: ReactNode
  viewRail: ReactNode
  explorer: ReactNode
  main: ReactNode
  inspector?: ReactNode
  statusBar: ReactNode
  mobileExplorerOpen?: boolean
  onCloseMobileExplorer?: () => void
}

export function WorkbenchShell({ commandBar, viewRail, explorer, main, inspector, statusBar, mobileExplorerOpen = false, onCloseMobileExplorer }: WorkbenchShellProps) {
  const { t } = useTranslation()
  return (
    <div className="grid h-screen min-h-0 grid-rows-[48px_minmax(0,1fr)_24px] overflow-hidden bg-[#090b0f] text-content">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-modal focus:rounded-md focus:bg-primary-600 focus:px-3 focus:py-2 focus:text-xs focus:font-medium focus:text-white"
      >
        {t('a11y.skipToMain', 'Skip to main content')}
      </a>
      <div data-workbench="command-bar" className="col-span-full border-b border-border-subtle bg-surface-raised">{commandBar}</div>
      <div className="grid min-h-0 grid-cols-[48px_248px_minmax(0,1fr)_auto] max-md:grid-cols-[48px_minmax(0,1fr)]">
        <nav data-workbench="view-rail" aria-label={t('workbench.workspaceViews', 'Workspace views')} className="min-h-0 border-r border-border-subtle bg-[#0b0e13]">{viewRail}</nav>
        <aside data-workbench="explorer" className="min-h-0 overflow-hidden border-r border-border-subtle bg-surface-panel max-md:hidden">{explorer}</aside>
        <main data-workbench="canvas" id="main-content" tabIndex={-1} className="relative min-h-0 min-w-0 overflow-hidden bg-[#090b0f]">{main}</main>
        {inspector ? <aside data-workbench="inspector" className="min-h-0 w-80 overflow-hidden border-l border-border-subtle bg-surface-panel max-lg:fixed max-lg:bottom-6 max-lg:right-0 max-lg:top-12 max-lg:z-drawer max-lg:w-[min(360px,calc(100vw-48px))] max-lg:shadow-ds-panel">{inspector}</aside> : null}
        {mobileExplorerOpen ? (
          <div className="fixed bottom-6 left-12 right-0 top-12 z-drawer md:hidden">
            <button type="button" data-workbench="mobile-explorer-backdrop" className="absolute inset-0 z-0 bg-black/70" aria-label={t('workbench.closeExplorer', 'Close explorer')} onClick={onCloseMobileExplorer} />
            <aside data-workbench="mobile-explorer" className="relative z-10 h-full w-[min(300px,calc(100vw-48px))] border-r border-border-strong bg-surface-panel shadow-ds-panel">{explorer}</aside>
          </div>
        ) : null}
      </div>
      <footer data-workbench="status-bar" className="col-span-full border-t border-border-subtle bg-[#0b0e13]">{statusBar}</footer>
    </div>
  )
}
