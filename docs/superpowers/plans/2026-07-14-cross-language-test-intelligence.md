# Cross-Language Test Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Discover and visualize TypeScript and Kotlin test structure, fixtures, and production-code coverage through the same `ProjectSnapshot` consumed by CLI, Web, and MCP.

**Architecture:** Test frameworks plug into an analyzer-owned `TestAdapter` registry and return ordinary `ParseResult` values. Static discovery is always safe and default; optional JUnit XML import enriches provenance, while executing target tests remains an explicit, bounded command outside the parser pipeline.

**Tech Stack:** TypeScript, ts-morph, web-tree-sitter/tree-sitter-kotlin, Vitest, Jest, Playwright, Cypress, JUnit 4/5, Kotest, Gradle XML, React, Cytoscape.js, MCP SDK, Vitest.

---

## File map

- `packages/shared/src/types/test.ts` — framework, node metadata, edge metadata, run-result contracts.
- `packages/analyzer/src/tests/types.ts` — `TestAdapter` and discovery context.
- `packages/analyzer/src/tests/registry.ts` — ordered adapter registry with error isolation.
- `packages/analyzer/src/tests/typescript/astHelpers.ts` — shared ts-morph call/import helpers.
- `packages/analyzer/src/tests/typescript/vitestJestAdapter.ts` — Vitest/Jest discovery.
- `packages/analyzer/src/tests/typescript/playwrightAdapter.ts` — Playwright discovery.
- `packages/analyzer/src/tests/typescript/cypressAdapter.ts` — Cypress discovery.
- `packages/analyzer/src/tests/kotlin/junitAdapter.ts` — JUnit 4/5 discovery.
- `packages/analyzer/src/tests/kotlin/kotestAdapter.ts` — Kotest spec/case discovery.
- `packages/analyzer/src/tests/testLinker.ts` — static test-to-production and fixture edges.
- `packages/analyzer/src/tests/junitXml.ts` — explicit Gradle/JUnit result import.
- `packages/cli/src/commands/testImport.ts` — explicit result import, never test execution.
- `packages/server/src/routes/tests.ts` — snapshot-backed test query endpoints.
- `packages/mcp/src/tools/getTestCoverage.ts` — MCP projection.
- `packages/ui/src/components/Workbench/TestExplorer.tsx` — suite/case tree.
- `packages/ui/src/components/Workbench/TestCanvas.tsx` — test/production topology view.
- `packages/ui/src/hooks/useTests.ts` — REST query hook.
- `packages/ui/src/lib/testView.ts` — pure view projection.

Every adapter is independent, does not import another adapter, does not access storage, catches file-level errors and returns warning `ParseError`s.

## Integration order with Core Quality 90

Begin after Core Tasks 1–9 have supplied public-contract guards, security, `ProjectSnapshot`, `analyzeProject()` and transactional storage. Complete Cross-Language Tasks 1–9, allow Core Tasks 10–12 to establish final coverage/browser/CI infrastructure, then complete Cross-Language Task 10. Core Tasks 13–14 remain the single final documentation, release and scoring gate.

### Task 1: Extend the shared graph with typed test contracts

**Files:**
- Create: `packages/shared/src/types/test.ts`
- Modify: `packages/shared/src/types/node.ts`
- Modify: `packages/shared/src/types/edge.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/constants/nodeColors.ts`
- Create: `packages/shared/__tests__/types/test.test.ts`
- Modify: `packages/shared/__tests__/types/node.test.ts`
- Modify: `packages/shared/__tests__/types/edge.test.ts`

- [ ] **Step 1: Write failing type guard and serialization tests**

```typescript
it('round-trips a parameterized JUnit case', () => {
  const node = createTypedNode({
    id: 'test_case:src/test/CheckoutTest.kt:CheckoutTest > rejectsExpiredCard',
    type: 'test_case',
    name: 'CheckoutTest > rejectsExpiredCard',
    filePath: 'src/test/CheckoutTest.kt',
    line: 18,
    column: 3,
    metadata: {
      framework: 'junit5',
      isParameterized: true,
      parameterSource: 'expiredCards',
      disabled: false,
    },
  })
  expect(isNodeOfType(node, 'test_case')).toBe(true)
})
```

Add matching tests for `tests`, `covers`, and `uses_fixture` metadata and reject an invalid framework/lifecycle/evidence value at the storage boundary.

- [ ] **Step 2: Run shared tests**

Run: `pnpm --filter @codeomnivis/shared test -- test.test.ts node.test.ts edge.test.ts`

Expected: FAIL because the test node/edge literals are not part of the discriminated unions.

- [ ] **Step 3: Add exact contracts**

```typescript
export type TestFramework =
  | 'vitest' | 'jest' | 'playwright' | 'cypress'
  | 'junit4' | 'junit5' | 'kotest'

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

export interface TestsMetadata { relation: 'contains_case' | 'declares_target' }
export interface CoversMetadata {
  evidence: 'direct_import' | 'direct_call' | 'route_reference' | 'source_mapping'
}
export interface UsesFixtureMetadata { usage: 'lexical_scope' | 'parameter' | 'explicit_call' }
```

Add `test_suite`, `test_case`, `test_fixture` to `NodeType`/metadata map and `tests`, `covers`, `uses_fixture` to `EdgeType`/metadata map. Use solid, non-gradient colors consistent with the current dark workbench.

- [ ] **Step 4: Run shared test, typecheck and lint**

Run: `pnpm --filter @codeomnivis/shared test && pnpm --filter @codeomnivis/shared typecheck && pnpm --filter @codeomnivis/shared lint`

Expected: PASS with no open metadata fallback or type assertion.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/test.ts packages/shared/src/types/node.ts packages/shared/src/types/edge.ts packages/shared/src/index.ts packages/shared/src/constants/nodeColors.ts packages/shared/__tests__/types
git commit -m "feat(shared): add typed test graph contracts"
```

### Task 2: Build an isolated TestAdapter registry

**Files:**
- Create: `packages/analyzer/src/tests/types.ts`
- Create: `packages/analyzer/src/tests/registry.ts`
- Create: `packages/analyzer/src/tests/createDefaultTestAdapters.ts`
- Create: `packages/analyzer/src/tests/index.ts`
- Modify: `packages/analyzer/src/index.ts`
- Modify: `packages/analyzer/src/graph/collectAnalysisFiles.ts`
- Create: `packages/analyzer/__tests__/tests/registry.test.ts`
- Modify: `packages/analyzer/__tests__/graph/collectAnalysisFiles.test.ts`

- [ ] **Step 1: Write registry failure-isolation tests**

Register three fake adapters: one declines, one throws, one returns a suite. Assert the registry returns the suite plus one warning and continues after the thrown adapter.

```typescript
expect(result.nodes.map(node => node.name)).toEqual(['suite'])
expect(result.errors).toEqual([
  expect.objectContaining({ file: fixture, severity: 'warning', message: expect.stringContaining('broken') }),
])
```

- [ ] **Step 2: Run the registry test**

Run: `pnpm --filter @codeomnivis/analyzer test -- registry.test.ts`

Expected: FAIL because there is no test adapter registry.

- [ ] **Step 3: Implement the interface and registry**

```typescript
export interface TestDiscoveryContext {
  projectRoot: string
  projectMeta: ProjectMeta
  tsConfig: import('typescript').ParsedCommandLine | null
  pathAliases: Record<string, string>
  knownProductionNodes: ReadonlyArray<OmniNode>
}

export interface TestAdapter {
  name: string
  canHandle(filePath: string, context: TestDiscoveryContext): boolean
  discover(filePath: string, context: TestDiscoveryContext): Promise<ParseResult>
}
```

`discoverTests()` checks `canHandle`, invokes every matching adapter in deterministic order, catches each adapter separately, merges/deduplicates results by ID, and never writes storage.

Extend canonical file collection with root `test`, `tests`, `__tests__`, `e2e`, `cypress/e2e` and workspace equivalents while retaining the existing ignored build/cache directories and realpath deduplication. Add a collection test proving root tests and Gradle `src/test` files are included once.

- [ ] **Step 4: Verify graceful degradation**

Run: `pnpm --filter @codeomnivis/analyzer test -- registry.test.ts && pnpm --filter @codeomnivis/analyzer typecheck`

Expected: PASS; a broken adapter cannot stop another framework or production parsing.

- [ ] **Step 5: Commit**

```bash
git add packages/analyzer/src/tests packages/analyzer/src/index.ts packages/analyzer/src/graph/collectAnalysisFiles.ts packages/analyzer/__tests__/tests/registry.test.ts packages/analyzer/__tests__/graph/collectAnalysisFiles.test.ts
git commit -m "feat(analyzer): add test adapter registry"
```

### Task 3: Discover Vitest and Jest suites, cases and fixtures

**Files:**
- Create: `packages/analyzer/src/tests/typescript/astHelpers.ts`
- Create: `packages/analyzer/src/tests/typescript/vitestJestAdapter.ts`
- Create: `packages/analyzer/__tests__/tests/typescript/vitestJestAdapter.test.ts`
- Create: `packages/analyzer/__tests__/fixtures/tests/typescript/vitest/`
- Create: `packages/analyzer/__tests__/fixtures/tests/typescript/jest/`
- Modify: `packages/analyzer/src/tests/createDefaultTestAdapters.ts`

- [ ] **Step 1: Add framework fixtures**

Fixtures must include nested `describe`, `it`, `test`, `.skip`, `.only`, `test.each`, `beforeAll`, `beforeEach`, `afterEach`, imported fixture factory, aliased imports, syntax error and an empty test file. Use a fake production `src/checkout.ts` imported and called by tests.

- [ ] **Step 2: Write adapter expectations**

Assert stable qualified names, correct line/column, framework selected from package/import evidence, parameterized metadata, disabled state, suite→case `tests` edges and lexical `uses_fixture` edges. Syntax error returns a warning without rejection.

- [ ] **Step 3: Run the adapter test**

Run: `pnpm --filter @codeomnivis/analyzer test -- vitestJestAdapter.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 4: Implement shared AST helpers**

```typescript
export function callPath(call: CallExpression): string[]
export function literalTestName(call: CallExpression): string | null
export function qualifiedTestName(ancestors: readonly string[], own: string): string
export function testNodeId(
  type: 'test_suite' | 'test_case' | 'test_fixture',
  filePath: string,
  qualifiedName: string,
): string
```

Resolve only static string/template-without-expression names. Dynamic names use a stable source-location name such as `<dynamic@24:3>` and emit an info warning.

- [ ] **Step 5: Implement Vitest/Jest discovery**

Use ts-morph to walk call expressions and imports. A file-level suite contains top-level cases; nested `describe` suites contain their direct cases. `test.each(data)('name', fn)` creates one parameterized case, not one case per runtime row. Hooks become `test_fixture` nodes scoped to the nearest suite.

- [ ] **Step 6: Run normal/error/boundary tests**

Run: `pnpm --filter @codeomnivis/analyzer test -- vitestJestAdapter.test.ts`

Expected: PASS for both frameworks and malformed/empty fixtures.

- [ ] **Step 7: Commit**

```bash
git add packages/analyzer/src/tests/typescript packages/analyzer/src/tests/createDefaultTestAdapters.ts packages/analyzer/__tests__/tests/typescript packages/analyzer/__tests__/fixtures/tests/typescript
git commit -m "feat(analyzer): discover Vitest and Jest tests"
```

### Task 4: Discover Playwright and Cypress tests

**Files:**
- Create: `packages/analyzer/src/tests/typescript/playwrightAdapter.ts`
- Create: `packages/analyzer/src/tests/typescript/cypressAdapter.ts`
- Create: `packages/analyzer/__tests__/tests/typescript/playwrightAdapter.test.ts`
- Create: `packages/analyzer/__tests__/tests/typescript/cypressAdapter.test.ts`
- Create: `packages/analyzer/__tests__/fixtures/tests/typescript/playwright/`
- Create: `packages/analyzer/__tests__/fixtures/tests/typescript/cypress/`
- Modify: `packages/analyzer/src/tests/createDefaultTestAdapters.ts`

- [ ] **Step 1: Write Playwright fixtures and tests**

Cover `test.describe`, `test`, `test.beforeEach`, `test.extend`, destructured fixture parameters, skipped tests and a page route visit. Assert fixture-parameter `uses_fixture` edges and route-reference coverage evidence.

- [ ] **Step 2: Write Cypress fixtures and tests**

Cover `describe`, `context`, `it`, hooks, `cy.visit`, `cy.request`, aliases and malformed files. Assert suite/case hierarchy and route/API references remain `inferred` unless a production node is matched exactly.

- [ ] **Step 3: Run tests and verify adapters are absent**

Run: `pnpm --filter @codeomnivis/analyzer test -- playwrightAdapter.test.ts cypressAdapter.test.ts`

Expected: FAIL because neither adapter exists.

- [ ] **Step 4: Implement Playwright without misclassifying Vitest**

Require `@playwright/test` import or project dependency before handling. Recognize `test.extend` fields as fixtures and callback parameters as uses. Do not execute config files or fixture factories.

- [ ] **Step 5: Implement Cypress without misclassifying Jest**

Require Cypress dependency/import, `cypress/e2e` path, or `cy.*` evidence. Reuse only pure helpers from `astHelpers.ts`; do not import the Vitest/Jest adapter.

- [ ] **Step 6: Run all TypeScript adapter tests**

Run: `pnpm --filter @codeomnivis/analyzer test -- __tests__/tests/typescript`

Expected: PASS with no file parsed twice into duplicate node IDs.

- [ ] **Step 7: Commit**

```bash
git add packages/analyzer/src/tests/typescript packages/analyzer/src/tests/createDefaultTestAdapters.ts packages/analyzer/__tests__/tests/typescript packages/analyzer/__tests__/fixtures/tests/typescript
git commit -m "feat(analyzer): discover browser test frameworks"
```

### Task 5: Discover JUnit 4/5 and Kotest structures

**Files:**
- Create: `packages/analyzer/src/tests/kotlin/kotlinTestHelpers.ts`
- Create: `packages/analyzer/src/tests/kotlin/junitAdapter.ts`
- Create: `packages/analyzer/src/tests/kotlin/kotestAdapter.ts`
- Create: `packages/analyzer/__tests__/tests/kotlin/junitAdapter.test.ts`
- Create: `packages/analyzer/__tests__/tests/kotlin/kotestAdapter.test.ts`
- Create: `packages/analyzer/__tests__/fixtures/tests/kotlin/junit4/`
- Create: `packages/analyzer/__tests__/fixtures/tests/kotlin/junit5/`
- Create: `packages/analyzer/__tests__/fixtures/tests/kotlin/kotest/`
- Modify: `packages/analyzer/src/tests/createDefaultTestAdapters.ts`

- [ ] **Step 1: Create Kotlin fixtures**

JUnit fixtures cover `@Test`, `@Before`/`@BeforeEach`, `@After`/`@AfterEach`, `@Disabled`, `@Ignore`, `@ParameterizedTest`, `@MethodSource`, `@ValueSource`, `@Nested` and malformed Kotlin. Kotest fixtures cover `FunSpec`, `StringSpec`, `BehaviorSpec`, `DescribeSpec`, lifecycle hooks and dynamic data-test syntax.

- [ ] **Step 2: Write structural expectations**

Assert class/spec suites, nested suites, test cases, lifecycle fixtures, parameter source metadata and stable qualified IDs. A parameterized method is one static case. Dynamic runtime rows are not expanded.

- [ ] **Step 3: Run Kotlin adapter tests**

Run: `pnpm --filter @codeomnivis/analyzer test -- junitAdapter.test.ts kotestAdapter.test.ts`

Expected: FAIL because the adapters do not exist.

- [ ] **Step 4: Implement JUnit discovery with tree-sitter**

Reuse `treeSitterInit.ts` and Kotlin CST walking primitives, but keep annotation/class/function interpretation in `junitAdapter.ts`. Detect JUnit version from imports first, then annotation package evidence. An unknown `@Test` import produces a framework warning rather than guessing certain JUnit version.

- [ ] **Step 5: Implement Kotest spec discovery**

Match supported spec base classes and their well-known DSL calls. Unknown custom DSL extensions are skipped with info-level explanation. File parse exceptions return empty results plus warning.

- [ ] **Step 6: Run all Kotlin parser and adapter tests**

Run: `pnpm --filter @codeomnivis/analyzer test -- __tests__/parsers/kotlin __tests__/tests/kotlin`

Expected: PASS; existing Kotlin application parsers remain unaffected.

- [ ] **Step 7: Commit**

```bash
git add packages/analyzer/src/tests/kotlin packages/analyzer/src/tests/createDefaultTestAdapters.ts packages/analyzer/__tests__/tests/kotlin packages/analyzer/__tests__/fixtures/tests/kotlin
git commit -m "feat(analyzer): discover JUnit and Kotest tests"
```

### Task 6: Link tests to fixtures and production nodes

**Files:**
- Create: `packages/analyzer/src/tests/testLinker.ts`
- Create: `packages/analyzer/src/tests/productionIndex.ts`
- Modify: `packages/analyzer/src/graph/analyzeProject.ts`
- Create: `packages/analyzer/__tests__/tests/testLinker.test.ts`
- Create: `packages/analyzer/__tests__/integration/testDiscovery.test.ts`

- [ ] **Step 1: Write confidence and dangling-edge tests**

Cases: direct imported function call → `covers/certain/direct_call`; imported component without call → `covers/inferred/direct_import`; exact `/api/orders` reference → `covers/inferred/route_reference`; unresolved symbol → no edge plus info warning; fixture in parent scope → `uses_fixture/certain/lexical_scope`. Assert every source/target exists.

- [ ] **Step 2: Run linker tests**

Run: `pnpm --filter @codeomnivis/analyzer test -- testLinker.test.ts testDiscovery.test.ts`

Expected: FAIL because test discovery is not part of the unified pipeline and no production index exists.

- [ ] **Step 3: Build a read-only production index**

```typescript
export interface ProductionIndex {
  byFile: ReadonlyMap<string, readonly OmniNode[]>
  byExportName: ReadonlyMap<string, readonly OmniNode[]>
  byRoute: ReadonlyMap<string, readonly OmniNode[]>
}
```

Normalize paths relative to project root and never match only on a common short name when multiple candidates exist.

- [ ] **Step 4: Implement deterministic linking**

Run adapters after production parsers but before graph validation. Add test nodes first, then suite/case/fixture structural edges, then coverage edges from import/call/route evidence. Deduplicate by `{source}--{type}--{target}` and preserve the strongest evidence (`certain` before `inferred`).

- [ ] **Step 5: Run integration and graph invariant tests**

Run: `pnpm --filter @codeomnivis/analyzer test -- testLinker.test.ts testDiscovery.test.ts builder.test.ts`

Expected: PASS; no dangling edge, duplicate edge, cross-adapter duplicate node or storage access from adapters.

- [ ] **Step 6: Commit**

```bash
git add packages/analyzer/src/tests/testLinker.ts packages/analyzer/src/tests/productionIndex.ts packages/analyzer/src/graph/analyzeProject.ts packages/analyzer/__tests__/tests/testLinker.test.ts packages/analyzer/__tests__/integration/testDiscovery.test.ts
git commit -m "feat(analyzer): link tests to production graph"
```

### Task 7: Import JUnit/Gradle XML without executing tests

**Files:**
- Create: `packages/analyzer/src/tests/junitXml.ts`
- Create: `packages/analyzer/__tests__/tests/junitXml.test.ts`
- Create: `packages/analyzer/__tests__/fixtures/tests/results/`
- Create: `packages/cli/src/commands/testImport.ts`
- Modify: `packages/cli/src/program.ts`
- Create: `packages/cli/__tests__/commands/testImport.test.ts`
- Modify: `packages/shared/src/types/snapshot.ts`
- Modify: `packages/shared/__tests__/types/snapshot.test.ts`
- Modify: `packages/analyzer/package.json`
- Modify: `packages/cli/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Write safe XML import tests**

Cover passing/failing/skipped cases, parameterized display names, malformed XML, XML entity declarations, oversized input and paths outside project root. Entity declarations and files above 10 MiB must be rejected before parsing.

- [ ] **Step 2: Run importer tests**

Run: `pnpm --filter @codeomnivis/analyzer test -- junitXml.test.ts && pnpm --filter @bynlk/codeomnivis test -- testImport.test.ts`

Expected: FAIL because no importer or explicit command exists.

- [ ] **Step 3: Implement a non-executing importer**

Run: `pnpm --filter @codeomnivis/analyzer add fast-xml-parser@^5.10.0 && pnpm --filter @bynlk/codeomnivis add fast-xml-parser@^5.10.0`

```typescript
export interface TestRunCaseResult {
  suite: string
  name: string
  status: 'passed' | 'failed' | 'skipped'
  durationMs: number
  failureMessage?: string
}

export interface TestRunImport {
  source: 'junit_xml'
  importedAt: number
  cases: TestRunCaseResult[]
  unmatched: TestRunCaseResult[]
}
```

Use `fast-xml-parser` with entity processing disabled and strict size limits. Match results to static nodes by class/name with normalization; unmatched runtime cases remain provenance, not fabricated graph nodes.

Extend `ProjectSnapshot.provenance` with optional `testRuns: TestRunImport[]`; `computeSnapshotDigest()` includes normalized imported case results but excludes `importedAt`, so the same result file keeps the same semantic digest.

- [ ] **Step 4: Add explicit CLI import**

Register `codeomnivis test-import --project <path> --junit <file-or-glob>`. Resolve inputs inside the project boundary, read the last committed snapshot, append normalized run provenance through the transactional store, print counts, and never invoke Gradle/npm/test executables. A rejected import leaves the prior snapshot unchanged.

- [ ] **Step 5: Run importer/CLI tests**

Run: `pnpm --filter @codeomnivis/analyzer test -- junitXml.test.ts && pnpm --filter @bynlk/codeomnivis test -- testImport.test.ts`

Expected: PASS; malformed/untrusted XML degrades safely and no child process is spawned.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/types/snapshot.ts packages/shared/__tests__/types/snapshot.test.ts packages/analyzer/src/tests/junitXml.ts packages/analyzer/package.json packages/analyzer/__tests__/tests/junitXml.test.ts packages/analyzer/__tests__/fixtures/tests/results packages/cli/src/commands/testImport.ts packages/cli/src/program.ts packages/cli/package.json packages/cli/__tests__/commands/testImport.test.ts pnpm-lock.yaml
git commit -m "feat(cli): import JUnit test results safely"
```

### Task 8: Run target tests only through a bounded explicit command

**Files:**
- Create: `packages/cli/src/commands/testRun.ts`
- Create: `packages/cli/src/utils/testRunner.ts`
- Modify: `packages/cli/src/program.ts`
- Create: `packages/cli/__tests__/commands/testRun.test.ts`
- Create: `packages/cli/__tests__/fixtures/test-runners/`

- [ ] **Step 1: Write command-boundary tests**

Assert no test process starts during `analyze`, `serve`, MCP startup or Web requests. For explicit `test-run`, assert only enumerated runners are accepted, `spawn` receives an argv array with `shell: false`, cwd is the validated project root, timeout sends SIGTERM then SIGKILL, output above 10 MiB is truncated, and non-zero test exit does not replace the static snapshot.

- [ ] **Step 2: Run the command tests**

Run: `pnpm --filter @bynlk/codeomnivis test -- testRun.test.ts`

Expected: FAIL because `test-run` and the bounded runner do not exist.

- [ ] **Step 3: Implement an enumerated runner plan**

```typescript
export type SupportedTestRunner = 'vitest' | 'jest' | 'playwright' | 'cypress' | 'gradle'

export interface TestRunRequest {
  projectRoot: string
  runner: SupportedTestRunner
  timeoutMs: number
  extraArgs: readonly string[]
}

export interface TestRunResult {
  exitCode: number | null
  signal: NodeJS.Signals | null
  timedOut: boolean
  stdout: string
  stderr: string
  truncated: boolean
}
```

Map runners to local executables without shell interpolation: pnpm exec `vitest --run`, `jest --runInBand`, `playwright test`, `cypress run`, or the validated project-root `gradlew test`. Reject absolute extra-argument paths outside the project and values containing NUL. Default timeout is 10 minutes and may be lowered/raised only within 1 second–30 minutes.

- [ ] **Step 4: Register the explicit CLI command**

Register `codeomnivis test-run --project <path> --runner <runner> [--timeout <ms>] [--junit <path>] -- [runner args]`. Before spawn, print the exact cwd and argv to stderr. After completion, import generated JUnit XML only when `--junit <path>` is explicitly supplied; otherwise report process status without changing the snapshot.

- [ ] **Step 5: Verify non-execution defaults and cleanup**

Run: `pnpm --filter @bynlk/codeomnivis test -- testRun.test.ts && pnpm --filter @bynlk/codeomnivis test -- packedCli.test.ts`

Expected: PASS; default commands never spawn tests, explicit runs are bounded and child processes are always reaped.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/testRun.ts packages/cli/src/utils/testRunner.ts packages/cli/src/program.ts packages/cli/__tests__/commands/testRun.test.ts packages/cli/__tests__/fixtures/test-runners
git commit -m "feat(cli): add explicit bounded test runner"
```

### Task 9: Expose the same test view through REST, Web and MCP

**Files:**
- Create: `packages/server/src/routes/tests.ts`
- Modify: `packages/server/src/index.ts`
- Create: `packages/server/__tests__/routes/tests.test.ts`
- Create: `packages/mcp/src/tools/getTestCoverage.ts`
- Modify: `packages/mcp/src/server.ts`
- Create: `packages/mcp/__tests__/tools/getTestCoverage.test.ts`
- Create: `packages/ui/src/hooks/useTests.ts`
- Create: `packages/ui/src/lib/testView.ts`
- Create: `packages/ui/src/components/Workbench/TestExplorer.tsx`
- Create: `packages/ui/src/components/Workbench/TestCanvas.tsx`
- Modify: `packages/ui/src/lib/workbenchViews.ts`
- Modify: `packages/ui/src/components/Workbench/WorkbenchShell.tsx`
- Modify: `packages/ui/src/utils/cytoscapeConfig.ts`
- Modify: `packages/ui/src/utils/graphTransform.ts`
- Modify: `packages/ui/src/locales/en-US.json`
- Modify: `packages/ui/src/locales/zh-CN.json`
- Create: `packages/ui/__tests__/components/testView.test.tsx`

- [ ] **Step 1: Write REST/MCP projection tests**

`GET /api/tests` returns suites/cases/fixtures/coverage summary and snapshot identity. MCP adds `get_test_coverage` with optional `target`/`framework` filters and the same summary/digest. Non-loopback requests use the shared access guard.

- [ ] **Step 2: Write UI projection tests**

Assert the Test view appears in the workbench rail, explorer groups suite→case, filters framework/status, selecting a case focuses its `covers` edges, and empty/error/loading states are translated in both locales.

- [ ] **Step 3: Run surface tests**

Run: `pnpm --filter @codeomnivis/server test -- routes/tests.test.ts && pnpm --filter @codeomnivis/mcp test -- getTestCoverage.test.ts && pnpm --filter @codeomnivis/ui test -- testView.test.tsx`

Expected: FAIL because the route, tool and UI view do not exist.

- [ ] **Step 4: Implement one pure projection**

```typescript
export interface TestViewSummary {
  suites: number
  cases: number
  fixtures: number
  coveredTargets: number
  uncoveredTargets: number
  byFramework: Record<TestFramework, number>
}
```

Place graph-to-test-view selection in analyzer/shared query code used by REST and MCP; UI `testView.ts` only shapes presentation and never recalculates semantic coverage differently.

- [ ] **Step 5: Implement restrained workbench view**

Use the existing dark tokens, no gradients, existing rail/header/status patterns, multiple canvases and progressive expansion. Default to suite groups; expanding reveals cases/fixtures, selecting a case reveals covered production nodes. Keep new component files below 300 lines.

- [ ] **Step 6: Run unit, i18n and browser E2E**

Run: `pnpm --filter @codeomnivis/ui test && pnpm test:e2e --grep "test intelligence"`

Expected: PASS; no raw i18n key, console error or graph dangling-edge warning.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/routes/tests.ts packages/server/src/index.ts packages/server/__tests__/routes/tests.test.ts packages/mcp/src/tools/getTestCoverage.ts packages/mcp/src/server.ts packages/mcp/__tests__/tools/getTestCoverage.test.ts packages/ui/src packages/ui/__tests__/components/testView.test.tsx e2e
git commit -m "feat(ui): add cross-language test view"
```

### Task 10: Verify cross-surface parity, performance and documentation

**Files:**
- Create: `packages/contract-tests/fixtures/test-intelligence/`
- Create: `packages/contract-tests/__tests__/testIntelligenceParity.test.ts`
- Create: `packages/analyzer/__tests__/performance/testDiscovery.bench.test.ts`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/architecture/data-model.md`
- Create: `docs/guides/test-intelligence.md`
- Modify: `docs/api/rest-api.md`
- Modify: `docs/api/mcp-tools.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add a mixed TS/Kotlin parity fixture**

The fixture contains Vitest, Jest, Playwright, Cypress, JUnit 4/5 and Kotest plus production routes/components/services/models. Keep it small and deterministic; no external package install is needed for static AST/CST discovery.

- [ ] **Step 2: Write parity and performance tests**

Direct analyzer, CLI JSON, REST and MCP must expose the same snapshot digest and test node/edge ID sets. On a generated 1,000-file fixture, test discovery must keep the full 1,000-file analysis under the existing 60-second target on the CI runner class; the test records timing and fails above the target.

- [ ] **Step 3: Run parity/performance tests**

Run: `pnpm --filter @codeomnivis/contract-tests test -- testIntelligenceParity.test.ts && pnpm --filter @codeomnivis/analyzer test -- testDiscovery.bench.test.ts`

Expected: PASS with identical digest and no parser crash.

- [ ] **Step 4: Document supported semantics and limits**

Document the exact supported constructs, `certain` versus `inferred`, parameterized-test behavior, dynamic-name fallback, default no-execution policy, explicit `test-run`/`test-import`, JUnit XML safety limits, REST route and MCP tool. Do not describe static `covers` edges as runtime code coverage.

- [ ] **Step 5: Run documentation and final quality gates**

Run: `pnpm verify:readme && pnpm verify:contracts && pnpm quality:gate`

Expected: PASS, including coverage, browser E2E, MCP protocol, package verification and cross-surface snapshot parity.

- [ ] **Step 6: Commit**

```bash
git add packages/contract-tests packages/analyzer/__tests__/performance README.md README.zh-CN.md docs/architecture/data-model.md docs/guides/test-intelligence.md docs/api/rest-api.md docs/api/mcp-tools.md CHANGELOG.md
git commit -m "docs(docs): document test intelligence contracts"
```

## Final acceptance checklist

- [ ] Vitest, Jest, Playwright, Cypress, JUnit 4/5 and Kotest normal/error/boundary fixtures pass.
- [ ] `test_suite`, `test_case`, `test_fixture`, `tests`, `covers`, `uses_fixture` are closed discriminated unions.
- [ ] All adapter failures degrade to warnings and never interrupt production analysis.
- [ ] No adapter imports another adapter or accesses storage.
- [ ] All test edges have existing endpoints and confidence.
- [ ] Parameterized tests are stable static nodes; runtime rows come only from explicit imported results.
- [ ] Static analysis never executes target tests.
- [ ] Only explicit `test-run` can execute tests, with shell disabled, timeout, cancellation and output limits.
- [ ] CLI, REST/Web and MCP expose one snapshot digest and identical test graph IDs.
- [ ] Test view follows the restrained dark workbench design, multiple views and progressive expansion.
- [ ] 1,000-file analysis remains under 60 seconds on the documented runner class.
- [ ] Core `pnpm quality:gate` and official npm release gate both pass after integration.
