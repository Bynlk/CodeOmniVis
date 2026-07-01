import type { OmniNode } from '@codeomnivis/shared'

/** 检查节点是否为合成节点（非用户代码，由分析器推断生成）。 */
export function isSyntheticNode(node: OmniNode): boolean {
  return 'isSynthetic' in node.metadata && node.metadata.isSynthetic === true
}
