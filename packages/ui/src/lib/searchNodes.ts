/**
 * 节点搜索匹配(纯逻辑)。
 *
 * E-12/F16:把"按搜索词过滤节点"的逻辑从 useSearch 抽出为纯函数,
 * 便于单测且可被 Sidebar 列表等消费,使 Header 搜索框真正生效。
 */

import type { OmniNode } from '@codeomnivis/shared'

/**
 * 按搜索词过滤节点(大小写不敏感,匹配 name 或 filePath)。
 * 空/纯空白 query 返回全部节点。
 */
export function filterNodesByQuery(nodes: OmniNode[], query: string): OmniNode[] {
  const trimmed = query.trim()
  if (!trimmed) return nodes

  const lower = trimmed.toLowerCase()
  return nodes.filter(
    (n) =>
      n.name.toLowerCase().includes(lower) ||
      n.filePath.toLowerCase().includes(lower),
  )
}
