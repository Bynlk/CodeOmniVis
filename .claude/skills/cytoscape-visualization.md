# Skill: Cytoscape.js Visualization

> OmniVis 可视化前端开发指南。基于 React + Cytoscape.js + Tailwind CSS。

## 适用场景

当任务涉及以下内容时使用本 skill：
- 实现或修改 UI 组件（packages/ui/）
- Cytoscape.js 配置和交互
- 图布局算法调整
- 节点/边样式定制

## 技术栈

- **React 18** + TypeScript
- **Cytoscape.js 3.28** + cytoscape-dagre
- **Tailwind CSS 3.4**（样式）
- **@tanstack/react-query 5**（服务端状态）
- **Vite 5**（构建）

## Cytoscape.js 初始化

```typescript
import cytoscape from 'cytoscape'
import dagre from 'cytoscape-dagre'

// 注册布局插件（只需一次）
cytoscape.use(dagre)

// 创建实例
const cy = cytoscape({
  container: document.getElementById('cy'),
  elements: [],  // 通过 API 后续填充
  style: getNodeStyles(),
  layout: { name: 'preset' },  // 手动控制布局
})
```

## 节点样式（按类型区分）

```typescript
function getNodeStyles(): cytoscape.Stylesheet[] {
  return [
    {
      selector: 'node',
      style: {
        'label': 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '12px',
        'font-family': 'Inter, system-ui, sans-serif',
        'background-color': 'data(color)',
        'border-color': 'data(color)',
        'border-width': 2,
        'width': 'label',
        'height': 'label',
        'padding': '12px',
        'shape': 'round-rectangle',
      } as any,
    },
    // 按类型区分
    { selector: 'node[type="page"]',          style: { 'background-color': '#6366f1' } },
    { selector: 'node[type="component"]',     style: { 'background-color': '#3b82f6' } },
    { selector: 'node[type="api_route"]',     style: { 'background-color': '#10b981' } },
    { selector: 'node[type="trpc_procedure"]',style: { 'background-color': '#06b6d4' } },
    { selector: 'node[type="db_model"]',      style: { 'background-color': '#ec4899' } },
    { selector: 'node[type="module"]',        style: { 'background-color': '#374151', 'shape': 'round-rectangle' } },
    // 边样式
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': 'data(color)',
        'target-arrow-color': 'data(color)',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'opacity': 0.6,
      } as any,
    },
    // 选中状态
    { selector: 'node:selected', style: { 'border-width': 4, 'border-color': '#fbbf24' } },
    { selector: 'edge:selected', style: { 'opacity': 1, 'width': 3 } },
  ]
}
```

## dagre 分层布局

```typescript
function runDagreLayout(cy: cytoscape.Core) {
  cy.layout({
    name: 'dagre',
    rankDir: 'TB',        // Top to Bottom
    nodeSep: 60,          // 节点间距
    rankSep: 120,         // 层间距
    edgeSep: 20,          // 边间距
    padding: 40,
    animate: true,
    animationDuration: 400,
  } as any).run()
}
```

## React 封装模式

```typescript
// hooks/useCytoscape.ts
import { useRef, useEffect, useCallback } from 'react'
import cytoscape from 'cytoscape'

export function useCytoscape(containerRef: React.RefObject<HTMLDivElement>) {
  const cyRef = useRef<cytoscape.Core | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const cy = cytoscape({
      container: containerRef.current,
      style: getNodeStyles(),
      layout: { name: 'preset' },
    })

    cyRef.current = cy

    // 点击事件
    cy.on('tap', 'node', (evt) => {
      const node = evt.target
      // 触发节点选中回调
    })

    return () => { cy.destroy() }
  }, [containerRef])

  const updateElements = useCallback((elements: cytoscape.ElementDefinition[]) => {
    const cy = cyRef.current
    if (!cy) return
    cy.elements().remove()
    cy.add(elements)
    runDagreLayout(cy)
  }, [])

  return { cyRef, updateElements }
}
```

## 数据转换（API → Cytoscape）

```typescript
// lib/graphTransform.ts
import type { OmniGraph } from '@omnivis/shared'
import { NODE_COLORS } from '@omnivis/shared'

export function graphToCytoscape(graph: OmniGraph): cytoscape.ElementDefinition[] {
  const nodes = graph.nodes.map(node => ({
    data: {
      id: node.id,
      label: node.name,
      type: node.type,
      color: NODE_COLORS[node.type],
      ...node.metadata,
    },
    classes: node.type,
  }))

  const edges = graph.edges.map(edge => ({
    data: {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      color: NODE_COLORS_ALPHA[edge.type.split('_')[0]] || '#ffffff40',
    },
  }))

  return [...nodes, ...edges]
}
```

## 关键交互

| 交互 | 实现方式 |
|------|---------|
| 缩放/平移 | Cytoscape 内置（pinch-to-zoom, drag-to-pan） |
| 点击节点 | `cy.on('tap', 'node', handler)` |
| 双击展开 | `cy.on('dbltap', 'node', handler)` |
| 搜索高亮 | 添加/移除 `highlighted` class |
| 上下游高亮 | BFS 遍历，添加 `dimmed` class 到非相关节点 |

## 性能优化

- **虚拟渲染**：Cytoscape 内置，只渲染视口内节点
- **布局计算**：超过 500 节点时使用 Web Worker
- **增量更新**：不要 `cy.elements().remove()` + `cy.add()`，使用 `cy.batch()` 批量修改
- **样式缓存**：避免在 render 中创建新的 stylesheet 对象
