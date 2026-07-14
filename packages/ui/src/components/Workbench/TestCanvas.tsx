import type { ReactNode } from 'react'
import type { OmniGraph } from '@codeomnivis/shared'
import { useTranslation } from 'react-i18next'

export function TestCanvas({ graph, children }: { graph: OmniGraph; children: ReactNode }) {
  const { t } = useTranslation()
  const cases = graph.nodes.filter((node) => node.type === 'test_case').length
  const targets = new Set(
    graph.edges.filter((edge) => edge.type === 'covers').map((edge) => edge.target),
  ).size
  return (
    <section
      className="relative h-full"
      aria-label={t('workbench.tests.canvas', 'Test coverage canvas')}
    >
      <div className="absolute right-3 top-3 z-10 flex gap-2 rounded-md border border-border-subtle bg-[#0b0e13] px-2 py-1 font-mono text-[10px] text-content-muted">
        <span>
          {cases} {t('workbench.tests.cases', 'cases')}
        </span>
        <span>
          {targets} {t('workbench.tests.targets', 'targets')}
        </span>
      </div>
      {children}
    </section>
  )
}
