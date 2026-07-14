import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const AUDIT_EXCEPTIONS = []

function asObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function advisoryIdentity(advisory) {
  if (typeof advisory.github_advisory_id === 'string') return advisory.github_advisory_id
  if (typeof advisory.id === 'number' || typeof advisory.id === 'string') return String(advisory.id)
  return 'unknown-advisory'
}

function advisoryPaths(advisory) {
  if (!Array.isArray(advisory.findings)) return []
  return [
    ...new Set(
      advisory.findings.flatMap((finding) => {
        const object = asObject(finding)
        return object && Array.isArray(object.paths)
          ? object.paths.filter((path) => typeof path === 'string')
          : []
      }),
    ),
  ].sort()
}

function validateException(exception, advisories, now) {
  const object = asObject(exception)
  if (
    !object ||
    typeof object.advisoryId !== 'string' ||
    typeof object.path !== 'string' ||
    typeof object.rationale !== 'string' ||
    typeof object.expiresOn !== 'string' ||
    object.rationale.trim().length < 10 ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(object.expiresOn)
  ) {
    return { exception, reason: 'invalid_shape' }
  }
  const expiresAt = Date.parse(`${object.expiresOn}T23:59:59.999Z`)
  if (!Number.isFinite(expiresAt)) return { exception, reason: 'invalid_expiry' }
  if (expiresAt < now.getTime()) return { exception, reason: 'expired' }

  const advisory = advisories.find((candidate) => advisoryIdentity(candidate) === object.advisoryId)
  if (!advisory) return { exception, reason: 'advisory_missing' }
  if (!advisoryPaths(advisory).includes(object.path)) {
    return { exception, reason: 'path_mismatch' }
  }
  return null
}

export function evaluateAuditReport(report, exceptions = AUDIT_EXCEPTIONS, now = new Date()) {
  const object = asObject(report)
  const advisoryMap = object ? asObject(object.advisories) : null
  const advisories = advisoryMap
    ? Object.values(advisoryMap).filter((value) => asObject(value) !== null)
    : []
  const severe = advisories.filter(
    (advisory) => advisory.severity === 'high' || advisory.severity === 'critical',
  )
  const invalidExceptions = exceptions
    .map((exception) => validateException(exception, severe, now))
    .filter((result) => result !== null)
  const validExceptions = exceptions.filter(
    (exception) => !invalidExceptions.some((invalid) => invalid.exception === exception),
  )

  const unhandled = []
  const exempted = []
  for (const advisory of severe) {
    const advisoryId = advisoryIdentity(advisory)
    const paths = advisoryPaths(advisory)
    const exemptedPaths = paths.filter((path) =>
      validExceptions.some(
        (exception) => exception.advisoryId === advisoryId && exception.path === path,
      ),
    )
    const remainingPaths = paths.filter((path) => !exemptedPaths.includes(path))
    const item = {
      advisoryId,
      packageName:
        typeof advisory.module_name === 'string' ? advisory.module_name : 'unknown-package',
      severity: advisory.severity,
      title: typeof advisory.title === 'string' ? advisory.title : 'Untitled advisory',
      paths: remainingPaths.length > 0 ? remainingPaths : paths,
    }
    if (paths.length > 0 && remainingPaths.length === 0) exempted.push(item)
    else unhandled.push(item)
  }

  return { unhandled, exempted, invalidExceptions }
}

function printItem(item) {
  const paths = item.paths.length > 0 ? item.paths.join(', ') : '(path unavailable)'
  return `${item.severity} ${item.advisoryId} ${item.packageName}: ${item.title}\n  ${paths}`
}

export function runProductionAudit(cwd = process.cwd()) {
  const audit = spawnSync('pnpm', ['audit', '--prod', '--json'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })
  if (!audit.stdout.trim()) {
    console.error('Production audit failed without a machine-readable report.')
    if (audit.stderr.trim()) console.error(audit.stderr.trim())
    return 1
  }

  let report
  try {
    report = JSON.parse(audit.stdout)
  } catch {
    console.error('Production audit returned invalid JSON.')
    return 1
  }

  const result = evaluateAuditReport(report)
  for (const invalid of result.invalidExceptions) {
    const exception = asObject(invalid.exception)
    console.error(
      `Invalid audit exception (${invalid.reason}): ${exception?.advisoryId ?? 'unknown'} ${exception?.path ?? 'unknown'}`,
    )
  }
  for (const item of result.unhandled) console.error(printItem(item))
  for (const item of result.exempted) console.warn(`Temporarily exempted: ${printItem(item)}`)

  const metadata = asObject(report)?.metadata
  const counts = asObject(metadata)?.vulnerabilities
  if (asObject(counts)) {
    console.log(
      `Production audit totals: critical=${counts.critical ?? 0}, high=${counts.high ?? 0}, moderate=${counts.moderate ?? 0}, low=${counts.low ?? 0}`,
    )
  }
  console.log(`Production audit: ${result.unhandled.length} unhandled high/critical advisories`)
  return result.unhandled.length > 0 || result.invalidExceptions.length > 0 ? 1 : 0
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = runProductionAudit()
}
