import type { OmniGraph } from '@codeomnivis/shared'
import { useTranslation } from 'react-i18next'
import { buildTestSuiteGroups } from '../../lib/testView'

interface TestExplorerProps {
  graph?: OmniGraph
  selectedNodeId?: string | null
  onNodeSelect: (nodeId: string) => void
}

export function TestExplorer({ graph, selectedNodeId, onNodeSelect }: TestExplorerProps) {
  const { t } = useTranslation()
  const groups = graph ? buildTestSuiteGroups(graph) : []
  return (
    <section className="h-full overflow-auto bg-[#0b0e13] p-3" aria-label={t('workbench.tests.explorer', 'Test explorer')}>
      <h2 className="mb-1 text-xs font-semibold text-content">{t('workbench.view.tests', 'Tests')}</h2>
      <p className="mb-3 text-[11px] text-content-muted">{t('workbench.tests.description', 'Static suites and production coverage')}</p>
      {groups.length === 0 ? <p className="text-xs text-content-muted">{t('workbench.tests.empty', 'No tests discovered')}</p> : groups.map(group => (
        <details key={group.suite.id} open className="mb-2 rounded-md border border-border-subtle bg-surface/40">
          <summary className="cursor-pointer px-2 py-2 text-xs text-content">{group.suite.name}</summary>
          <div className="border-t border-border-subtle p-1">
            {group.cases.map(testCase => (
              <button key={testCase.id} type="button" onClick={() => onNodeSelect(testCase.id)} className={`block w-full rounded px-2 py-1.5 text-left text-[11px] ${selectedNodeId === testCase.id ? 'bg-primary-600 text-white' : 'text-content-secondary hover:bg-surface-hover'}`}>
                {testCase.name.split(' > ').at(-1)}
              </button>
            ))}
          </div>
        </details>
      ))}
    </section>
  )
}
