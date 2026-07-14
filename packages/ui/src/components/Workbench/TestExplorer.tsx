import type { OmniGraph } from '@codeomnivis/shared'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildTestSuiteGroups, filterTestSuiteGroups } from '../../lib/testView'
import type { TestFramework } from '@codeomnivis/shared'

interface TestExplorerProps {
  graph?: OmniGraph
  selectedNodeId?: string | null
  onNodeSelect: (nodeId: string) => void
}

export function TestExplorer({ graph, selectedNodeId, onNodeSelect }: TestExplorerProps) {
  const { t } = useTranslation()
  const [framework, setFramework] = useState<TestFramework | 'all'>('all')
  const [status, setStatus] = useState<'all' | 'enabled' | 'disabled'>('all')
  const allGroups = useMemo(() => (graph ? buildTestSuiteGroups(graph) : []), [graph])
  const groups = useMemo(
    () => filterTestSuiteGroups(allGroups, { framework, status }),
    [allGroups, framework, status],
  )
  const frameworks = useMemo(
    () =>
      [
        ...new Set(
          allGroups.flatMap((group) => {
            const value = group.suite.metadata as { framework?: TestFramework }
            return value.framework ? [value.framework] : []
          }),
        ),
      ].sort(),
    [allGroups],
  )
  return (
    <section
      data-testid="test-explorer"
      className="h-full overflow-auto bg-[#0b0e13] p-3"
      aria-label={t('workbench.tests.explorer', 'Test explorer')}
    >
      <h2 className="mb-1 text-xs font-semibold text-content">
        {t('workbench.view.tests', 'Tests')}
      </h2>
      <p className="mb-3 text-[11px] text-content-muted">
        {t('workbench.tests.description', 'Static suites and production coverage')}
      </p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="text-[10px] text-content-muted">
          <span className="mb-1 block">{t('workbench.tests.framework', 'Framework')}</span>
          <select
            value={framework}
            onChange={(event) => setFramework(event.target.value as TestFramework | 'all')}
            className="w-full rounded border border-border-subtle bg-surface px-2 py-1 text-[11px] text-content"
          >
            <option value="all">{t('workbench.tests.all', 'All')}</option>
            {frameworks.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] text-content-muted">
          <span className="mb-1 block">{t('workbench.tests.status', 'Status')}</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="w-full rounded border border-border-subtle bg-surface px-2 py-1 text-[11px] text-content"
          >
            <option value="all">{t('workbench.tests.all', 'All')}</option>
            <option value="enabled">{t('workbench.tests.enabled', 'Enabled')}</option>
            <option value="disabled">{t('workbench.tests.disabled', 'Disabled')}</option>
          </select>
        </label>
      </div>
      {groups.length === 0 ? (
        <p className="text-xs text-content-muted">
          {t('workbench.tests.empty', 'No tests discovered')}
        </p>
      ) : (
        groups.map((group) => (
          <details
            key={group.suite.id}
            open
            className="mb-2 rounded-md border border-border-subtle bg-surface/40"
          >
            <summary className="cursor-pointer px-2 py-2 text-xs text-content">
              {group.suite.name}
            </summary>
            <div className="border-t border-border-subtle p-1">
              {group.cases.map((testCase) => (
                <button
                  key={testCase.id}
                  type="button"
                  onClick={() => onNodeSelect(testCase.id)}
                  className={`block w-full rounded px-2 py-1.5 text-left text-[11px] ${selectedNodeId === testCase.id ? 'bg-primary-600 text-white' : 'text-content-secondary hover:bg-surface-hover'}`}
                >
                  {testCase.name.split(' > ').at(-1)}
                </button>
              ))}
              {group.fixtures.length > 0 ? (
                <div className="mt-1 border-t border-border-subtle px-2 py-1.5 text-[10px] text-content-muted">
                  {t('workbench.tests.fixtures', 'Fixtures')}:{' '}
                  {group.fixtures.map((fixture) => fixture.name).join(', ')}
                </div>
              ) : null}
            </div>
          </details>
        ))
      )}
    </section>
  )
}
