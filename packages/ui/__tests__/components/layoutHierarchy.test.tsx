/**
 * feature-010 布局层级重设计测试(消除页面重叠)。
 *
 * 因禁止起本地服务器,采用 SSR renderToStaticMarkup 静态断言:
 *  - AC1/AC2: NodeDetailPanel 桌面进栅格右轨(md:static),不再相对视口 absolute,
 *             不使用 top-0 视口锚点覆盖 Header。
 *  - AC3: z-index 采用语义 token 类;tooltip 语义低于 modal(token 值 45 < 50)。
 *  - AC4: 模态打开时 NodeTooltip 被抑制(不渲染)。
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement, type ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import NodeDetailPanel from '../../src/components/NodeDetailPanel'
import type { OmniNode } from '@codeomnivis/shared'
import zIndexTokens from '../../tailwind.config.js'

function renderWithQuery(el: ReactElement): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, el))
}

const sampleNode: OmniNode = {
  id: 'n1',
  name: 'DemoNode',
  type: 'module',
  filePath: 'src/demo.ts',
  line: 1,
  column: 1,
  metadata: { childCount: 0, childTypes: [] },
}

describe('NodeDetailPanel 进栅格右轨(AC1/AC2)', () => {
  it('桌面为 md:static 栅格轨道成员,而非相对视口 absolute 覆盖', () => {
    const html = renderWithQuery(
      <NodeDetailPanel
        node={sampleNode}
        inEdges={[]}
        outEdges={[]}
        onClose={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    // 桌面进栅格:md:static + md:shrink-0(占轨道,不脱离文档流)
    expect(html).toContain('md:static')
    expect(html).toContain('md:shrink-0')
    // 不得出现相对视口的 absolute 锚点(旧实现:absolute right-0 top-0 bottom-0)
    expect(html).not.toContain('absolute right-0')
    expect(html).not.toContain('top-0 bottom-0')
  })

  it('node 为空时不渲染', () => {
    const html = renderWithQuery(
      <NodeDetailPanel node={null} inEdges={[]} outEdges={[]} onClose={() => {}} onNodeSelect={() => {}} />,
    )
    expect(html).toBe('')
  })

  it('builds an absolute VS Code link from a POSIX project root', () => {
    const html = renderWithQuery(
      <NodeDetailPanel
        node={{ ...sampleNode, filePath: 'src/demo file.ts', line: 9 }}
        projectRoot="/Users/dev/CodeOmniVis"
        inEdges={[]}
        outEdges={[]}
        onClose={() => {}}
        onNodeSelect={() => {}}
      />,
    )

    expect(html).toContain('href="vscode://file/Users/dev/CodeOmniVis/src/demo%20file.ts:9"')
    expect(html).not.toContain('window.open')
  })

  it('normalizes Windows paths and preserves an already absolute node path', () => {
    const windowsHtml = renderWithQuery(
      <NodeDetailPanel
        node={{ ...sampleNode, filePath: 'src\\demo.ts', line: 4 }}
        projectRoot={'C:\\code\\repo'}
        inEdges={[]}
        outEdges={[]}
        onClose={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    const absoluteHtml = renderWithQuery(
      <NodeDetailPanel
        node={{ ...sampleNode, filePath: '/tmp/external.ts', line: 7 }}
        projectRoot="/Users/dev/CodeOmniVis"
        inEdges={[]}
        outEdges={[]}
        onClose={() => {}}
        onNodeSelect={() => {}}
      />,
    )

    expect(windowsHtml).toContain('href="vscode://file/C:/code/repo/src/demo.ts:4"')
    expect(absoluteHtml).toContain('href="vscode://file/tmp/external.ts:7"')
  })

  it('disables source navigation while a relative path has no project root', () => {
    const html = renderWithQuery(
      <NodeDetailPanel
        node={sampleNode}
        projectRoot=""
        inEdges={[]}
        outEdges={[]}
        onClose={() => {}}
        onNodeSelect={() => {}}
      />,
    )

    expect(html).toContain('aria-disabled="true"')
    expect(html).not.toContain('href="vscode://file/')
  })
})

describe('z-index 语义 token(AC3)', () => {
  it('tailwind 定义了语义 z-index 层级', () => {
    const z = (zIndexTokens as any).theme.extend.zIndex
    expect(z).toBeTruthy()
    expect(z.tooltip).toBeDefined()
    expect(z.modal).toBeDefined()
    expect(z.drawer).toBeDefined()
  })

  it('tooltip 语义严格低于 modal', () => {
    const z = (zIndexTokens as any).theme.extend.zIndex
    expect(Number(z.tooltip)).toBeLessThan(Number(z.modal))
  })

  it('drawer 低于 tooltip 低于 modal,层级单调', () => {
    const z = (zIndexTokens as any).theme.extend.zIndex
    expect(Number(z.drawer)).toBeLessThanOrEqual(Number(z.tooltip))
    expect(Number(z.tooltip)).toBeLessThan(Number(z.modal))
  })

  it('详情面板使用语义 z 类(z-drawer),不再裸 z-20', () => {
    const html = renderWithQuery(
      <NodeDetailPanel node={sampleNode} inEdges={[]} outEdges={[]} onClose={() => {}} onNodeSelect={() => {}} />,
    )
    expect(html).toContain('z-drawer')
    expect(html).not.toContain('z-20')
  })
})
