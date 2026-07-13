import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import zhCN from '../../src/locales/zh-CN.json'
import { __resetUiStore } from '../../src/store/uiStore'
import { ViewRail } from '../../src/components/Workbench/ViewRail'
import { CanvasHeader } from '../../src/components/Workbench/CanvasHeader'
import { ExplorerPanel } from '../../src/components/Workbench/ExplorerPanel'
import { StatusBar } from '../../src/components/Workbench/StatusBar'
import { QualityCanvas } from '../../src/components/Workbench/QualityCanvas'
import { QualityExplorer } from '../../src/components/Workbench/QualityExplorer'
import { CanvasEmptyState } from '../../src/components/Workbench/CanvasEmptyState'
import { WorkbenchShell } from '../../src/components/Workbench/WorkbenchShell'
import NodeDetailPanel from '../../src/components/NodeDetailPanel'

const i18n = i18next.createInstance()

describe('workbench i18n', () => {
  beforeAll(async () => {
    await i18n.use(initReactI18next).init({
      lng: 'zh-CN',
      fallbackLng: false,
      resources: { 'zh-CN': { translation: zhCN } },
      interpolation: { escapeValue: false },
    })
  })

  beforeEach(() => {
    __resetUiStore()
  })

  it('renders the complete workbench chrome in Chinese', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <ViewRail activeView="architecture" onViewChange={() => {}} />
        <CanvasHeader
          view="architecture"
          graph={{ nodes: [], edges: [] }}
          depth="overview"
          focusAvailable={false}
          onDepthChange={() => {}}
          onFit={() => {}}
        />
        <CanvasHeader
          view="requests"
          graph={{ nodes: [], edges: [] }}
          depth="full"
          focusAvailable={false}
          onDepthChange={() => {}}
          onFit={() => {}}
        />
        <ExplorerPanel graph={{ nodes: [], edges: [] }} view="architecture" selectedNodeId={null} onNodeSelect={() => {}} />
        <StatusBar status={{ state: 'stale', lastAnalyzedAt: null, pendingChanges: 0 }} nodeCount={57} edgeCount={65} />
        <QualityCanvas findings={[]} isLoading={false} detectors={[
          { id: 'consistency', status: 'complete' },
          { id: 'auth', status: 'complete' },
          { id: 'n_plus_one', status: 'complete' },
          { id: 'rsc', status: 'complete' },
        ]} />
        <QualityExplorer findings={[]} />
        <CanvasEmptyState view="data" hasSearchQuery={false} />
        <WorkbenchShell
          commandBar={null}
          viewRail={null}
          explorer={null}
          main={null}
          statusBar={null}
        />
        <NodeDetailPanel
          node={{
            id: 'component:src/Demo.tsx:Demo',
            type: 'component',
            name: 'Demo',
            filePath: 'src/Demo.tsx',
            line: 1,
            column: 1,
            metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 0 },
          }}
          projectRoot="/project"
          inEdges={[]}
          outEdges={[]}
          onClose={() => {}}
          onNodeSelect={() => {}}
        />
      </I18nextProvider>,
    )

    for (const copy of ['架构', '请求流', '数据模型', '质量', '概览', '完整图谱', '聚焦', '适配视图', '资源浏览器', '节点', '关系', '尚未分析', '连接中', '未发现质量问题', '未检测到数据关系', '跳转到主内容', '节点检查器']) {
      expect(html).toContain(copy)
    }
    expect(html).not.toContain('System shape and ownership')
    expect(html).not.toContain('No quality findings')
    expect(html).not.toContain('aria-label="Node inspector"')
  })

  it('localizes deterministic descriptions and preserves raw parser diagnostics', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <QualityCanvas
          findings={[
            {
              id: 'security-1',
              source: 'security',
              severity: 'critical',
              type: 'unguarded_route',
              message: 'API route "GET /api/demo" has no authentication guard',
              messageKey: 'unguarded_route',
              messageParams: { route: 'GET /api/demo' },
              locations: [{ file: 'app/api/demo/route.ts', line: 4 }],
              relatedNodeIds: [],
            },
            {
              id: 'parser-1',
              source: 'parser',
              severity: 'warning',
              type: 'parser',
              message: 'TS1005: expected semicolon',
              locations: [{ file: 'src/broken.ts' }],
              relatedNodeIds: [],
            },
          ]}
          isLoading={false}
          detectors={[
            { id: 'consistency', status: 'complete' },
            { id: 'auth', status: 'complete' },
            { id: 'n_plus_one', status: 'complete' },
            { id: 'rsc', status: 'complete' },
          ]}
        />
      </I18nextProvider>,
    )

    expect(html).toContain('API 路由“GET /api/demo”缺少身份验证保护')
    expect(html).not.toContain('has no authentication guard')
    expect(html).toContain('TS1005: expected semicolon')
  })
})
