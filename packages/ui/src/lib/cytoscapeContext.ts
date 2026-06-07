import { createContext, useContext } from 'react'
import type { RefObject } from 'react'
import type cytoscape from 'cytoscape'

/**
 * 全局 Cytoscape 实例 Context
 * 存储 ref 本身（而非 ref.current），这样消费者可以通过 ref.current 访问最新值
 */
export const CytoscapeContext = createContext<RefObject<cytoscape.Core | null> | null>(null)

export function useCytoscapeRef(): RefObject<cytoscape.Core | null> | null {
  return useContext(CytoscapeContext)
}

export function useCytoscapeInstance(): cytoscape.Core | null {
  const ref = useContext(CytoscapeContext)
  return ref?.current ?? null
}
