import path from 'path'
import { resolveWithinBoundary, type BoundaryResolution } from './pathGuard'

/**
 * Resolve a project switch request under the trust policy selected by the bind host.
 * Relative input is always bounded because its intended authority is otherwise ambiguous.
 */
export function resolveProjectRootRequest(
  startupRoot: string,
  requestedRoot: string,
  allowArbitraryAbsolute: boolean,
): BoundaryResolution {
  if (allowArbitraryAbsolute && path.isAbsolute(requestedRoot)) {
    return { ok: true, resolved: path.resolve(requestedRoot) }
  }
  return resolveWithinBoundary(startupRoot, requestedRoot)
}
