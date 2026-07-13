# Unified Quality Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Web Quality workspace truthfully present parser output and all existing deterministic project-risk findings.

**Architecture:** Add a shared sourced-issue contract and a Server collector that runs existing detectors independently behind `GET /api/graph/issues`. Add a validated UI service and query, normalize it with parser errors into one view model, and update the Quality surfaces and invalidation paths.

**Tech Stack:** TypeScript, Express, React 18, React Query, Tailwind CSS, Vitest, Supertest.

---

### Task 1: Shared sourced-issue contract

**Files:**
- Modify: `packages/shared/src/types/issue.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/__tests__/types/issue.test.ts`

- [ ] **Step 1: Write a failing type/runtime fixture test**

Add a test importing the new `IssueSource`, `IssueDetectorId`, `IssueDetectorStatus`, and `SourcedIssue` types from the package entry and constructing a sourced authentication issue.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @codeomnivis/shared test -- issue.test.ts`

Expected: TypeScript/Vitest fails because the sourced-issue types are not exported.

- [ ] **Step 3: Add the minimal contract**

Define:

```ts
export type IssueSource = 'consistency' | 'security' | 'performance' | 'framework'
export type IssueDetectorId = 'consistency' | 'auth' | 'n_plus_one' | 'rsc'
export interface IssueDetectorStatus {
  id: IssueDetectorId
  status: 'complete' | 'failed'
  message?: string
}
export interface SourcedIssue extends Issue {
  source: IssueSource
}
```

Export them from `packages/shared/src/index.ts`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same command and expect the new test to pass.

### Task 2: Detector orchestration with graceful degradation

**Files:**
- Create: `packages/server/src/graphIssues.ts`
- Test: `packages/server/__tests__/graphIssues.test.ts`

- [ ] **Step 1: Write failing collector tests**

Cover three behaviors with injected detector functions:

```ts
it('labels, de-duplicates, and severity-sorts detector findings', () => {})
it('keeps successful findings when one detector fails', () => {})
it('returns deterministic summary and detector statuses', () => {})
```

The degraded test must assert that one thrown detector produces `{ status: 'failed' }` while findings from other detectors remain in the report.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @codeomnivis/server test -- graphIssues.test.ts`

Expected: fail because `src/graphIssues.ts` does not exist.

- [ ] **Step 3: Implement the collector**

Expose:

```ts
export interface GraphIssuesReport {
  issues: SourcedIssue[]
  summary: { total: number; critical: number; warning: number; info: number }
  detectors: IssueDetectorStatus[]
}

export function collectGraphIssues(
  graph: OmniGraph,
  projectRoot: string,
  detectors?: GraphIssueDetectors,
): GraphIssuesReport
```

Default detectors instantiate and reuse `ConsistencyChecker`, `AuthDetector`, `NPlusOneDetector`, and `RSCBoundaryDetector`. Catch failures per detector, normalize safe error messages, de-duplicate by `id`, and sort critical before warning before info.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same command and expect all collector tests to pass.

### Task 3: Structured graph issues endpoint

**Files:**
- Modify: `packages/server/src/routes/graph.ts`
- Modify: `packages/server/src/index.ts`
- Modify: `packages/server/__tests__/routes/graph.test.ts`

- [ ] **Step 1: Write a failing route test**

Create an isolated in-memory database containing an uncalled route. Mount the graph router with a temporary project-root provider and assert:

```ts
expect(res.status).toBe(200)
expect(res.body.data).toEqual(expect.arrayContaining([
  expect.objectContaining({ source: 'consistency', type: 'dead_route' }),
]))
expect(res.body.meta).toMatchObject({ count: 1, warning: 1 })
expect(res.body.meta.detectors).toHaveLength(4)
```

- [ ] **Step 2: Run the route test and verify RED**

Run: `pnpm --filter @codeomnivis/server test -- routes/graph.test.ts`

Expected: `GET /api/graph/issues` returns 404.

- [ ] **Step 3: Implement the endpoint and dynamic root provider**

Extend `createGraphRouter` with an optional `getProjectRoot: () => string` argument. The endpoint loads the current graph, calls `collectGraphIssues`, and returns `{ data: report.issues, meta: { ...report.summary, count: report.summary.total, detectors: report.detectors } }`.

Pass `() => app.locals.projectRoot as string` from `createOmniServer`, so a later project switch is reflected by the existing router instance.

- [ ] **Step 4: Run Server tests and verify GREEN**

Run:

```bash
pnpm --filter @codeomnivis/server test -- routes/graph.test.ts graphIssues.test.ts
pnpm --filter @codeomnivis/server typecheck
```

Expected: all commands exit 0.

### Task 4: UI service, query, and normalized view model

**Files:**
- Modify: `packages/ui/src/services/graph.ts`
- Create: `packages/ui/src/hooks/useGraphIssues.ts`
- Create: `packages/ui/src/lib/qualityFindings.ts`
- Modify: `packages/ui/__tests__/services/graph.service.test.ts`
- Create: `packages/ui/__tests__/lib/qualityFindings.test.ts`

- [ ] **Step 1: Write failing network-boundary tests**

Assert that `getGraphIssues` requests `/api/graph/issues`, rejects a malformed envelope, filters malformed issue entries, and preserves detector failure metadata.

- [ ] **Step 2: Write failing view-model tests**

Assert that `mergeQualityFindings`:

- combines parser and sourced issues;
- preserves critical/error/warning/info;
- adds `parser` as the parser-error source;
- sorts by severity then location;
- returns stable IDs for repeated input.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
pnpm --filter @codeomnivis/ui test -- graph.service.test.ts qualityFindings.test.ts
```

Expected: fail because the service and view-model exports do not exist.

- [ ] **Step 4: Implement minimal service, hook, and pure view model**

Use the query key `['graph-issues']`. Do not add polling; rely on initial load and existing analysis invalidations.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the same focused command and `pnpm --filter @codeomnivis/ui typecheck`; expect exit 0.

### Task 5: Truthful Quality canvas and explorer

**Files:**
- Modify: `packages/ui/src/components/Workbench/QualityCanvas.tsx`
- Modify: `packages/ui/src/components/Workbench/QualityExplorer.tsx`
- Modify: `packages/ui/src/components/Workbench/CanvasHeader.tsx`
- Modify: `packages/ui/src/App.tsx`
- Modify: `packages/ui/src/locales/en-US.json`
- Modify: `packages/ui/src/locales/zh-CN.json`
- Modify: `packages/ui/__tests__/components/qualityCanvas.test.tsx`
- Modify: `packages/ui/__tests__/components/qualityExplorer.test.tsx`
- Modify: `packages/ui/__tests__/components/workbenchI18n.test.tsx`

- [ ] **Step 1: Write failing component tests**

Cover:

- 6 critical security plus 7 warning consistency findings render as 13 total;
- source, type, and `file:line` appear in each row;
- a project root produces an encoded VS Code link;
- partial request or detector failure renders a partial-results notice;
- both requests failing renders unavailable;
- the healthy empty state appears only with complete successful inputs;
- English and Chinese labels contain no parser-only empty-state copy.

- [ ] **Step 2: Run component tests and verify RED**

Run:

```bash
pnpm --filter @codeomnivis/ui test -- qualityCanvas.test.tsx qualityExplorer.test.tsx workbenchI18n.test.tsx
```

Expected: assertions fail against the parser-only component props and copy.

- [ ] **Step 3: Implement restrained list presentation**

Keep the current flat workbench styling. Add critical severity, source/type labels, partial status, and location links. Keep each component below 300 lines and use the existing Tailwind tokens without gradients.

- [ ] **Step 4: Wire App to both queries**

Call `useGraphIssues`, normalize with `mergeQualityFindings`, and use the merged count for `CanvasHeader` and `ViewRail`. Pass current project root to `QualityCanvas` for source links.

- [ ] **Step 5: Run focused tests, typecheck, lint, and build**

Run:

```bash
pnpm --filter @codeomnivis/ui test -- qualityCanvas.test.tsx qualityExplorer.test.tsx workbenchI18n.test.tsx workbenchApp.test.tsx
pnpm --filter @codeomnivis/ui typecheck
pnpm --filter @codeomnivis/ui lint
pnpm --filter @codeomnivis/ui build
```

Expected: all commands exit 0 with no warnings introduced by the changed components.

### Task 6: Complete invalidation paths

**Files:**
- Modify: `packages/ui/src/hooks/invalidateAnalysisQueries.ts`
- Modify: `packages/ui/src/hooks/useWebSocket.ts`
- Modify: `packages/ui/__tests__/hooks/invalidateAnalysisQueries.test.ts`
- Modify: `packages/ui/__tests__/hooks/websocketController.test.ts`

- [ ] **Step 1: Write failing invalidation assertions**

Add `['graph-issues']` to the expected manual/project-switch invalidation list. Assert a `graph_updated` message causes both parser errors and project issues to be invalidated.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm --filter @codeomnivis/ui test -- invalidateAnalysisQueries.test.ts websocketController.test.ts
```

Expected: the new `graph-issues` expectations fail.

- [ ] **Step 3: Add the missing query invalidations**

Update the shared analysis key list and WebSocket graph-update handler.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same command and expect exit 0.

### Task 7: Demo and full completion audit

**Files:**
- Modify: `docs/plans/changelog.md`

- [ ] **Step 1: Build the packages used by the real CLI/Server**

Run the relevant shared, analyzer, server, UI, and CLI builds without relying on stale dist output.

- [ ] **Step 2: Run real demo CLI and API checks**

Verify `analyze` still reports 6 critical authentication findings, `check` still reports 7 warning dead routes, and `GET /api/graph/issues` returns 13 total issues with the expected source/severity split.

- [ ] **Step 3: Run the complete repository gates**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 4: Browser verification**

Open the rebuilt official demo, verify all four workbench views, inspect Quality in English and Chinese, trigger Refresh, and check desktop and narrow layouts. Confirm the browser console has zero warnings and errors.

- [ ] **Step 5: Record evidence**

Append a changelog row with measured issue counts, test totals, build gates, and browser-console result. Do not overwrite unrelated worktree changes.

### Task 8: Structured localized detector descriptions

**Files:**
- Modify: `packages/shared/src/types/issue.ts`
- Modify: `packages/shared/__tests__/types/issue.test.ts`
- Modify: `packages/analyzer/src/graph/consistency.ts`
- Modify: `packages/analyzer/src/resolver/authDetector.ts`
- Modify: `packages/analyzer/src/resolver/nPlusOneDetector.ts`
- Modify: `packages/analyzer/src/resolver/rscBoundaryDetector.ts`
- Modify: `packages/analyzer/__tests__/graph/consistency.test.ts`
- Modify: `packages/analyzer/__tests__/resolver/authDetector.test.ts`
- Modify: `packages/ui/src/services/graph.ts`
- Modify: `packages/ui/src/lib/qualityFindings.ts`
- Modify: `packages/ui/src/components/Workbench/QualityCanvas.tsx`
- Modify: `packages/ui/src/locales/en-US.json`
- Modify: `packages/ui/src/locales/zh-CN.json`
- Modify: `packages/ui/__tests__/services/graph.service.test.ts`
- Modify: `packages/ui/__tests__/components/qualityCanvas.test.tsx`

- [x] Add failing shared/analyzer tests that require every emitted deterministic issue to include a supported `messageKey` and complete primitive `messageParams`.
- [x] Add a failing UI service test that rejects malformed structured message data and preserves valid keys/parameters.
- [x] Add a failing Chinese component test: `unguarded_route` must render `API 路由“GET /api/demo”缺少身份验证保护` while a parser finding keeps its original diagnostic.
- [x] Run focused tests and verify the new assertions fail because descriptions are currently unstructured and rendered verbatim.
- [x] Define the closed `IssueMessageKey` union and `IssueMessageParams = Record<string, string | number>` in Shared. Keep both fields optional for backward compatibility.
- [x] Populate structured messages in all consistency, auth, N+1, and RSC issue constructors while retaining the existing English `description` fallback.
- [x] Preserve and validate the optional fields at the UI network boundary, copy them into `QualityFinding`, and render `t('workbench.issueMessage.<key>', params)` with `finding.message` as `defaultValue`.
- [x] Add complete English and Simplified Chinese templates for every key, then run focused shared/analyzer/UI tests, typecheck, lint, and build.
- [x] Rebuild the demo and verify Chinese Quality contains no English deterministic descriptions, English remains unchanged, parser diagnostics remain literal, source links still resolve, and console warnings/errors remain zero.
