# CodeOmniVis Core Quality 90 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify CodeOmniVis behind one analysis snapshot, close security/release gaps, and establish a reproducible quality gate that supports a ≥90/100 reassessment.

**Architecture:** `@codeomnivis/analyzer` becomes the only owner of project detection and analysis, returning a versioned `ProjectSnapshot` committed transactionally. CLI, REST/WebSocket, and MCP remain API-compatible projections of that snapshot; non-loopback access uses one bearer/session policy.

**Tech Stack:** TypeScript, ts-morph, sql.js, Express, ws, MCP SDK, Vitest/V8 coverage, Playwright, pnpm, Turborepo, GitHub Actions, npm provenance.

---

## File map

New files have one responsibility each:

- `packages/shared/src/types/snapshot.ts` — serializable snapshot/write-report contracts.
- `packages/shared/src/node/stableDigest.ts` — Node-only canonical JSON and SHA-256 helpers.
- `packages/analyzer/src/project/detectProject.ts` — the only framework/ORM/project detector.
- `packages/analyzer/src/project/fingerprint.ts` — project and source fingerprints.
- `packages/analyzer/src/graph/analyzeProject.ts` — the only full analysis orchestrator.
- `packages/analyzer/src/storage/database.ts` — sql.js lifecycle and transactions.
- `packages/analyzer/src/storage/nodeRepository.ts` — node persistence.
- `packages/analyzer/src/storage/edgeRepository.ts` — edge validation/persistence.
- `packages/analyzer/src/storage/errorRepository.ts` — parser errors.
- `packages/analyzer/src/storage/graphRepository.ts` — graph composition.
- `packages/analyzer/src/storage/statsRepository.ts` — statistics.
- `packages/analyzer/src/storage/persistence.ts` — atomic database file persistence.
- `packages/mcp/src/server.ts` — MCP factory, tools and snapshot query lifecycle.
- `packages/mcp/src/stdio.ts` — stdio transport startup/shutdown.
- `packages/server/src/sessionStore.ts` — short-lived in-memory sessions.
- `packages/server/src/accessGuard.ts` — shared REST/WS bearer/session authorization.
- `packages/server/src/aiRequestPolicy.ts` — outbound destination and resource limits.
- `packages/server/src/requestLimiter.ts` — per-session concurrency/rate accounting.
- `packages/contract-tests/` — cross-surface fixtures and digest parity tests.
- `e2e/` and `playwright.config.ts` — real browser workbench tests.
- `scripts/verifyPublicContracts.mjs` — documentation/registered-contract comparison.
- `scripts/verifyRegistryInstall.mjs` — post-publication official-registry smoke test.

Existing compatibility files remain thin facades: `runAnalysis.ts`, `runFullAnalysis.ts`, `storage/db.ts`, existing REST paths and MCP tool names.

## Integration order with the test-intelligence plan

Execute Core Tasks 1–9 first so the secure snapshot pipeline exists. Then execute Cross-Language Tasks 1–9, return to Core Tasks 10–12 for coverage/browser/CI, execute Cross-Language Task 10 for mixed-stack parity and documentation, and finish with Core Tasks 13–14 for final documentation, publication and reassessment. At every handoff, run the packages changed so far; the final `quality:gate` covers both plans together.

### Task 1: Freeze public contracts and make CLI registration testable

**Files:**
- Modify: `packages/cli/src/index.ts`
- Create: `packages/cli/src/program.ts`
- Create: `packages/cli/__tests__/contracts/publicCommands.test.ts`
- Create: `packages/server/__tests__/contracts/publicRoutes.test.ts`
- Create: `packages/mcp/__tests__/contracts/publicTools.test.ts`
- Create: `docs/reports/2026-07-14-quality-baseline.md`

- [ ] **Step 0: Record the immutable baseline evidence**

Create the baseline report with commit `fd86f489bf917d853bda95c7c06515b6167aaa3d`, original weighted score 68.75, the 649-test/18-task/package verification results, MCP early exit, `master`/CI mismatch, coverage-provider failure, production audit counts, npm 404 and the bounded-security-review limitation. Every result includes its exact command and capture date.

- [ ] **Step 1: Write failing CLI, REST and MCP contract tests**

```typescript
// packages/cli/__tests__/contracts/publicCommands.test.ts
import { describe, expect, it } from 'vitest'
import { createCliProgram } from '../../src/program'

describe('public CLI contract', () => {
  it('keeps all documented command names', () => {
    const names = createCliProgram().commands.map(command => command.name()).sort()
    expect(names).toEqual(expect.arrayContaining(['analyze', 'check', 'init', 'mcp', 'serve']))
  })
})
```

```typescript
// packages/mcp/__tests__/contracts/publicTools.test.ts
import { describe, expect, it } from 'vitest'
import { PUBLIC_TOOL_NAMES } from '../../src/server'

it('keeps existing MCP tool names', () => {
  expect([...PUBLIC_TOOL_NAMES]).toEqual(expect.arrayContaining([
    'find_callers', 'get_api_routes', 'get_component_tree', 'get_dataflow', 'list_db_models',
  ]))
})
```

The server test must create `createOmniServer()` and assert these routes respond with anything except 404: `/api/health`, `/api/status`, `/api/project`, `/api/graph`, `/api/graph/nodes`, `/api/graph/edges`, `/api/graph/stats`, `/api/graph/errors`, `/api/graph/issues`, `/api/graph/trace`, `/api/graph/dataflow`, `/api/analyze`, `/api/project`, `/api/ai/chat`, `/api/ai/explain`.

- [ ] **Step 2: Run tests and verify the new imports fail**

Run: `pnpm --filter @bynlk/codeomnivis test -- publicCommands.test.ts && pnpm --filter @codeomnivis/mcp test -- publicTools.test.ts`

Expected: FAIL because `createCliProgram`, `PUBLIC_TOOL_NAMES`, and the contract test directories do not exist.

- [ ] **Step 3: Extract a side-effect-free CLI program factory**

```typescript
// packages/cli/src/program.ts
import { Command } from 'commander'
import { readFileSync } from 'node:fs'
import { isJsonObject } from '@codeomnivis/shared'
import { analyzeCommand } from './commands/analyze'
import { checkCommand } from './commands/check'
import { initCommand } from './commands/init'
import { mcpCommand } from './commands/mcp'
import { serveCommand } from './commands/serve'

export function createCliProgram(): Command {
  const manifest: unknown = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  )
  const version = isJsonObject(manifest) && typeof manifest.version === 'string'
    ? manifest.version
    : '0.0.0'
  const program = new Command()
    .name('codeomnivis')
    .description('Full-stack architecture visualizer for TypeScript projects')
    .version(version)
  serveCommand(program)
  analyzeCommand(program)
  checkCommand(program)
  mcpCommand(program)
  initCommand(program)
  return program
}
```

Replace `packages/cli/src/index.ts` body with `createCliProgram().parseAsync().catch(...)`, writing fatal messages to stderr and setting `process.exitCode = 1`. Extend the contract test to assert `createCliProgram().version()` equals `packages/cli/package.json.version`, so release bumps cannot drift from `--version`.

- [ ] **Step 4: Run contract tests**

Run: `pnpm --filter @bynlk/codeomnivis test -- publicCommands.test.ts && pnpm --filter @codeomnivis/server test -- publicRoutes.test.ts && pnpm --filter @codeomnivis/mcp test -- publicTools.test.ts`

Expected: PASS with every existing public name still present; later additive commands/tools are allowed.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/index.ts packages/cli/src/program.ts packages/cli/__tests__/contracts packages/server/__tests__/contracts packages/mcp/__tests__/contracts docs/reports/2026-07-14-quality-baseline.md
git commit -m "test(cli): freeze public surface contracts"
```

### Task 2: Repair the MCP process lifecycle and protocol

**Files:**
- Create: `packages/mcp/src/server.ts`
- Create: `packages/mcp/src/stdio.ts`
- Modify: `packages/mcp/src/index.ts`
- Modify: `packages/cli/src/commands/mcp.ts`
- Modify: `.github/workflows/ci.yml`
- Create: `packages/mcp/__tests__/stdio.e2e.test.ts`
- Create: `packages/cli/__tests__/commands/mcpLifecycle.test.ts`

- [ ] **Step 1: Write a real stdio handshake test**

Spawn the built CLI with `['mcp', '--project', fixtureRoot]`, send newline-delimited JSON-RPC `initialize`, `notifications/initialized`, and `tools/list`, then assert the response contains all five tool names and that the child remains alive until SIGTERM.

```typescript
expect(toolNames).toEqual(expect.arrayContaining([...PUBLIC_TOOL_NAMES]))
expect(child.exitCode).toBeNull()
child.kill('SIGTERM')
expect(await exited).toBe(0)
```

- [ ] **Step 2: Prove the current command exits early**

Run: `pnpm build && pnpm --filter @codeomnivis/mcp test -- stdio.e2e.test.ts`

Expected: FAIL because importing `@codeomnivis/mcp` from the CLI does not call the direct-entry-only `main()`.

- [ ] **Step 3: Export an explicit startup API**

```typescript
// packages/mcp/src/stdio.ts
export interface McpStdioOptions { projectRoot: string }

export async function startMcpServer(options: McpStdioOptions): Promise<() => Promise<void>> {
  const runtime = createMcpServer({ projectRoot: options.projectRoot })
  const transport = new StdioServerTransport()
  await runtime.server.connect(transport)
  return async () => runtime.close()
}
```

`createMcpServer()` owns its database cache per instance, registers the unchanged tools from `PUBLIC_TOOL_NAMES`, and exposes `close()`. `packages/mcp/src/index.ts` only exports the factory/start API and keeps direct module execution by calling `startMcpServer()`.

- [ ] **Step 4: Make the CLI invoke and await the startup API**

```typescript
const { startMcpServer } = await import('@codeomnivis/mcp')
const close = await startMcpServer({ projectRoot })
process.once('SIGINT', () => void close().finally(() => process.exit(0)))
process.once('SIGTERM', () => void close().finally(() => process.exit(0)))
```

Do not use `ora` or stdout informational logs after stdio starts; all diagnostics go to stderr.

- [ ] **Step 5: Point baseline CI at the real default branch**

Change both `push.branches` and `pull_request.branches` from `[main]` to `[master]`. Keep the existing commands in this early fix; the final job split and stronger gate arrive after coverage/browser infrastructure exists.

- [ ] **Step 6: Verify protocol and lifecycle**

Run: `pnpm --filter @codeomnivis/mcp test -- stdio.e2e.test.ts && pnpm --filter @bynlk/codeomnivis test -- mcpLifecycle.test.ts`

Expected: PASS; no non-JSON stdout, process remains alive, SIGTERM closes DB and exits 0.

- [ ] **Step 7: Commit**

```bash
git add packages/mcp/src packages/mcp/__tests__/stdio.e2e.test.ts packages/cli/src/commands/mcp.ts packages/cli/__tests__/commands/mcpLifecycle.test.ts .github/workflows/ci.yml
git commit -m "fix(mcp): start stdio server from CLI"
```

### Task 3: Add one non-loopback bearer/session authorization model

**Files:**
- Create: `packages/server/src/sessionStore.ts`
- Create: `packages/server/src/accessGuard.ts`
- Modify: `packages/server/src/authGuard.ts`
- Modify: `packages/server/src/index.ts`
- Modify: `packages/server/src/routes/graph.ts`
- Modify: `packages/server/src/ai.ts`
- Create: `packages/server/__tests__/auth/session.test.ts`
- Create: `packages/server/__tests__/auth/remoteRead.test.ts`
- Create: `packages/server/__tests__/ws/session.test.ts`

- [ ] **Step 1: Write remote-access tests**

Cover four cases: loopback anonymous GET remains 200; non-loopback anonymous GET/POST/AI are 401; bearer GET succeeds; `POST /api/session` with the access token sets an HttpOnly/SameSite=Strict cookie that authorizes REST and WebSocket until expiry.

```typescript
expect(response.headers['set-cookie']?.join(';')).toContain('HttpOnly')
expect(response.headers['set-cookie']?.join(';')).toContain('SameSite=Strict')
expect(response.body).not.toContain(accessToken)
```

- [ ] **Step 2: Run security tests and confirm anonymous reads currently pass**

Run: `pnpm --filter @codeomnivis/server test -- session.test.ts remoteRead.test.ts ws/session.test.ts`

Expected: FAIL because only mutating endpoints use `createMutatingGuard()` and no session endpoint exists.

- [ ] **Step 3: Implement a bounded session store**

```typescript
export interface SessionStoreOptions { ttlMs: number; maxSessions: number }

export class SessionStore {
  create(now = Date.now()): { id: string; expiresAt: number }
  validate(id: string, now = Date.now()): boolean
  revoke(id: string): void
  clear(): void
}
```

Use `randomBytes(32).toString('base64url')`, absolute 15-minute expiry, oldest-session eviction at the configured cap, and `unref()` on periodic cleanup.

- [ ] **Step 4: Replace the mutating-only guard with a shared guard**

```typescript
export interface AccessPolicy {
  loopback: boolean
  accessToken?: string
  sessions: SessionStore
}

export function authenticateRequest(
  request: Pick<Request, 'headers'>,
  policy: AccessPolicy,
): { ok: true } | { ok: false; status: 401 | 403; code: string }
```

Bearer remains preferred; cookie parsing accepts only `codeomnivis_session`. Apply the guard to `/api/graph`, `/api/status`, `/api/project`, `/api/analyze`, project switching and AI routes when non-loopback. Keep `/api/health` anonymous and non-sensitive.

- [ ] **Step 5: Add `/api/session` and WebSocket authorization**

The session route accepts `{ "accessToken": "..." }`, performs timing-safe comparison, returns `{ data: { expiresAt }, meta: {} }`, and sets `HttpOnly; SameSite=Strict; Path=/; Max-Age=900`; set `Secure` when the configured public origin is HTTPS. WebSocket `verifyClient` must pass both Origin and `authenticateRequest(info.req, policy)`.

- [ ] **Step 6: Run the security suite**

Run: `pnpm --filter @codeomnivis/server test -- auth ws routes`

Expected: PASS; loopback compatibility remains, all non-loopback project data is protected.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/sessionStore.ts packages/server/src/accessGuard.ts packages/server/src/authGuard.ts packages/server/src/index.ts packages/server/src/routes/graph.ts packages/server/src/ai.ts packages/server/__tests__/auth packages/server/__tests__/ws/session.test.ts
git commit -m "fix(server): protect remote data with sessions"
```

### Task 4: Bound AI outbound requests and close DNS rebinding

**Files:**
- Create: `packages/server/src/aiRequestPolicy.ts`
- Create: `packages/server/src/requestLimiter.ts`
- Modify: `packages/server/src/ai.ts`
- Modify: `packages/server/package.json`
- Modify: `packages/cli/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `packages/server/__tests__/ai/requestPolicy.test.ts`
- Modify: `packages/server/__tests__/routes/ai.test.ts`

- [ ] **Step 1: Add failing timeout, redirect, size, concurrency and peer-IP tests**

Inject the outbound client rather than performing public network calls. Assert: 10-second timeout aborts; redirects are rejected; response above 1 MiB is rejected; more than two concurrent requests per identity returns 429; a socket peer address different from the validated address is rejected.

- [ ] **Step 2: Run the AI tests**

Run: `pnpm --filter @codeomnivis/server test -- requestPolicy.test.ts routes/ai.test.ts`

Expected: FAIL because `callAiChat()` currently uses unconstrained global `fetch()` after a separate DNS lookup.

- [ ] **Step 3: Implement explicit outbound policy**

Run: `pnpm --filter @codeomnivis/server add undici@^6.27.0 && pnpm --filter @bynlk/codeomnivis add undici@^6.27.0`

Raise the CLI engine floor from Node `>=18.0.0` to `>=18.17.0`, matching undici 6 and the already-used modern toolchain; CI still validates Node 20.

```typescript
export interface AiRequestLimits {
  timeoutMs: number
  maxRequestBytes: number
  maxResponseBytes: number
  maxConcurrentPerIdentity: number
  requestsPerMinute: number
}

export const DEFAULT_AI_LIMITS: AiRequestLimits = {
  timeoutMs: 10_000,
  maxRequestBytes: 256 * 1024,
  maxResponseBytes: 1024 * 1024,
  maxConcurrentPerIdentity: 2,
  requestsPerMinute: 20,
}
```

Resolve once, select one public address, connect through an injectable `undici` dispatcher pinned to that address while preserving TLS SNI/Host, set `maxRedirections: 0`, and verify the connected peer. Loopback provider URLs remain allowed only for loopback-bound CodeOmniVis or an explicit local-provider flag.

- [ ] **Step 4: Make handler errors controlled**

Map invalid destination to 400, authentication/rate failures to 401/429, timeout to 504, and upstream failure to 502. Return `{ error: { code, message } }`; never return upstream body, API key, DNS details or absolute paths.

- [ ] **Step 5: Run AI and full server tests**

Run: `pnpm --filter @codeomnivis/server test`

Expected: PASS with no live external network dependency.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/aiRequestPolicy.ts packages/server/src/requestLimiter.ts packages/server/src/ai.ts packages/server/package.json packages/cli/package.json packages/server/__tests__/ai packages/server/__tests__/routes/ai.test.ts pnpm-lock.yaml
git commit -m "fix(server): bound AI outbound requests"
```

### Task 5: Remediate reachable production dependency advisories

**Files:**
- Modify: `demo/package.json`
- Modify: `packages/mcp/package.json`
- Modify: `packages/cli/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `scripts/auditProduction.mjs`
- Modify: `package.json`

- [ ] **Step 1: Capture machine-readable production audit evidence**

Run: `pnpm audit --prod --json > /tmp/codeomnivis-audit-before.json`

Expected: non-zero with the known reachable high advisories in Demo Next.js and the MCP SDK/Hono path; the report contains no credentials.

- [ ] **Step 2: Upgrade direct owners through pnpm**

Run: `pnpm --filter demo up next@^15.5.20 && pnpm --filter @codeomnivis/mcp up @modelcontextprotocol/sdk@^1.29.0 && pnpm --filter @bynlk/codeomnivis up @modelcontextprotocol/sdk@^1.29.0`

Expected: package manifests and lockfile are generated by pnpm. Review release notes for Node engine and MCP protocol compatibility before accepting the resolved versions.

- [ ] **Step 3: Run targeted compatibility tests**

Run: `pnpm build && pnpm --filter @codeomnivis/mcp test && pnpm --filter @bynlk/codeomnivis test && pnpm --filter demo build`

Expected: PASS; MCP stdio handshake still works and the demo builds.

- [ ] **Step 4: Implement a strict production-audit wrapper**

`scripts/auditProduction.mjs` executes `pnpm audit --prod --json`, fails on every high/critical advisory, and prints package/advisory/path. A temporary exception is valid only when the script contains advisory ID, affected path, written rationale and an ISO expiry date; expired or path-mismatched exceptions fail.

- [ ] **Step 5: Verify no unhandled reachable high advisory**

Run: `node scripts/auditProduction.mjs`

Expected: PASS with zero unhandled high/critical production advisory. Moderate/low items remain visible in output and in the reassessment deductions.

- [ ] **Step 6: Commit**

```bash
git add demo/package.json packages/mcp/package.json packages/cli/package.json pnpm-lock.yaml scripts/auditProduction.mjs package.json
git commit -m "fix(cli): remediate production dependencies"
```

### Task 6: Introduce the ProjectSnapshot contract and stable digest

**Files:**
- Create: `packages/shared/src/types/snapshot.ts`
- Create: `packages/shared/src/node/stableDigest.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/node/index.ts`
- Create: `packages/shared/__tests__/types/snapshot.test.ts`
- Create: `packages/shared/__tests__/node/stableDigest.test.ts`

- [ ] **Step 1: Write failing snapshot/digest tests**

```typescript
it('produces the same digest for reordered object keys', () => {
  expect(stableDigest({ b: 2, a: 1 })).toBe(stableDigest({ a: 1, b: 2 }))
})

it('excludes volatile fields from snapshot parity', () => {
  expect(computeSnapshotDigest(first)).toBe(computeSnapshotDigest({
    ...first,
    snapshotId: 'different',
    provenance: { ...first.provenance, generatedAt: first.provenance.generatedAt + 1 },
  }))
})
```

- [ ] **Step 2: Run tests and verify missing exports**

Run: `pnpm --filter @codeomnivis/shared test -- snapshot.test.ts stableDigest.test.ts`

Expected: FAIL because snapshot and digest modules do not exist.

- [ ] **Step 3: Implement serializable contracts**

Use the approved `ProjectSnapshot`, `AnalyzeProjectResult`, `WriteReport`, `AnalysisStats` and `SerializableParseError` types. `computeSnapshotDigest()` canonicalizes nodes/edges/issues/errors by stable IDs, normalizes separators to `/`, excludes absolute root/generatedAt/snapshotId, and hashes UTF-8 canonical JSON with SHA-256.

- [ ] **Step 4: Run shared tests and typecheck**

Run: `pnpm --filter @codeomnivis/shared test && pnpm --filter @codeomnivis/shared typecheck`

Expected: PASS; digest is deterministic across ordering and volatile timestamps.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/snapshot.ts packages/shared/src/node/stableDigest.ts packages/shared/src/index.ts packages/shared/src/node/index.ts packages/shared/__tests__/types/snapshot.test.ts packages/shared/__tests__/node/stableDigest.test.ts
git commit -m "feat(shared): define project snapshot contract"
```

### Task 7: Make analyzer own project detection and one analysis pipeline

**Files:**
- Create: `packages/analyzer/src/project/detectProject.ts`
- Create: `packages/analyzer/src/project/fingerprint.ts`
- Create: `packages/analyzer/src/project/index.ts`
- Create: `packages/analyzer/src/graph/analyzeProject.ts`
- Modify: `packages/analyzer/src/graph/runAnalysis.ts`
- Modify: `packages/analyzer/src/graph/runFullAnalysis.ts`
- Modify: `packages/analyzer/src/index.ts`
- Modify: `packages/cli/src/utils/autoDetect.ts`
- Modify: `packages/server/src/incremental.ts`
- Create: `packages/analyzer/__tests__/project/detectProject.test.ts`
- Create: `packages/analyzer/__tests__/graph/analyzeProject.test.ts`

- [ ] **Step 1: Add parity and degradation tests**

Test TS/Next+tRPC+Prisma, Kotlin/Spring+Exposed, empty project, malformed package JSON, symlinked scan directory, parser warning, and injected storage failure. Assert parser failure produces `parseErrors` while storage failure rejects without replacing the old snapshot.

- [ ] **Step 2: Run tests and expose the duplicated behavior**

Run: `pnpm --filter @codeomnivis/analyzer test -- detectProject.test.ts analyzeProject.test.ts runAnalysis.test.ts`

Expected: FAIL because `detectProjectMeta()` is private and different in `runAnalysis.ts` and `runFullAnalysis.ts`.

- [ ] **Step 3: Implement the canonical detector**

```typescript
export async function detectProject(projectRoot: string): Promise<ProjectMeta> {
  const root = await realpath(projectRoot)
  return {
    root,
    frontendFramework: detectFrontend(dependencies),
    backendFramework: detectBackend(dependencies, gradle),
    databaseType: detectDatabase(dependencies, gradle, root),
    monorepoType: detectMonorepo(root),
    // all configured paths are resolved and filtered through the root policy
  }
}
```

Malformed optional config becomes a warning when analysis can continue; invalid project root is a configuration error.

- [ ] **Step 4: Implement `analyzeProject()`**

The exact order is: detect/configure → collect files once → compute source digest → parser registry → cross-layer linker → graph sanitize/validator → issues → transactional commit → snapshot. Report progress with stable event names and honor `AbortSignal` between stages.

- [ ] **Step 5: Convert legacy APIs to wrappers**

`runAnalysis()` and `runFullAnalysis()` call `analyzeProject()` and map the snapshot/write report to their existing result shapes. CLI `autoDetect` re-exports/adapts `detectProject`; `IncrementalAnalyzer` invokes the new entry once per refresh.

- [ ] **Step 6: Verify analyzer, CLI and server**

Run: `pnpm --filter @codeomnivis/analyzer test && pnpm --filter @bynlk/codeomnivis test && pnpm --filter @codeomnivis/server test`

Expected: PASS; existing external function names remain, but no duplicate detector/scanner implementation remains (`rg "function detectProjectMeta|function scanDir" packages` returns no duplicate private implementations).

- [ ] **Step 7: Commit**

```bash
git add packages/analyzer/src/project packages/analyzer/src/graph/analyzeProject.ts packages/analyzer/src/graph/runAnalysis.ts packages/analyzer/src/graph/runFullAnalysis.ts packages/analyzer/src/index.ts packages/cli/src/utils/autoDetect.ts packages/server/src/incremental.ts packages/analyzer/__tests__/project packages/analyzer/__tests__/graph/analyzeProject.test.ts
git commit -m "refactor(analyzer): unify project analysis pipeline"
```

### Task 8: Split storage and commit snapshots transactionally

**Files:**
- Create: `packages/analyzer/src/storage/database.ts`
- Create: `packages/analyzer/src/storage/nodeRepository.ts`
- Create: `packages/analyzer/src/storage/edgeRepository.ts`
- Create: `packages/analyzer/src/storage/errorRepository.ts`
- Create: `packages/analyzer/src/storage/graphRepository.ts`
- Create: `packages/analyzer/src/storage/statsRepository.ts`
- Create: `packages/analyzer/src/storage/persistence.ts`
- Modify: `packages/analyzer/src/storage/schema.ts`
- Modify: `packages/analyzer/src/storage/db.ts`
- Modify: `packages/analyzer/src/storage/index.ts`
- Create: `packages/analyzer/__tests__/storage/transaction.test.ts`
- Create: `packages/analyzer/__tests__/storage/writeReport.test.ts`

- [ ] **Step 1: Write rollback and rejection-report tests**

Seed snapshot A, inject a failure after nodes for snapshot B, then assert snapshot A is still returned. Insert an edge with a missing target and assert `committed === true`, `edges.rejected === 1`, and `rejectedEdges[0].reason === 'missing_target'`.

- [ ] **Step 2: Run storage tests**

Run: `pnpm --filter @codeomnivis/analyzer test -- transaction.test.ts writeReport.test.ts db.test.ts`

Expected: FAIL because current methods catch errors independently, return booleans/counts, and `clearGraph()` happens before a full replacement succeeds.

- [ ] **Step 3: Add schema version and snapshot metadata**

Add `schema_meta(version)` and `snapshots(snapshot_id, snapshot_digest, payload, created_at)` tables. Migrate existing cache by rebuilding only CodeOmniVis cache tables; never alter analyzed project files.

- [ ] **Step 4: Implement transaction and repositories**

```typescript
export interface SqlDatabase {
  transaction<T>(operation: () => T): T
  close(): void
}

export function replaceSnapshot(
  snapshot: ProjectSnapshot,
  repositories: Repositories,
): WriteReport
```

`replaceSnapshot()` starts a transaction, writes into the graph tables, validates every edge endpoint before insert, stores the snapshot only after all required writes, commits, then atomically persists the sql.js export. Storage exceptions are not swallowed.

- [ ] **Step 5: Keep `OmniDatabase` as a thin facade**

The facade delegates existing public query methods to repositories so server/MCP compatibility remains. New code depends on `AnalysisStore`/repository interfaces. Keep each new file below 300 lines.

- [ ] **Step 6: Run storage and full analyzer tests**

Run: `pnpm --filter @codeomnivis/analyzer test && pnpm --filter @codeomnivis/analyzer typecheck`

Expected: PASS; failed replacement preserves prior snapshot and partial writes never report full success.

- [ ] **Step 7: Commit**

```bash
git add packages/analyzer/src/storage packages/analyzer/__tests__/storage
git commit -m "refactor(analyzer): commit snapshots transactionally"
```

### Task 9: Prove CLI, REST and MCP snapshot parity

**Files:**
- Create: `packages/contract-tests/package.json`
- Create: `packages/contract-tests/tsconfig.json`
- Create: `packages/contract-tests/vitest.config.ts`
- Create: `packages/contract-tests/fixtures/parity-project/`
- Create: `packages/contract-tests/__tests__/snapshotParity.test.ts`
- Modify: `packages/cli/src/commands/analyze.ts`
- Modify: `packages/server/src/index.ts`
- Modify: `packages/mcp/src/server.ts`

- [ ] **Step 1: Write a four-surface parity test**

Analyze the fixture directly, run `codeomnivis analyze --json`, query `/api/graph` plus snapshot metadata, and call an MCP tool. Assert the exact `snapshotDigest`, sorted node IDs, sorted edge IDs and issue IDs agree.

- [ ] **Step 2: Run parity test**

Run: `pnpm --filter @codeomnivis/contract-tests test -- snapshotParity.test.ts`

Expected: FAIL until every surface returns snapshot identity from the same pipeline.

- [ ] **Step 3: Add compatible snapshot projections**

CLI `--json` writes `{ data: snapshot, meta: { snapshotId, snapshotDigest } }` to stdout and logs to stderr. REST preserves existing `data` graph shape and adds snapshot fields to `meta`. MCP tool text adds a top-level `snapshot` object without renaming existing result properties.

- [ ] **Step 4: Run parity and package suites**

Run: `pnpm --filter @codeomnivis/contract-tests test && pnpm test`

Expected: PASS with one digest for all four surfaces.

- [ ] **Step 5: Commit**

```bash
git add packages/contract-tests packages/cli/src/commands/analyze.ts packages/server/src/index.ts packages/mcp/src/server.ts
git commit -m "test(shared): verify snapshot parity across surfaces"
```

### Task 10: Establish coverage and parser behavior gates

**Files:**
- Modify: `package.json`
- Modify: `packages/*/package.json`
- Modify: `packages/*/vitest.config.ts`
- Create: `vitest.workspace.ts`
- Create: `packages/analyzer/__tests__/parsers/nestjs.test.ts`
- Create: `packages/analyzer/__tests__/parsers/drizzle.test.ts`
- Create: `packages/analyzer/__tests__/fixtures/nestjs/`
- Create: `packages/analyzer/__tests__/fixtures/drizzle/`
- Create: `scripts/verifyChangedCoverage.mjs`

- [ ] **Step 1: Add behavior tests for NestJS and Drizzle**

Each parser receives normal, malformed and boundary fixtures. Assert parser failures return `{ nodes: [], edges: [], errors: [{ severity: 'warning', ... }] }` rather than rejecting.

- [ ] **Step 2: Install and configure V8 coverage**

Run: `pnpm add -Dw vitest@^1.6.1 @vitest/coverage-v8@^1.6.1`

Add scripts `test:coverage` and threshold configuration: global lines/functions/statements 85, branches 80; analyzer/server lines 85. Include `packages/*/src/**/*.{ts,tsx}` and exclude generated declarations, dist, fixtures and WASM.

- [ ] **Step 3: Run coverage to obtain the actual deficit**

Run: `pnpm test:coverage`

Expected: FAIL on concrete uncovered files until focused tests close the reported gaps; save the summary in the implementation log.

- [ ] **Step 4: Add focused tests for reported uncovered behavior**

For every file below threshold, add a test that exercises an observable branch: successful result, expected degradation, invalid boundary, or resource cleanup. Do not exclude production files merely to satisfy the number.

Create `scripts/verifyChangedCoverage.mjs` to read `coverage/coverage-final.json`, find added/modified production files from `QUALITY_BASE_SHA` (or `git merge-base origin/master HEAD`), and fail when any covered file has line coverage below 90% or is absent from the coverage map.

- [ ] **Step 5: Re-run coverage**

Run: `pnpm test:coverage && node scripts/verifyChangedCoverage.mjs`

Expected: PASS at all global and package thresholds.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.workspace.ts scripts/verifyChangedCoverage.mjs packages/*/package.json packages/*/vitest.config.ts packages/analyzer/__tests__/parsers packages/analyzer/__tests__/fixtures/nestjs packages/analyzer/__tests__/fixtures/drizzle
git commit -m "test(analyzer): enforce coverage and parser contracts"
```

### Task 11: Add real browser E2E

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/workbench.spec.ts`
- Create: `e2e/helpers/server.ts`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install Playwright and write the smoke flow**

Run: `pnpm add -Dw @playwright/test@^1.61.1 && pnpm exec playwright install chromium`

The test starts the built packed CLI against `demo/`, opens the workbench, waits for a non-empty graph, switches architecture/quality views, searches a known node, expands a hierarchy, and verifies a forced API failure renders the controlled error state without uncaught console errors. The cross-language plan extends this flow with the Test view after that view exists.

- [ ] **Step 2: Run the browser test and observe missing selectors/test view**

Run: `pnpm test:e2e`

Expected: FAIL only on explicit missing stable selectors or test view; record each failure before adding `data-testid` at the owning component.

- [ ] **Step 3: Add minimal stable selectors and lifecycle cleanup**

Selectors describe user-visible roles (`workbench`, `view-architecture`, `graph-canvas`, `search-input`, `canvas-error`). The helper allocates an ephemeral loopback port, captures stdout/stderr, and always SIGTERM/SIGKILL-cleans the child.

- [ ] **Step 4: Run E2E twice**

Run: `pnpm test:e2e && pnpm test:e2e`

Expected: both runs PASS with no port/process leak and trace retained only on failure.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e package.json pnpm-lock.yaml .gitignore packages/ui/src
git commit -m "test(ui): add browser workbench E2E"
```

### Task 12: Complete CI and the quality gate

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `.prettierignore`

- [ ] **Step 1: Add deterministic formatting checks**

Run: `pnpm add -Dw prettier@^3.9.5`

Add `"format:check": "prettier --check ."` and keep generated/cache directories excluded through `.prettierignore`.

```text
node_modules
dist
coverage
playwright-report
test-results
.turbo
.codex
.planning
.superpowers
```

- [ ] **Step 2: Re-run production audit before composing the gate**

Run: `pnpm build && pnpm test && node scripts/auditProduction.mjs`

Expected: build/tests PASS and `scripts/auditProduction.mjs` reports no unhandled reachable high/critical advisory.

- [ ] **Step 3: Define the root quality gate**

```json
{
  "scripts": {
    "test:coverage": "vitest --run --coverage",
    "test:e2e": "playwright test",
    "test:contracts": "pnpm --filter @codeomnivis/contract-tests test",
    "audit:prod": "node scripts/auditProduction.mjs",
    "quality:gate": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test:coverage && node scripts/verifyChangedCoverage.mjs && pnpm test:contracts && pnpm test:e2e && pnpm audit:prod && pnpm verify:readme && pnpm verify:contracts && pnpm verify:package"
  }
}
```

- [ ] **Step 4: Split CI into required quality jobs**

Set push/pull_request branches to `[master]`. Use `pnpm install --frozen-lockfile`, Node 20, cached Playwright browsers, artifact upload for coverage and failed traces, and jobs `static`, `test`, `browser`, `package`. All jobs are required before release.

- [ ] **Step 5: Add release workflow**

Trigger on `v*` tags, use protected `npm` environment, `id-token: write`, official registry, `npm publish --provenance --access public` from `packages/cli`, then run registry verification. Do not embed npm tokens in repository files.

- [ ] **Step 6: Run the complete gate locally**

Run: `pnpm quality:gate`

Expected: PASS from a clean dependency install.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows package.json pnpm-lock.yaml .prettierignore
git commit -m "chore(cli): enforce release quality gate"
```

### Task 13: Synchronize documentation with executable contracts

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `packages/cli/README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/architecture/data-model.md`
- Modify: `docs/architecture/parser-pipeline.md`
- Modify: `docs/api/rest-api.md`
- Modify: `docs/api/mcp-tools.md`
- Modify: `docs/demo/cal-com-validation.md`
- Create: `scripts/verifyPublicContracts.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write executable documentation checks**

`verifyPublicContracts.mjs` imports/reads the CLI command registry, Express route inventory and `PUBLIC_TOOL_NAMES`, then compares them with fenced contract blocks in the docs. It fails on stale command names, REST paths, MCP tools, nonexistent pnpm filters, placeholder cal.com evidence, and the obsolete “AI always returns 501” statement.

- [ ] **Step 2: Run verifier and capture current failures**

Run: `pnpm verify:readme && pnpm verify:contracts`

Expected: `verify:readme` PASS; `verify:contracts` FAIL on the known stale architecture/REST/AI/contribution/cal.com content.

- [ ] **Step 3: Rewrite docs from current contracts**

Document: one snapshot/three surfaces; exact remote session/bearer behavior; all current node/edge types; every registered MCP tool and stdio setup; correct `@bynlk/codeomnivis` filter; explicit AI configuration; fixed cal.com revision with measured duration/node/edge/error counts; static test discovery versus explicit execution.

- [ ] **Step 4: Verify links, commands and package names**

Run: `pnpm verify:readme && pnpm verify:contracts && pnpm verify:package`

Expected: PASS with no broken local asset or nonexistent workspace filter.

- [ ] **Step 5: Commit**

```bash
git add README.md README.zh-CN.md packages/cli/README.md CONTRIBUTING.md CHANGELOG.md docs/architecture docs/api docs/demo/cal-com-validation.md scripts/verifyPublicContracts.mjs package.json
git commit -m "docs(docs): synchronize public product contracts"
```

### Task 14: Final release, registry verification and reassessment

**Files:**
- Create: `scripts/verifyRegistryInstall.mjs`
- Modify: `package.json`
- Modify: `packages/cli/package.json`
- Modify: `CHANGELOG.md`
- Create: `docs/reports/2026-07-14-quality-90-reassessment.md`
- Modify: `docs/plans/changelog.md`

- [ ] **Step 1: Add official-registry verification script**

The script creates a temporary directory with an empty package, runs `npm view @bynlk/codeomnivis@<version> version --registry=https://registry.npmjs.org`, then `npx --yes --package @bynlk/codeomnivis@<version> codeomnivis --help` and a bounded `serve --project <demo> --no-open` health/graph/UI smoke test. It must not resolve workspace packages.

- [ ] **Step 2: Run the final local gate and inspect package**

Run: `pnpm install --frozen-lockfile && pnpm quality:gate && cd packages/cli && npm pack --dry-run --json --registry=https://registry.npmjs.org`

Expected: all gates PASS; tarball contains only `dist`, `bin`, README and LICENSE plus npm metadata; no source maps containing secrets or local paths.

- [ ] **Step 3: Confirm npm identity without exposing credentials**

Run: `npm whoami --registry=https://registry.npmjs.org && npm access list packages --json`

Expected: authenticated identity has publish rights for `@bynlk/codeomnivis`. If 2FA requires an interactive OTP, pause only for the OTP/trusted-publishing authorization; do not store it.

- [ ] **Step 4: Version, changelog and release commit**

Select the next unpublished semver by checking official registry, update package/root version references through the package manager, finalize `CHANGELOG.md`, and commit:

```bash
git add package.json packages/cli/package.json pnpm-lock.yaml CHANGELOG.md docs/plans/changelog.md
git commit -m "chore(cli): prepare npm release"
```

- [ ] **Step 5: Tag, push and publish**

Run: `git tag v<version> && git push origin master --follow-tags`

Expected: release workflow publishes with provenance. If trusted publishing is unavailable but the authenticated local session is valid, run `npm publish --access public --provenance --registry=https://registry.npmjs.org` from `packages/cli` after the same gate.

- [ ] **Step 6: Verify from the official registry**

Run: `node scripts/verifyRegistryInstall.mjs <version>`

Expected: PASS from a clean temp directory; `npm view` and `npx` resolve the published version, and serve returns a non-empty graph.

- [ ] **Step 7: Reassess with the original weights**

Write `docs/reports/2026-07-14-quality-90-reassessment.md` with each score, deductions, command evidence, limitations and weighted arithmetic. Require total ≥90, every dimension ≥85, and no P0/P1. If a threshold misses, do not claim completion or publish another version until the failing dimension has a concrete corrective commit.

- [ ] **Step 8: Commit reassessment evidence**

```bash
git add scripts/verifyRegistryInstall.mjs package.json docs/reports/2026-07-14-quality-90-reassessment.md
git commit -m "docs(docs): record quality 90 reassessment"
git push origin master
```

## Final acceptance checklist

- [ ] `pnpm quality:gate` passes from a frozen install.
- [ ] MCP stdio E2E and browser E2E pass twice.
- [ ] CLI, analyzer, REST and MCP expose the same `snapshotDigest` for the parity fixture.
- [ ] Global and analyzer/server coverage thresholds pass.
- [ ] `pnpm audit --prod` has no unhandled reachable high advisory.
- [ ] Non-loopback REST/AI/WS data access requires bearer or session; loopback remains zero-config.
- [ ] Public CLI commands, REST paths and MCP tool names remain compatible.
- [ ] Official npm `npm view` and clean-directory `npx` verification pass.
- [ ] Reassessment is ≥90 weighted, every dimension ≥85, and no P0/P1 remains.
