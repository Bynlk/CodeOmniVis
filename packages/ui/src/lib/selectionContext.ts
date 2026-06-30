import { createContext, useContext } from 'react'

/**
 * 当前选中节点 Context。
 * 供与 App 解耦的面板组件(如 TracePanel)读取当前选中的节点 ID。
 */
export const SelectionContext = createContext<string | null>(null)

export function useSelectedNode(): string | null {
  return useContext(SelectionContext)
}
