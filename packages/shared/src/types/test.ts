export type TestFramework =
  | 'vitest'
  | 'jest'
  | 'playwright'
  | 'cypress'
  | 'junit4'
  | 'junit5'
  | 'kotest'

const TEST_FRAMEWORKS = new Set<string>([
  'vitest', 'jest', 'playwright', 'cypress', 'junit4', 'junit5', 'kotest',
])

export function isTestFramework(value: string): value is TestFramework {
  return TEST_FRAMEWORKS.has(value)
}

export interface TestSuiteMetadata {
  framework: TestFramework
  kind: 'file' | 'describe' | 'class' | 'nested_class' | 'spec'
}

export interface TestCaseMetadata {
  framework: TestFramework
  isParameterized: boolean
  parameterSource?: string
  disabled: boolean
}

export interface TestFixtureMetadata {
  framework: TestFramework
  lifecycle: 'before_all' | 'before_each' | 'after_each' | 'after_all' | 'factory'
}

export interface TestsMetadata {
  relation: 'contains_case' | 'declares_target'
}

export interface CoversMetadata {
  evidence: 'direct_import' | 'direct_call' | 'route_reference' | 'source_mapping'
}

export interface UsesFixtureMetadata {
  usage: 'lexical_scope' | 'parameter' | 'explicit_call'
}
