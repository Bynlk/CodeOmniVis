/**
 * E-13 / F15 回归测试 —— 过滤状态在图刷新后重放。
 *
 * 缺陷:useGraphFilter 的过滤 effect 仅依赖 [state, cyRef];GraphCanvas 在
 * graph 刷新时 remove/add 全部元素并重新布局,过滤 state 未变时不会重放,
 * 新元素恢复默认可见,画布与 UI 过滤状态不一致。
 *
 * 这里把过滤应用逻辑抽成纯控制器 GraphFilterController,在 node 环境下用
 * 注入式假 cy(可控 nodes/edges + on/off 事件表)锁定:
 *   1. 构造时按当前 state 应用过滤(隐藏被关闭的类型)。
 *   2. cy 触发 'add'(模拟 GraphCanvas 重新 add 元素)后,新元素也被重放过滤。
 *   3. setState 切换过滤后立即重放。
 *   4. dispose() 注销 'add' 监听,之后 add 不再重放。
 */

import { describe, it, expect } from 'vitest'
import {
  GraphFilterController,
  createDefaultState,
  type GraphFilterState,
  type FilterableCy,
  type FilterableNode,
  type FilterableEdge,
} from '../../src/lib/graphFilterController'
import type { NodeType } from '@codeomnivis/shared'

class FakeNode implements FilterableNode {
  display = 'element'
  constructor(
    private readonly type: string,
    private readonly deg: number,
  ) {}
  data(name: string): unknown {
    return name === 'type' ? this.type : undefined
  }
  degree(): number {
    return this.deg
  }
  style(name: string, value: string): void {
    if (name === 'display') this.display = value
  }
}

class FakeEdge implements FilterableEdge {
  display = 'element'
  constructor(
    private readonly type: string,
    private readonly confidence: string,
  ) {}
  data(name: string): unknown {
    if (name === 'type') return this.type
    if (name === 'confidence') return this.confidence
    return undefined
  }
  style(name: string, value: string): void {
    if (name === 'display') this.display = value
  }
}

class FakeCy implements FilterableCy {
  nodeList: FakeNode[] = []
  edgeList: FakeEdge[] = []
  private handlers: Array<() => void> = []

  batch(run: () => void): void {
    run()
  }
  nodes(): { forEach(cb: (n: FilterableNode) => void): void } {
    const list = this.nodeList
    return { forEach: (cb) => list.forEach((n) => cb(n)) }
  }
  edges(): { forEach(cb: (e: FilterableEdge) => void): void } {
    const list = this.edgeList
    return { forEach: (cb) => list.forEach((e) => cb(e)) }
  }
  on(_event: string, handler: () => void): void {
    this.handlers.push(handler)
  }
  off(_event: string, handler: () => void): void {
    this.handlers = this.handlers.filter((h) => h !== handler)
  }
  emitAdd(): void {
    this.handlers.forEach((h) => h())
  }
  handlerCount(): number {
    return this.handlers.length
  }
}

function stateHiding(type: NodeType): GraphFilterState {
  const base = createDefaultState()
  const nodeTypeFilter = new Set(base.nodeTypeFilter)
  nodeTypeFilter.delete(type)
  return { ...base, nodeTypeFilter }
}

describe('GraphFilterController 过滤重放 (E-13/F15)', () => {
  it('构造时按 state 应用过滤,隐藏被关闭的节点类型', () => {
    const cy = new FakeCy()
    cy.nodeList = [new FakeNode('component', 2), new FakeNode('page', 2)]
    const controller = new GraphFilterController(cy, stateHiding('component'))
    expect(cy.nodeList[0].display).toBe('none')
    expect(cy.nodeList[1].display).toBe('element')
    controller.dispose()
  })

  it("图刷新(cy 'add')后对新元素重放过滤", () => {
    const cy = new FakeCy()
    cy.nodeList = [new FakeNode('component', 2)]
    const controller = new GraphFilterController(cy, stateHiding('component'))
    expect(cy.nodeList[0].display).toBe('none')

    // 模拟 GraphCanvas 刷新:remove + add 全新元素(默认 display='element')
    cy.nodeList = [new FakeNode('component', 2), new FakeNode('page', 2)]
    cy.emitAdd()

    // 新加入的 component 必须仍被过滤隐藏,page 可见
    expect(cy.nodeList[0].display).toBe('none')
    expect(cy.nodeList[1].display).toBe('element')
    controller.dispose()
  })

  it('setState 切换过滤后立即重放', () => {
    const cy = new FakeCy()
    cy.nodeList = [new FakeNode('component', 2)]
    const controller = new GraphFilterController(cy, createDefaultState())
    expect(cy.nodeList[0].display).toBe('element')

    controller.setState(stateHiding('component'))
    expect(cy.nodeList[0].display).toBe('none')
    controller.dispose()
  })

  it('dispose() 注销 add 监听,之后 add 不再重放', () => {
    const cy = new FakeCy()
    cy.nodeList = [new FakeNode('component', 2)]
    const controller = new GraphFilterController(cy, stateHiding('component'))
    expect(cy.handlerCount()).toBe(1)

    controller.dispose()
    expect(cy.handlerCount()).toBe(0)

    // dispose 后新元素不会被重放(保持默认可见)
    const fresh = new FakeNode('component', 2)
    cy.nodeList = [fresh]
    cy.emitAdd()
    expect(fresh.display).toBe('element')
  })

  it('边按类型+置信度过滤', () => {
    const cy = new FakeCy()
    cy.edgeList = [new FakeEdge('renders', 'certain'), new FakeEdge('renders', 'inferred')]
    const base = createDefaultState()
    const confidenceFilter = new Set<'certain' | 'inferred'>(['certain'])
    const controller = new GraphFilterController(cy, { ...base, confidenceFilter })
    expect(cy.edgeList[0].display).toBe('element')
    expect(cy.edgeList[1].display).toBe('none')
    controller.dispose()
  })
})
