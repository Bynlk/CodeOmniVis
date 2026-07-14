import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateAuditReport } from './auditProduction.mjs'

const REPORT = {
  advisories: {
    1234: {
      id: 1234,
      github_advisory_id: 'GHSA-test-1234',
      module_name: 'example-package',
      severity: 'high',
      title: 'Example reachable advisory',
      findings: [{ paths: ['.@example-package>transitive-package'] }],
    },
  },
}

test('fails a high production advisory and reports its dependency path', () => {
  const result = evaluateAuditReport(REPORT, [], new Date('2026-07-14T00:00:00Z'))

  assert.equal(result.unhandled.length, 1)
  assert.equal(result.unhandled[0].packageName, 'example-package')
  assert.deepEqual(result.unhandled[0].paths, ['.@example-package>transitive-package'])
})

test('accepts only an exact unexpired advisory-path exception', () => {
  const result = evaluateAuditReport(REPORT, [{
    advisoryId: 'GHSA-test-1234',
    path: '.@example-package>transitive-package',
    rationale: 'No fixed transitive release is available; the path is not invoked by the CLI.',
    expiresOn: '2026-08-01',
  }], new Date('2026-07-14T00:00:00Z'))

  assert.equal(result.unhandled.length, 0)
  assert.equal(result.exempted.length, 1)
  assert.equal(result.invalidExceptions.length, 0)
})

test('rejects expired and path-mismatched exceptions', () => {
  const result = evaluateAuditReport(REPORT, [
    {
      advisoryId: 'GHSA-test-1234',
      path: '.@example-package>transitive-package',
      rationale: 'Temporary exception pending an upstream patch.',
      expiresOn: '2026-07-13',
    },
    {
      advisoryId: 'GHSA-test-1234',
      path: 'unrelated>path',
      rationale: 'This path should not match the report.',
      expiresOn: '2026-08-01',
    },
  ], new Date('2026-07-14T00:00:00Z'))

  assert.deepEqual(
    result.invalidExceptions.map(exception => exception.reason).sort(),
    ['expired', 'path_mismatch'],
  )
  assert.equal(result.unhandled.length, 1)
})
