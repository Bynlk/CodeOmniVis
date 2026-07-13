# Project Switch Trust Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local absolute project switching work atomically while retaining strict token and path boundaries for remotely reachable Servers.

**Architecture:** Keep the pure binding-aware root policy, inject complete project metadata detection from CLI into Server, and treat root switching as a transaction. The route publishes a new root only after the analyzer succeeds; the analyzer restores the old metadata, graph, parse errors, freshness, and watcher when target analysis fails.

**Tech Stack:** TypeScript, Express, Node path/fs, Vitest, Supertest.

---

### Task 1: Project-root policy resolver

**Files:**
- Create: `packages/server/src/projectRootPolicy.ts`
- Create: `packages/server/__tests__/projectRootPolicy.test.ts`

- [x] Write failing tests for loopback-style arbitrary absolute roots, remotely bounded absolute roots, and relative escape attempts.
- [x] Run `pnpm --filter @codeomnivis/server test -- projectRootPolicy.test.ts`; expect a missing-module failure.
- [x] Implement `resolveProjectRootRequest(startupRoot, requestedRoot, allowArbitraryAbsolute)` by delegating bounded cases to `resolveWithinBoundary`.
- [x] Re-run the focused test and Server typecheck; expect pass.

### Task 2: Binding-aware project route

**Files:**
- Modify: `packages/server/src/index.ts`
- Modify: `packages/server/__tests__/routes/project.test.ts`
- Modify: `packages/server/__tests__/routes/pathTraversal.test.ts`

- [x] Add a failing loopback route test that switches to an existing sibling absolute directory.
- [x] Update the security suite setup to use `host: '0.0.0.0'`, an access token, and authenticated requests; verify its outside-boundary assertions still fail before the route policy changes.
- [x] Wire the route to the pure resolver with `allowArbitraryAbsolute = isLoopbackHost(host)`.
- [x] Run project-route, traversal, auth-guard, Server typecheck, and Server lint checks.

### Task 3: Target metadata detection

**Files:**
- Modify: `packages/server/src/index.ts`
- Modify: `packages/server/src/incremental.ts`
- Modify: `packages/server/__tests__/routes/project.test.ts`
- Modify: `packages/server/__tests__/incremental/setProjectRoot.test.ts`
- Modify: `packages/cli/src/commands/serve.ts`

- [x] Add a route test whose injected loader records `targetRoot`, returns `targetMeta`, and assert `runAnalysis` receives both values.
- [x] Run `pnpm --filter @codeomnivis/server test -- project.test.ts`; expect failure because `ServerOptions` has no loader and analysis still receives startup metadata.
- [x] Add `detectProjectMeta?: (root: string) => Promise<ProjectMeta>` to `ServerOptions`; call it after target validation and before `setProjectRoot`.
- [x] Change the analyzer API to `setProjectRoot(newRoot, projectMeta?)`, update `this.projectMeta` before target analysis, and clear it instead of reusing startup metadata when no target metadata is supplied.
- [x] Inject the complete CLI detector:

```ts
detectProjectMeta: async root => autoDetectProject(root, loadConfig(root)),
```

- [x] Add a detection-failure route test and assert the loader error returns `500`, `GET /api/project` stays on the old root, analysis is not called, and existing graph data remains.
- [x] Run the focused route and analyzer tests; expect pass.

### Task 4: Transactional analyzer rollback

**Files:**
- Modify: `packages/server/src/incremental.ts`
- Modify: `packages/server/__tests__/incremental/setProjectRoot.test.ts`

- [x] Seed the real in-memory database with one node, one valid edge, and one parse error. Mock target `runAnalysis` to clear the DB and reject. Assert `setProjectRoot` rejects and restores the old root, graph, errors, and freshness.
- [x] Run `pnpm --filter @codeomnivis/server test -- setProjectRoot.test.ts`; expect the new regression to fail because the current implementation leaves the target root and an empty graph.
- [x] Snapshot the old graph/errors and state only after serializing with any in-flight analysis. On target failure, stop the target watcher, restore the database snapshot, restore root/metadata/state fields, restart the old watcher, emit restored status, and rethrow the original error.
- [x] Add a second regression proving a failed same-root refresh with replacement metadata restores the previous metadata and graph.
- [x] Re-run `setProjectRoot.test.ts incremental.test.ts`; expect pass with no leaked watcher handles.

### Task 5: Route consistency on failed analysis

**Files:**
- Modify: `packages/server/__tests__/routes/project.test.ts`
- Modify: `packages/server/src/index.ts` only if the test exposes a route-level defect

- [x] Add a route regression where target analysis clears the graph and rejects. Assert the response is `500`, `GET /api/project` reports the old root, and `GET /api/graph` returns the old graph.
- [x] Run the route regression and verify RED before production changes, then GREEN after Task 4.
- [x] Ensure the response uses the standard `{ error: { code, message } }` envelope and does not expose a stack trace.

### Task 6: Real workflow and completion audit

**Files:**
- Modify: `docs/plans/changelog.md`

- [x] Build fresh CLI/Server/UI artifacts.
- [x] Start on the demo root in loopback mode and switch to `/Users/new/CodeOmniVis`; verify target metadata discovers workspace packages and `/api/project`, graph, status, issues, and source links all use the repository root.
- [x] Switch back to `/Users/new/CodeOmniVis/demo`; verify the graph returns to the known demo topology and Quality findings remain usable.
- [x] Exercise an invalid target analysis and prove the previously active project remains visible.
- [x] Return the deliverable browser tab to the demo project for the user.
- [x] Run `pnpm exec turbo test --force`, `pnpm exec turbo typecheck --force`, `pnpm exec turbo lint --force`, `pnpm exec turbo build --force`, and `git diff --check`.
- [x] Record exact pass counts and runtime evidence without overwriting unrelated worktree changes. Do not commit.
