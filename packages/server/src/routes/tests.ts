import { Router } from 'express'
import type { OmniDatabase } from '@codeomnivis/analyzer'
import { projectTestView } from '@codeomnivis/analyzer'
import { isTestFramework } from '@codeomnivis/shared'

export function createTestsRouter(db: OmniDatabase): Router {
  const router = Router()
  router.get('/', (req, res) => {
    const framework =
      typeof req.query.framework === 'string' && isTestFramework(req.query.framework)
        ? req.query.framework
        : undefined
    const target = typeof req.query.target === 'string' ? req.query.target : undefined
    const snapshot = db.loadSnapshot()
    res.json({
      data: projectTestView(db.loadGraph(), { framework, target }),
      meta: {
        snapshotId: snapshot?.snapshotId ?? null,
        snapshotDigest: snapshot?.snapshotDigest ?? null,
      },
    })
  })
  return router
}
