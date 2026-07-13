# Core Reliability Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make pnpm/Turborepo projects use one trustworthy analysis path and prevent empty analysis results from being reported as successful, fresh, or clean.

**Architecture:** CLI project detection discovers workspace packages and records normalized package/source metadata. Analyzer owns deterministic file collection and the full snapshot pipeline; CLI analyze/check, serve, and server refresh all call that pipeline. Typed analysis errors separate zero supported inputs from supported inputs that produce no graph.

**Tech Stack:** TypeScript, Node.js filesystem APIs, fast-glob, ts-morph parsers, sql.js, Vitest, pnpm/Turborepo.

---

## File Structure

- Create `packages/cli/src/utils/workspacePackages.ts`: discover package manifests from pnpm and npm workspace patterns.
- Create `packages/cli/__tests__/utils/workspacePackages.test.ts`: workspace discovery boundary and malformed-manifest tests.
- Modify `packages/cli/src/utils/autoDetect.ts`: merge workspace dependencies and populate `ProjectMeta.packages` and source directories.
- Modify `packages/cli/__tests__/utils/autoDetect.test.ts`: prove packages-only repositories are detected.
- Create `packages/analyzer/src/graph/collectAnalysisFiles.ts`: canonical, deterministic analysis input collection.
- Create `packages/analyzer/src/graph/analysisError.ts`: typed top-level empty-analysis failures.
- Create `packages/analyzer/__tests__/graph/collectAnalysisFiles.test.ts`: overlap, symlink, explicit sibling, and workspace package coverage.
- Modify `packages/analyzer/src/graph/runAnalysis.ts`: use the collector, enforce valid outcomes, and protect owned DB lifecycle.
- Modify `packages/analyzer/src/index.ts`: export the collector and error type.
- Modify `packages/analyzer/__tests__/graph/runAnalysis.test.ts`: zero-file, zero-node, partial-success, and DB cleanup regressions.
- Modify `packages/cli/src/commands/analyze.ts`: delegate the full graph build to `runAnalysis`.
- Modify `packages/cli/src/commands/check.ts`: delegate graph build and reject invalid analysis.
- Modify `packages/cli/src/commands/serve.ts`: treat empty analysis as startup failure rather than success.
- Delete `packages/cli/src/utils/collectProjectFiles.ts`: remove the duplicate CLI scanner after callers migrate.
- Delete `packages/cli/__tests__/utils/collectProjectFiles.test.ts`: replace with Analyzer collector coverage.
- Modify CLI command tests: prove empty results never print success/clean output.
- Modify `packages/server/src/incremental.ts`: begin stale and become fresh only after a graph-producing analysis.
- Modify `packages/server/__tests__/incremental/incremental.test.ts`: exercise initial and failed-empty freshness transitions.
- Modify `AGENTS.md`: replace the non-matching development command with an executable command.
- Modify `docs/plans/changelog.md`: record the implemented reliability repair and verification evidence.

### Task 1: Discover Workspace Packages

**Files:**
- Create: `packages/cli/src/utils/workspacePackages.ts`
- Create: `packages/cli/__tests__/utils/workspacePackages.test.ts`
- Modify: `packages/cli/src/utils/autoDetect.ts`
- Modify: `packages/cli/__tests__/utils/autoDetect.test.ts`

- [x] **Step 1: Write failing workspace discovery tests**

Add fixtures for `pnpm-workspace.yaml` with `packages/*` and `demo`, and for `package.json#workspaces`. Assert returned package paths are root-relative, sorted, within the root, and include manifest dependency names. Add a malformed child `package.json` and assert other packages are still returned.

```ts
const packages = discoverWorkspacePackages(root)
expect(packages.map(pkg => pkg.path)).toEqual(['demo', 'packages/api', 'packages/ui'])
expect(packages.find(pkg => pkg.path === 'packages/ui')?.dependencies).toContain('react')
```

- [x] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm --filter @bynlk/CodeOmniVis test -- workspacePackages.test.ts autoDetect.test.ts
```

Expected: FAIL because `discoverWorkspacePackages` does not exist and `ProjectMeta.packages` is empty.

- [x] **Step 3: Implement minimal workspace discovery**

Use `fast-glob` with patterns parsed from the top-level `packages:` list in `pnpm-workspace.yaml` and string/array forms of `package.json#workspaces`. Reject matches whose resolved real path escapes the root. Read each package manifest independently inside `try/catch` and return `PackageInfo[]`.

```ts
export function discoverWorkspacePackages(root: string): PackageInfo[] {
  const patterns = readWorkspacePatterns(root)
  const manifestPaths = fg.sync(patterns.map(pattern => `${pattern}/package.json`), {
    cwd: root,
    onlyFiles: true,
    unique: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.*/**'],
  })
  return manifestPaths.flatMap(manifest => readWorkspacePackage(root, manifest)).sort(comparePath)
}
```

- [x] **Step 4: Populate detection metadata**

In `autoDetectProject`, merge every discovered package's dependencies into framework/database detection and populate `packages`. Add existing `src`, `app`, `pages`, `server`, and `prisma` package subdirectories to the appropriate metadata without hard-coding package names.

- [x] **Step 5: Run focused tests and verify GREEN**

Run the Task 1 command again. Expected: all selected tests PASS.

- [x] **Step 6: Inspect the diff checkpoint**

Run `git diff -- packages/cli/src/utils/workspacePackages.ts packages/cli/src/utils/autoDetect.ts packages/cli/__tests__/utils` and confirm no unrelated user changes were removed. Do not commit.

### Task 2: Canonical Analyzer File Collection

**Files:**
- Create: `packages/analyzer/src/graph/collectAnalysisFiles.ts`
- Create: `packages/analyzer/__tests__/graph/collectAnalysisFiles.test.ts`
- Modify: `packages/analyzer/src/graph/runAnalysis.ts`
- Modify: `packages/analyzer/src/index.ts`
- Delete after migration: `packages/cli/src/utils/collectProjectFiles.ts`
- Delete after migration: `packages/cli/__tests__/utils/collectProjectFiles.test.ts`

- [x] **Step 1: Write failing collector tests**

Cover conventional directories, `ProjectMeta.packages`, explicit files, overlapping source directories, a symlink to the same real file, an implicit out-of-root path, and an explicit absolute sibling supplied in metadata.

```ts
const files = collectAnalysisFiles(root, meta)
expect(files).toContain('packages/ui/src/App.tsx')
expect(files.filter(file => file.endsWith('App.tsx'))).toHaveLength(1)
expect(files).toEqual([...files].sort())
```

- [x] **Step 2: Run the collector test and verify RED**

Run:

```bash
pnpm --filter @codeomnivis/analyzer test -- collectAnalysisFiles.test.ts
```

Expected: FAIL because the exported collector does not exist.

- [x] **Step 3: Implement the focused collector**

Move collection out of `runAnalysis.ts`. Accept `projectRoot` and `ProjectMeta`, recursively scan only supported extensions, ignore generated/dependency directories, add explicit parser inputs, normalize paths, deduplicate with `fs.realpathSync.native`, and sort.

```ts
export function collectAnalysisFiles(projectRoot: string, projectMeta: ProjectMeta): string[] {
  const filesByRealPath = new Map<string, string>()
  for (const directory of collectCandidateDirectories(projectRoot, projectMeta)) {
    scanDirectory(directory, file => addFile(filesByRealPath, projectRoot, file))
  }
  for (const file of collectExplicitFiles(projectMeta)) {
    addFile(filesByRealPath, projectRoot, file)
  }
  return [...filesByRealPath.values()].sort()
}
```

- [x] **Step 4: Wire `runAnalysis` and export the collector**

Replace its local `scanDir`, `resolveProjectPath`, and `collectAnalysisFiles` functions with the new module and export the function from Analyzer's public index.

- [x] **Step 5: Run focused Analyzer tests and verify GREEN**

Run:

```bash
pnpm --filter @codeomnivis/analyzer test -- collectAnalysisFiles.test.ts runAnalysis.test.ts
```

Expected: all selected tests PASS.

- [x] **Step 6: Remove the duplicate CLI collector only after all imports migrate**

Use `rg "collectProjectFiles" packages` to verify no production import remains, then delete the CLI collector and its superseded tests with `apply_patch`.

### Task 3: Enforce Truthful Analysis Outcomes

**Files:**
- Create: `packages/analyzer/src/graph/analysisError.ts`
- Modify: `packages/analyzer/src/graph/runAnalysis.ts`
- Modify: `packages/analyzer/src/index.ts`
- Modify: `packages/analyzer/__tests__/graph/runAnalysis.test.ts`

- [x] **Step 1: Write failing outcome tests**

Assert zero supported files throws `AnalysisError` with `NO_SUPPORTED_FILES`; supported files that parsers do not recognize throw `NO_GRAPH_NODES`; parser warnings plus at least one node return normally. Assert an Analyzer-owned DB is closed when parsing/linking throws.

```ts
await expect(runAnalysis({ projectRoot: emptyRoot, dbPath }))
  .rejects.toMatchObject({ code: 'NO_SUPPORTED_FILES' })
await expect(runAnalysis({ projectRoot: noNodesRoot, dbPath }))
  .rejects.toMatchObject({ code: 'NO_GRAPH_NODES' })
```

- [x] **Step 2: Run outcome tests and verify RED**

Run:

```bash
pnpm --filter @codeomnivis/analyzer test -- runAnalysis.test.ts
```

Expected: the new rejection assertions FAIL because empty results currently resolve successfully.

- [x] **Step 3: Add typed errors and minimal validation**

```ts
export type AnalysisErrorCode = 'NO_SUPPORTED_FILES' | 'NO_GRAPH_NODES'

export class AnalysisError extends Error {
  constructor(readonly code: AnalysisErrorCode, message: string) {
    super(message)
    this.name = 'AnalysisError'
  }
}
```

Collect files before clearing the graph. Throw `NO_SUPPORTED_FILES` before parsing. After parsing and linking, load the persisted graph and throw `NO_GRAPH_NODES` when it has no nodes. Parser errors remain result statistics rather than top-level failures when a graph exists.

- [x] **Step 4: Protect DB ownership with `try/finally`**

Wrap the owned-database analysis body so `db.close()` executes on every success or error path; never close an injected database.

- [x] **Step 5: Run focused tests and verify GREEN**

Run the Task 3 command again. Expected: all selected tests PASS.

### Task 4: Migrate CLI Commands to the Canonical Pipeline

**Files:**
- Modify: `packages/cli/src/commands/analyze.ts`
- Modify: `packages/cli/src/commands/check.ts`
- Modify: `packages/cli/src/commands/serve.ts`
- Create: `packages/cli/__tests__/commands/emptyAnalysis.test.ts`
- Modify: `packages/cli/__tests__/commands/analyzeCacheDedup.test.ts`
- Modify: `packages/cli/__tests__/commands/checkScanDirs.test.ts`

- [x] **Step 1: Write failing CLI behavior tests**

For analyze/check, use a temporary empty project and the existing database dependency injection. Assert rejection occurs before a success/clean message. For check, spy on `console.log` and assert `No consistency issues found` is absent. `serve` is covered by the real CLI invalid-project check in Task 6 because its Commander action is intentionally process-owning.

- [x] **Step 2: Run CLI tests and verify RED**

Run:

```bash
pnpm --filter @bynlk/CodeOmniVis test -- emptyAnalysis.test.ts analyzeCacheDedup.test.ts checkScanDirs.test.ts
```

Expected: at least the empty-project assertions FAIL under current success semantics.

- [x] **Step 3: Delegate analyze and check graph construction**

Replace their local `GraphBuilder` scanning pipelines with `runAnalysis({ projectRoot, dbPath, projectMeta, db })`, then load the final graph from the injected DB for JSON, detectors, and consistency output. Preserve existing `finally { db.close() }` ownership.

- [x] **Step 4: Make serve reject empty startup analysis**

Allow `AnalysisError` to reach the existing startup failure handler. Do not print `Server running`, open the browser, or block the process after an invalid analysis outcome.

- [x] **Step 5: Run focused CLI tests and verify GREEN**

Run the Task 4 command again. Expected: selected tests PASS and no empty success/clean output remains.

### Task 5: Make Freshness Reflect a Valid Graph

**Files:**
- Modify: `packages/server/src/incremental.ts`
- Modify: `packages/server/__tests__/incremental/incremental.test.ts`

- [x] **Step 1: Write failing freshness tests**

Change the initial expectation to `stale` with `lastAnalyzedAt: null`. Mock a valid analysis with `nodesCreated: 1` and expect `fresh`. Mock `AnalysisError` and expect manual refresh to reject, remain `stale`, and leave `lastAnalyzedAt` null.

- [x] **Step 2: Run server tests and verify RED**

Run:

```bash
pnpm --filter @codeomnivis/server test -- incremental.test.ts
```

Expected: initial-state test FAILS because the analyzer currently starts `fresh`.

- [x] **Step 3: Implement minimal state correction**

Initialize `state` to `stale`. Keep the existing success transition but rely on `runAnalysis` rejecting invalid outcomes before `lastAnalyzedAt` is updated.

- [x] **Step 4: Run focused server tests and verify GREEN**

Run the Task 5 command again. Expected: selected tests PASS.

### Task 6: Documentation and End-to-End Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/plans/changelog.md`

- [x] **Step 1: Correct the development command**

Replace the non-matching `@codeomnivis/cli` filter with the real package name and a command that actually executes the built CLI:

```bash
pnpm --filter @bynlk/CodeOmniVis build
node packages/cli/bin/codeomnivis.js serve --project .
```

- [x] **Step 2: Run package and repository verification**

Run, in order:

```bash
pnpm --filter @codeomnivis/analyzer test
pnpm --filter @bynlk/CodeOmniVis test
pnpm --filter @codeomnivis/server test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: every command exits 0 with no test failures.

- [x] **Step 3: Verify the real repository analysis**

Run the corrected CLI against `/Users/new/CodeOmniVis`, query `/api/project`, `/api/status`, and `/api/graph`, and assert the graph has more than zero nodes and edges. Stop only the verification server started by this task.

- [x] **Step 4: Verify invalid-project semantics**

Run analyze/check against a temporary empty directory and assert non-zero failure plus absence of `Analysis complete` and `No consistency issues found`.

- [x] **Step 5: Browser verification**

Open the existing workbench at `http://127.0.0.1:4179/`, confirm API data renders, inspect console and terminal logs, and record any remaining frontend-only issues for the third repair batch.

- [x] **Step 6: Record the result**

Append exact commands, pass counts, and remaining out-of-scope findings to `docs/plans/changelog.md`. Review `git diff --check` and `git status --short`. Do not commit.
