import { createContext, useContext } from 'react'
import type cytoscape from 'cytoscape'

/**
 * 全局 Cytoscape 实例 Context
 * 用于在 hook 中访问 cy 实例（如 useGraphFilter）
 */
export const CytoscapeContext = createContext<cytoscape.Core | null>(null)

export function useCytoscapeInstance(): cytoscape.Core | null {
  return useContext(CytoscapeContext)
}
