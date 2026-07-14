import * as fs from 'node:fs'
import { XMLParser } from 'fast-xml-parser'
import {
  isJsonObject,
  type ProjectSnapshot,
  type TestRunCaseResult,
  type TestRunImport,
} from '@codeomnivis/shared'

const MAX_XML_BYTES = 10 * 1024 * 1024

function values(value: unknown): unknown[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
}

function collectSuites(value: unknown): Array<{ name: string; cases: unknown[] }> {
  if (!isJsonObject(value)) return []
  const suites: Array<{ name: string; cases: unknown[] }> = []
  for (const suiteValue of values(value.testsuite)) {
    if (!isJsonObject(suiteValue)) continue
    suites.push({ name: stringValue(suiteValue.name), cases: values(suiteValue.testcase) })
    suites.push(...collectSuites(suiteValue.testsuites))
  }
  if (isJsonObject(value.testsuites)) suites.push(...collectSuites(value.testsuites))
  return suites
}

function caseResult(suite: string, value: unknown): TestRunCaseResult | null {
  if (!isJsonObject(value)) return null
  const failure = value.failure
  const failureMessage = isJsonObject(failure)
    ? stringValue(failure.message, stringValue(failure['#text']))
    : stringValue(failure)
  const status =
    value.skipped !== undefined
      ? 'skipped'
      : value.failure !== undefined || value.error !== undefined
        ? 'failed'
        : 'passed'
  return {
    suite: stringValue(value.classname, suite),
    name: stringValue(value.name, '<unnamed>'),
    status,
    durationMs: Math.max(0, Number(value.time ?? 0) * 1000) || 0,
    ...(failureMessage ? { failureMessage } : {}),
  }
}

export function importJunitXml(
  filePath: string,
  snapshot: Pick<ProjectSnapshot, 'graph'>,
  now = Date.now(),
): TestRunImport {
  const stat = fs.statSync(filePath)
  if (!stat.isFile()) throw new Error('JUnit XML input is not a file')
  if (stat.size > MAX_XML_BYTES) throw new Error('JUnit XML exceeds the 10 MiB limit')
  const xml = fs.readFileSync(filePath, 'utf8')
  if (/<!DOCTYPE|<!ENTITY/iu.test(xml))
    throw new Error('JUnit XML entity declarations are not allowed')
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    processEntities: false,
  })
  const parsed: unknown = parser.parse(xml)
  if (!isJsonObject(parsed)) throw new Error('JUnit XML root is invalid')
  const cases = collectSuites(parsed)
    .flatMap((suite) => suite.cases.map((value) => caseResult(suite.name, value)))
    .filter((result): result is TestRunCaseResult => result !== null)
  const staticCases = snapshot.graph.nodes.filter((node) => node.type === 'test_case')
  const unmatched = cases.filter(
    (result) =>
      !staticCases.some(
        (node) =>
          node.name === result.name ||
          node.name.endsWith(` > ${result.name}`) ||
          node.name === `${result.suite} > ${result.name}`,
      ),
  )
  return { source: 'junit_xml', importedAt: now, cases, unmatched }
}
