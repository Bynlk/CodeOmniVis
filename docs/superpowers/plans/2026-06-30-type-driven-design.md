# Type-Driven Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 CodeOmniVis 的核心图模型从“宽松 union + metadata fallback”推进到真正的 discriminated union，并让 parser、storage、MCP、UI 都通过类型推导消费节点和边。

**Architecture:** 先修复 monorepo typecheck 基础设施，再把 `OmniNode` / `OmniEdge` 改成由 `type` 字段驱动 `metadata` 的封闭联合类型。外部输入、DB JSON、MCP 参数仍以 `unknown` 进入系统，但必须在边界被 schema/guard 收敛为领域类型，业务层不再读 `Record<string, unknown>`。

**Tech Stack:** TypeScript strict mode, Vitest, Turborepo, sql.js, MCP SDK, React, Cytoscape.

---

## Current Baseline

Fresh AST scan on current `master`:

| Metric | Count |
| --- | ---: |
| TS `any` keyword | 0 |
| TS `unknown` keyword | 38 |
| Type assertions | 0 |
| Double casts | 0 |
| `as const` | 0 |
| `satisfies` | 22 |

Important existing blockers:

- `./node_modules/.bin/turbo typecheck` fails because the environment cannot find the package manager binary.
- `./node_modules/.bin/tsc -p packages/analyzer/tsconfig.json --noEmit` fails with `TS6306` because referenced projects do not set `composite: true`.
- `NodeMetadata` and `EdgeMetadata` still include `Record<string, unknown>` fallback.
- `OmniNode` and `OmniEdge` are not yet true discriminated unions; `type` and `metadata` are not fully correlated in the base interfaces.
- `MCP` uses `metadataValue(node, key): unknown`, which is a symptom of weak metadata typing.

---

## Autonomous Loop Engineering

This plan is designed for autonomous execution. Do not pause for human confirmation between tasks. The executor should make conservative engineering decisions, run the gates below, commit only green states, and continue until the final acceptance criteria pass or a hard blocker is reached.

### Default Execution Mode

Use this mode unless the user explicitly overrides it:

```text
branch: feat/type-driven-design
commit policy: one passing commit per task
push policy: push after each passing commit
human confirmation: not required
allowed automatic decisions: narrow type modeling, test fixture repair, per-package verification fallback
not allowed without explicit user request: force push, destructive reset of user work, skipping failed quality gates
```

### Loop State Machine

Every task must run this loop:

```text
1. BASELINE
   Read current task and relevant files.
   Confirm git status.
   Record current metrics if the task affects type safety.

2. RED
   Add or update the smallest failing test/typecheck that exposes the weak typing being removed.
   Run the focused command and confirm it fails for the expected reason.
   If the current code already fails earlier because of known infrastructure blockers, use the narrower direct command listed in the task.

3. GREEN
   Implement the smallest change that satisfies the test and preserves runtime behavior.
   Avoid casts, broad fallback types, and metadata string-key access.

4. VERIFY
   Run focused tests.
   Run package-level typecheck.
   Run AST/type-safety scan when the task touches shared graph types, storage, parser output, MCP, or UI response parsing.

5. REPAIR
   If verification fails, classify the failure and repair in-place.
   Repeat GREEN → VERIFY up to 3 attempts for the same failure class.

6. COMMIT
   Commit only after verification exits 0 or the only failure is a documented unrelated environment failure.
   Push the passing commit.

7. NEXT
   Continue to the next task without asking for confirmation.
```

### Failure Classification

Use deterministic handling so execution does not stall on avoidable decisions:

| Failure class | Examples | Autonomous action |
| --- | --- | --- |
| Type model mismatch | `metadata` property missing after discriminated union change | Fix the source of the mismatch; do not add casts. |
| Test fixture incompleteness | Test node has `metadata: {}` after metadata closure | Replace with valid metadata for that exact node or edge type. |
| Boundary parsing failure | DB JSON or MCP args typed too broadly | Add a guard/parser at the boundary; keep domain logic typed. |
| Existing infra blocker | `turbo typecheck` cannot find package manager binary | Use package-level `tsc` gates and record the blocker in the task notes. |
| Repeated ambiguous design failure | Same class fails after 3 repair attempts | Split the task into a smaller commit and continue with the next independently verifiable slice. |
| Potential data-loss operation | Need to remove or overwrite unrelated user work | Stop and report. This is the only class that requires human input. |

### Non-Negotiable Quality Gates

Run these after every task that changes code:

```bash
git diff --check
```

Run this AST scan after every task touching types or metadata:

```bash
/opt/homebrew/bin/node -e 'const fs=require("fs"),path=require("path"),ts=require("typescript");const root=process.cwd(),ex=new Set(["node_modules","dist","build","coverage",".git",".turbo",".next"]),exts=new Set([".ts",".tsx",".mts",".cts"]);let any=0,unknown=0,assertions=0,doubleCasts=0;function walk(d,o=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(ex.has(e.name))continue;const f=path.join(d,e.name);if(e.isDirectory())walk(f,o);else if(e.isFile()&&exts.has(path.extname(e.name)))o.push(f)}return o}for(const f of walk(root)){const sf=ts.createSourceFile(f,fs.readFileSync(f,"utf8"),ts.ScriptTarget.Latest,true,f.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);function visit(n){if(n.kind===ts.SyntaxKind.AnyKeyword)any++;else if(n.kind===ts.SyntaxKind.UnknownKeyword)unknown++;else if(ts.isAsExpression(n)||ts.isTypeAssertionExpression(n)||ts.isNonNullExpression(n))assertions++;if((ts.isAsExpression(n)||ts.isTypeAssertionExpression(n))&&(ts.isAsExpression(n.expression)||ts.isTypeAssertionExpression(n.expression)))doubleCasts++;ts.forEachChild(n,visit)}visit(sf)}console.table([{any,unknown,assertions,doubleCasts}])'
```

Expected final trend:

```text
any: 0
assertions: 0
doubleCasts: 0
unknown: allowed only at runtime boundaries
```

### Package Verification Matrix

Use focused package commands rather than one monolithic gate until package manager discovery is fixed:

| Area changed | Required command |
| --- | --- |
| `packages/shared/src/**` | `./node_modules/.bin/tsc -p packages/shared/tsconfig.json --noEmit` |
| `packages/shared/__tests__/**` | `cd packages/shared && ./node_modules/.bin/vitest run __tests__/types __tests__/constants` |
| `packages/analyzer/src/parsers/**` | `cd packages/analyzer && ./node_modules/.bin/vitest run __tests__/parsers` |
| `packages/analyzer/src/storage/**` | `cd packages/analyzer && ./node_modules/.bin/vitest run __tests__/storage/db.test.ts` |
| `packages/analyzer/src/graph/**` | `cd packages/analyzer && ./node_modules/.bin/vitest run __tests__/graph` |
| `packages/analyzer/src/resolver/**` | `cd packages/analyzer && ./node_modules/.bin/vitest run __tests__/resolver` |
| `packages/mcp/src/**` | `cd packages/mcp && ./node_modules/.bin/tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --strict --esModuleInterop --skipLibCheck --lib ES2022 --types node src/index.ts` |
| `packages/mcp/__tests__/**` | `cd packages/mcp && ./node_modules/.bin/vitest run __tests__/tools.test.ts` |
| `packages/ui/src/**` | `./node_modules/.bin/tsc -p packages/ui/tsconfig.json --noEmit` |
| `packages/ui/__tests__/**` | `cd packages/ui && ./node_modules/.bin/vitest run __tests__/utils/graphTransform.test.ts` |

### Autonomous Review Loop

After each passing task commit, run a local review pass before pushing:

```bash
git show --stat --oneline HEAD
git show --check HEAD
```

Review checklist:

- The commit touches only files listed in the task.
- No casts were introduced.
- No `Record<string, unknown>` fallback was introduced in shared domain types.
- No production metadata access through arbitrary string keys was introduced.
- Tests added or updated match the changed type contract.

If review fails, amend the commit:

```bash
git add <fixed-files>
git commit --amend --no-edit
```

Then rerun the required gates and push:

```bash
git push origin feat/type-driven-design
```

### Progress Ledger

Create and maintain this file during execution:

```text
docs/superpowers/progress/type-driven-design-loop.md
```

Each task appends:

```markdown
## Task N - <name>

- Commit: <hash>
- Gates:
  - <command>: pass/fail
- Metrics:
  - any: <n>
  - unknown: <n>
  - assertions: <n>
  - doubleCasts: <n>
- Notes:
  - <short design decision or blocker>
```

The ledger is informational and should not block execution. If writing the ledger fails, continue and include the missing entry in the next successful commit.

### Stop Conditions

Autonomous execution stops only when one of these is true:

1. Final acceptance criteria pass and the branch is pushed.
2. A required destructive action would affect unrelated user work.
3. The same failure class repeats after 3 repair attempts and cannot be split into a smaller independently verifiable task.
4. A dependency is missing and no narrower local command can verify the changed code.

For stop conditions 2-4, leave the worktree in the safest state possible:

```bash
git status --short --branch
git log --oneline -5
```

Then report the blocker, the last passing commit, and the exact failing command.

---

## Target State

1. `OmniNode` is a discriminated union:

```ts
export type TypedOmniNode<T extends NodeType> = {
  id: string
  type: T
  name: string
  filePath: string
  line: number
  column: number
  metadata: NodeTypeMetadataMap[T]
}

export type OmniNode = {
  [T in NodeType]: TypedOmniNode<T>
}[NodeType]
```

2. `OmniEdge` is a discriminated union:

```ts
export type TypedOmniEdge<T extends EdgeType> = {
  id: string
  source: string
  target: string
  type: T
  confidence: EdgeConfidence
  metadata: EdgeTypeMetadataMap[T]
}

export type OmniEdge = {
  [T in EdgeType]: TypedOmniEdge<T>
}[EdgeType]
```

3. `NodeMetadata` and `EdgeMetadata` are derived types, not independently maintained fallback unions:

```ts
export type NodeMetadata = NodeTypeMetadataMap[NodeType]
export type EdgeMetadata = EdgeTypeMetadataMap[EdgeType]
```

4. No production business code reads metadata through arbitrary string keys.

5. DB and MCP remain tolerant at input boundaries, but validation happens before values reach graph/domain logic.

---

## Files And Responsibilities

**Shared domain types**

- Modify `packages/shared/src/types/json.ts`
  - New file.
  - Defines `JsonPrimitive`, `JsonValue`, `JsonObject`, and shared JSON guards.
- Modify `packages/shared/src/types/node.ts`
  - Owns node discriminated union.
  - Removes `Record<string, unknown>` fallback from `NodeMetadata`.
  - Exports `createTypedNode()` and `isNodeOfType()`.
- Modify `packages/shared/src/types/edge.ts`
  - Owns edge discriminated union.
  - Removes `Record<string, unknown>` fallback from `EdgeMetadata`.
  - Adds concrete metadata for `imports` and `data_flows_to`.
  - Exports `createTypedEdge()` and `isEdgeOfType()`.
- Modify `packages/shared/src/types/graph.ts`
  - Makes `ParseResult` and graph helpers preserve typed node/edge narrowing.
- Modify `packages/shared/src/index.ts`
  - Exports new JSON, node, and edge helpers.

**Storage boundary**

- Modify `packages/analyzer/src/storage/db.ts`
  - Parses SQL rows into typed graph objects through `parseStoredNode()` / `parseStoredEdge()`.
  - Replaces `Record<string, unknown>` JSON return values with `JsonObject`.
  - Replaces `getSubtree(): Record<string, unknown>` with `GraphSubtree`.
- Modify `packages/analyzer/src/storage/schema.ts`
  - No schema shape change expected; only tests may need stronger expected output types.

**Parser output**

- Modify parser files under `packages/analyzer/src/parsers/**`
  - Construct nodes/edges via typed helpers.
  - Ensure every edge type has concrete metadata.

**Resolver and graph logic**

- Modify `packages/analyzer/src/graph/*.ts` and `packages/analyzer/src/resolver/*.ts`
  - Replace string-key metadata reads with `isNodeOfType()` / `isEdgeOfType()` narrowing.

**Runtime interfaces**

- Modify `packages/mcp/src/index.ts`
  - Replace `Record<string, unknown>` tool args with per-tool argument guards.
  - Remove `metadataValue()`.
- Modify `packages/server/src/routes/graph.ts` and `packages/server/src/index.ts`
  - Return typed graph DTOs; validate query params at route boundary.

**UI boundary**

- Modify `packages/ui/src/**`
  - Keep `satisfies` in `cytoscapeConfig.ts`.
  - Treat HTTP response JSON as unknown at fetch boundary, then parse into typed response models.

**Build and lint**

- Modify `tsconfig.base.json`
- Modify `packages/*/tsconfig.json`
- Modify `eslint.config.js`
  - Restore whole-workspace typecheck.
  - Add type-aware unsafe rules after graph model migration is complete.

---

## Task 0: Bootstrap Autonomous Loop

**Files:**
- Create: `docs/superpowers/progress/type-driven-design-loop.md`
- No source code changes.

- [ ] **Step 1: Create and switch to the feature branch**

Run:

```bash
git status --short --branch
git switch -c feat/type-driven-design
```

Expected:

```text
## feat/type-driven-design
```

If the branch already exists, run:

```bash
git switch feat/type-driven-design
```

- [ ] **Step 2: Create the progress ledger**

Create `docs/superpowers/progress/type-driven-design-loop.md`:

```markdown
# Type-Driven Design Loop Progress

## Baseline

- Branch: `feat/type-driven-design`
- Starting plan: `docs/superpowers/plans/2026-06-30-type-driven-design.md`
- Baseline metrics:
  - any: 0
  - unknown: 38
  - assertions: 0
  - doubleCasts: 0
  - satisfies: 22

## Loop Rules

- One passing commit per task.
- Push after each passing commit.
- Do not ask for human confirmation between tasks.
- Stop only on documented stop conditions in the plan.
```

- [ ] **Step 3: Run baseline gates**

Run:

```bash
git diff --check
/opt/homebrew/bin/node -e 'const fs=require("fs"),path=require("path"),ts=require("typescript");const root=process.cwd(),ex=new Set(["node_modules","dist","build","coverage",".git",".turbo",".next"]),exts=new Set([".ts",".tsx",".mts",".cts"]);let any=0,unknown=0,assertions=0,doubleCasts=0;function walk(d,o=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(ex.has(e.name))continue;const f=path.join(d,e.name);if(e.isDirectory())walk(f,o);else if(e.isFile()&&exts.has(path.extname(e.name)))o.push(f)}return o}for(const f of walk(root)){const sf=ts.createSourceFile(f,fs.readFileSync(f,"utf8"),ts.ScriptTarget.Latest,true,f.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);function visit(n){if(n.kind===ts.SyntaxKind.AnyKeyword)any++;else if(n.kind===ts.SyntaxKind.UnknownKeyword)unknown++;else if(ts.isAsExpression(n)||ts.isTypeAssertionExpression(n)||ts.isNonNullExpression(n))assertions++;if((ts.isAsExpression(n)||ts.isTypeAssertionExpression(n))&&(ts.isAsExpression(n.expression)||ts.isTypeAssertionExpression(n.expression)))doubleCasts++;ts.forEachChild(n,visit)}visit(sf)}console.table([{any,unknown,assertions,doubleCasts}])'
```

Expected:

```text
any: 0
assertions: 0
doubleCasts: 0
unknown: 38
```

- [ ] **Step 4: Commit and push the loop bootstrap**

Run:

```bash
git add docs/superpowers/plans/2026-06-30-type-driven-design.md docs/superpowers/progress/type-driven-design-loop.md
git commit -m "docs: define autonomous type-driven design loop"
git push origin feat/type-driven-design
```

Expected: branch exists remotely with the loop plan committed.

---

## Task 1: Make Typecheck A Reliable Gate

**Files:**
- Modify: `tsconfig.base.json`
- Modify: `packages/shared/tsconfig.json`
- Modify: `packages/analyzer/tsconfig.json`
- Modify: `packages/server/tsconfig.json`
- Modify: `packages/mcp/tsconfig.json`
- Modify: `packages/cli/tsconfig.json`
- Modify: `packages/ui/tsconfig.json`
- Test: package-level `tsc --noEmit`

- [ ] **Step 1: Add composite-friendly shared compiler defaults**

In `tsconfig.base.json`, add:

```json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true
  }
}
```

Keep existing options. Do not remove `strict`, `isolatedModules`, or `skipLibCheck`.

- [ ] **Step 2: Make UI compatible with composite**

In `packages/ui/tsconfig.json`, keep `noEmit: true` only if TypeScript accepts it with `composite`. If it conflicts, remove project references from packages that do not need UI as a referenced build target. UI is currently not referenced by other packages, so it can remain a standalone typecheck package.

- [ ] **Step 3: Run package typechecks**

Run:

```bash
./node_modules/.bin/tsc -p packages/shared/tsconfig.json --noEmit
./node_modules/.bin/tsc -p packages/analyzer/tsconfig.json --noEmit
./node_modules/.bin/tsc -p packages/server/tsconfig.json --noEmit
./node_modules/.bin/tsc -p packages/mcp/tsconfig.json --noEmit
./node_modules/.bin/tsc -p packages/cli/tsconfig.json --noEmit
./node_modules/.bin/tsc -p packages/ui/tsconfig.json --noEmit
```

Expected: all commands exit `0`. If `turbo typecheck` still fails because of package manager binary discovery, do not treat that as a code failure; keep package-level commands as the verified gate until package manager setup is fixed.

- [ ] **Step 4: Commit**

```bash
git add tsconfig.base.json packages/*/tsconfig.json
git commit -m "chore: restore package typecheck gates"
```

---

## Task 2: Add JSON Boundary Types

**Files:**
- Create: `packages/shared/src/types/json.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/__tests__/types/json.test.ts`

- [ ] **Step 1: Add JSON domain types**

Create `packages/shared/src/types/json.ts`:

```ts
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject
export type JsonObject = { [key: string]: JsonValue }

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function jsonObjectOrEmpty(value: unknown): JsonObject {
  return isJsonObject(value) ? value : {}
}
```

- [ ] **Step 2: Export JSON types**

In `packages/shared/src/index.ts`, export:

```ts
export type { JsonPrimitive, JsonValue, JsonObject } from './types/json'
export { isJsonObject, jsonObjectOrEmpty } from './types/json'
```

- [ ] **Step 3: Add tests**

Create `packages/shared/__tests__/types/json.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isJsonObject, jsonObjectOrEmpty } from '../../src/types/json'

describe('json guards', () => {
  it('accepts plain objects', () => {
    expect(isJsonObject({ ok: true })).toBe(true)
  })

  it('rejects arrays and null', () => {
    expect(isJsonObject([])).toBe(false)
    expect(isJsonObject(null)).toBe(false)
  })

  it('returns empty object for non-object input', () => {
    expect(jsonObjectOrEmpty('x')).toEqual({})
  })
})
```

- [ ] **Step 4: Verify**

Run:

```bash
./node_modules/.bin/vitest run __tests__/types/json.test.ts
./node_modules/.bin/tsc -p packages/shared/tsconfig.json --noEmit
```

Expected: tests pass and typecheck exits `0`.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/json.ts packages/shared/src/index.ts packages/shared/__tests__/types/json.test.ts
git commit -m "feat(shared): add json boundary types"
```

---

## Task 3: Close Node Metadata Types

**Files:**
- Modify: `packages/shared/src/types/node.ts`
- Modify: `packages/shared/src/index.ts`
- Update tests under `packages/shared/__tests__/types/`
- Update parser tests that construct `OmniNode`

- [ ] **Step 1: Replace independent `NodeMetadata` union**

In `packages/shared/src/types/node.ts`, remove `| Record<string, unknown>` from `NodeMetadata` and replace the type with:

```ts
export type NodeMetadata = NodeTypeMetadataMap[NodeType]
```

- [ ] **Step 2: Make `OmniNode` a discriminated union**

Replace the current `OmniNode` interface and `TypedOmniNode` alias with:

```ts
export type TypedOmniNode<T extends NodeType> = {
  id: string
  type: T
  name: string
  filePath: string
  line: number
  column: number
  metadata: NodeTypeMetadataMap[T]
}

export type OmniNode = {
  [T in NodeType]: TypedOmniNode<T>
}[NodeType]
```

- [ ] **Step 3: Add typed node factory**

Add:

```ts
export function createTypedNode<T extends NodeType>(
  node: TypedOmniNode<T>
): TypedOmniNode<T> {
  return node
}
```

- [ ] **Step 4: Replace empty test metadata**

Any test node with `type: 'component'` and `metadata: {}` must use:

```ts
metadata: {
  props: [],
  hasState: false,
  isPage: false,
  jsxChildCount: 0,
}
```

Any test node with `type: 'handler'` and `metadata: {}` must use:

```ts
metadata: {
  functionName: 'handler',
  routeId: null,
}
```

- [ ] **Step 5: Verify**

Run:

```bash
./node_modules/.bin/vitest run __tests__/types/node.test.ts
./node_modules/.bin/tsc -p packages/shared/tsconfig.json --noEmit
./node_modules/.bin/vitest run __tests__/resolver/symbolResolver.test.ts
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/types/node.ts packages/shared/src/index.ts packages/shared/__tests__/types/node.test.ts packages/analyzer/__tests__/resolver/symbolResolver.test.ts
git commit -m "feat(shared): make nodes metadata-driven"
```

---

## Task 4: Close Edge Metadata Types

**Files:**
- Modify: `packages/shared/src/types/edge.ts`
- Modify: `packages/shared/src/index.ts`
- Update parser and graph tests creating `OmniEdge`

- [ ] **Step 1: Define concrete remaining edge metadata**

In `packages/shared/src/types/edge.ts`, add:

```ts
export interface ImportsMetadata {
  importPath: string
  importedNames: string[]
  isTypeOnly: boolean
}

export interface DataFlowsToMetadata {
  path: string[]
  sourceField: string | null
  targetField: string | null
}
```

- [ ] **Step 2: Replace fallback edge metadata map entries**

Update `EdgeTypeMetadataMap`:

```ts
imports: ImportsMetadata
data_flows_to: DataFlowsToMetadata
```

Remove `Record<string, unknown>` from `EdgeMetadata` and replace it with:

```ts
export type EdgeMetadata = EdgeTypeMetadataMap[EdgeType]
```

- [ ] **Step 3: Make `OmniEdge` a discriminated union**

Replace the current `OmniEdge` interface and `TypedOmniEdge` alias with:

```ts
export type TypedOmniEdge<T extends EdgeType> = {
  id: string
  source: string
  target: string
  type: T
  confidence: EdgeConfidence
  metadata: EdgeTypeMetadataMap[T]
}

export type OmniEdge = {
  [T in EdgeType]: TypedOmniEdge<T>
}[EdgeType]
```

- [ ] **Step 4: Add typed edge factory**

Add:

```ts
export function createTypedEdge<T extends EdgeType>(
  edge: TypedOmniEdge<T>
): TypedOmniEdge<T> {
  return edge
}
```

- [ ] **Step 5: Replace empty edge metadata in tests**

For `imports` edges, use:

```ts
metadata: {
  importPath: '',
  importedNames: [],
  isTypeOnly: false,
}
```

For `data_flows_to` edges, use:

```ts
metadata: {
  path: [],
  sourceField: null,
  targetField: null,
}
```

- [ ] **Step 6: Verify**

Run:

```bash
./node_modules/.bin/vitest run __tests__/types/edge.test.ts
./node_modules/.bin/tsc -p packages/shared/tsconfig.json --noEmit
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/types/edge.ts packages/shared/src/index.ts packages/shared/__tests__/types/edge.test.ts
git commit -m "feat(shared): make edges metadata-driven"
```

---

## Task 5: Move Parser Output To Typed Factories

**Files:**
- Modify: `packages/analyzer/src/parsers/**/*.ts`
- Modify: `packages/analyzer/src/graph/builder.ts`
- Test: parser suites

- [ ] **Step 1: Import factories**

Where parser files construct graph objects, import:

```ts
import { createTypedNode, createTypedEdge } from '@codeomnivis/shared'
```

- [ ] **Step 2: Wrap node outputs**

Example replacement:

```ts
return createTypedNode({
  id: nodeId,
  type: 'db_model',
  name: model.name,
  filePath,
  line,
  column: 1,
  metadata,
})
```

The important property is that `type: 'db_model'` forces `metadata` to be `DbModelMetadata`.

- [ ] **Step 3: Wrap edge outputs**

Example replacement:

```ts
edges.push(createTypedEdge({
  id: createEdgeId(sourceId, 'db_relation', targetId),
  source: sourceId,
  target: targetId,
  type: 'db_relation',
  confidence: 'certain',
  metadata: {
    relationType,
    fieldName: field.name,
    relationName: field.relationName ?? '',
  },
}))
```

- [ ] **Step 4: Add concrete metadata for currently empty edge types**

For `imports` edges emitted by builder/resolver logic:

```ts
metadata: {
  importPath,
  importedNames,
  isTypeOnly,
}
```

For `data_flows_to` edges emitted by `DataFlowTracer`:

```ts
metadata: {
  path,
  sourceField: sourceField ?? null,
  targetField: targetField ?? null,
}
```

- [ ] **Step 5: Verify parser tests**

Run:

```bash
./node_modules/.bin/vitest run __tests__/parsers
./node_modules/.bin/vitest run __tests__/graph
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/analyzer/src/parsers packages/analyzer/src/graph packages/analyzer/__tests__
git commit -m "refactor(analyzer): emit typed graph entities"
```

---

## Task 6: Type Storage Serialization And Deserialization

**Files:**
- Modify: `packages/analyzer/src/storage/db.ts`
- Modify: `packages/analyzer/__tests__/storage/db.test.ts`
- Optional create: `packages/analyzer/src/storage/metadataGuards.ts`

- [ ] **Step 1: Replace raw JSON parse return type**

Change:

```ts
private safeJsonParse(...): Record<string, unknown>
```

to:

```ts
private safeJsonParse(jsonStr: SqlValue | undefined, context: string): JsonObject
```

Use `jsonObjectOrEmpty()` from shared.

- [ ] **Step 2: Add typed subtree model**

Add near `DbStats`:

```ts
export interface GraphSubtree {
  id: string
  name: string
  type: NodeType
  children: GraphSubtree[]
}
```

Change `getSubtree()`:

```ts
getSubtree(rootId: string, edgeType: EdgeType, maxDepth: number): GraphSubtree | null
```

Return `null` when the root is absent. Update MCP component-tree handling to check `tree === null`.

- [ ] **Step 3: Parse stored node metadata by node type**

Add:

```ts
private rowToNode(row: Record<string, SqlValue>): OmniNode {
  const type = sqlNodeType(row.type)
  const metadata = this.safeJsonParse(row.metadata, `node ${row.id}`)
  return parseStoredNode({
    id: sqlString(row.id),
    type,
    name: sqlString(row.name),
    filePath: sqlString(row.file_path),
    line: sqlNumber(row.line),
    column: sqlNumber(row.column),
    metadata,
  })
}
```

`parseStoredNode()` must switch on `type` and either return a valid typed node or a conservative default for that specific type. Do not return a generic metadata fallback.

- [ ] **Step 4: Verify storage tests**

Run:

```bash
./node_modules/.bin/vitest run __tests__/storage/db.test.ts
./node_modules/.bin/tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --strict --esModuleInterop --skipLibCheck --lib ES2022 --types node src/storage/db.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/analyzer/src/storage packages/analyzer/__tests__/storage/db.test.ts
git commit -m "refactor(storage): deserialize typed graph metadata"
```

---

## Task 7: Remove Weak Metadata Reads From MCP

**Files:**
- Modify: `packages/mcp/src/index.ts`
- Modify: `packages/mcp/__tests__/tools.test.ts`

- [ ] **Step 1: Delete `metadataValue()`**

Remove:

```ts
function metadataValue(node: Pick<OmniNode, 'metadata'>, key: string): unknown {
  return Reflect.get(node.metadata, key)
}
```

- [ ] **Step 2: Add typed route helpers**

Add:

```ts
function getRouteDisplay(node: OmniNode): { method: string; path: string } {
  if (isNodeOfType(node, 'api_route')) {
    return { method: node.metadata.method, path: node.metadata.route }
  }
  if (isNodeOfType(node, 'express_route')) {
    return { method: node.metadata.method, path: node.metadata.route }
  }
  if (isNodeOfType(node, 'trpc_procedure')) {
    return { method: node.metadata.procedureType.toUpperCase(), path: node.name }
  }
  if (isNodeOfType(node, 'tsrpc_api')) {
    return { method: node.metadata.transport.toUpperCase(), path: node.metadata.apiPath }
  }
  if (isNodeOfType(node, 'tsrpc_service')) {
    return { method: node.metadata.transport.toUpperCase(), path: node.metadata.servicePath }
  }
  return { method: 'UNKNOWN', path: node.name }
}
```

- [ ] **Step 3: Type tool arguments at boundary**

Define:

```ts
interface GetApiRoutesArgs {
  filter?: string
}

interface GetComponentTreeArgs {
  rootPath: string
  depth?: number
}

interface FindCallersArgs {
  target: string
}

interface GetDataFlowArgs {
  model?: string
}
```

Keep `args: Record<string, unknown> | undefined` only in the request handler, then immediately parse it into one of these types.

- [ ] **Step 4: Verify MCP**

Run:

```bash
./node_modules/.bin/vitest run __tests__/tools.test.ts
./node_modules/.bin/tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --strict --esModuleInterop --skipLibCheck --lib ES2022 --types node src/index.ts
```

Expected: tests pass and direct compile exits `0`.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/index.ts packages/mcp/__tests__/tools.test.ts
git commit -m "refactor(mcp): consume typed graph metadata"
```

---

## Task 8: Type UI API Boundaries

**Files:**
- Modify: `packages/ui/src/components/TabBar/IssuesPanel.tsx`
- Modify: `packages/ui/src/components/TabBar/StatsPanel.tsx`
- Modify: `packages/ui/src/hooks/useGraphFilter.ts`
- Modify: `packages/ui/src/utils/cytoscapeConfig.ts`

- [ ] **Step 1: Keep `satisfies` in Cytoscape styles**

Do not remove the 22 `satisfies` expressions. They are type checks, not escape hatches.

- [ ] **Step 2: Move response guards into named parsers**

For `StatsPanel`, use:

```ts
function parseStatsResponse(value: unknown): StatsResponse {
  if (!isStatsResponse(value)) {
    throw new Error('Invalid stats response')
  }
  return value
}
```

Use the same shape for issues response parsing.

- [ ] **Step 3: Verify UI**

Run:

```bash
./node_modules/.bin/vitest run __tests__/utils/graphTransform.test.ts
./node_modules/.bin/tsc -p packages/ui/tsconfig.json --noEmit
```

Expected: tests pass and UI typecheck exits `0`.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src
git commit -m "refactor(ui): parse api responses at boundaries"
```

---

## Task 9: Add Type-Aware Lint Guards

**Files:**
- Modify: `eslint.config.js`

- [ ] **Step 1: Add strict unsafe rules**

After the graph migration passes typecheck, add:

```js
{
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
  },
}
```

If the current ESLint setup lacks parser project service configuration, add it before enabling these rules:

```js
{
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
}
```

- [ ] **Step 2: Verify lint**

Run:

```bash
./node_modules/.bin/eslint packages/shared/src packages/analyzer/src packages/mcp/src packages/server/src packages/ui/src
```

Expected: exits `0`.

- [ ] **Step 3: Commit**

```bash
git add eslint.config.js
git commit -m "chore: enforce type-aware lint rules"
```

---

## Final Acceptance Criteria

- [ ] AST scan reports:

```text
TS any keyword: 0
Type assertions: 0
Double casts: 0
Non-null assertions: 0
```

- [ ] Remaining `unknown` only appears in:
  - runtime guards
  - JSON parsing boundaries
  - MCP/raw HTTP input parsing boundaries
  - third-party dynamic module resolution

- [ ] `NodeMetadata` has no `Record<string, unknown>` fallback.
- [ ] `EdgeMetadata` has no `Record<string, unknown>` fallback.
- [ ] `OmniNode` and `OmniEdge` are discriminated unions.
- [ ] `metadataValue()` no longer exists.
- [ ] `packages/shared`, `packages/analyzer`, `packages/server`, `packages/mcp`, `packages/cli`, and `packages/ui` package typechecks pass.
- [ ] Relevant Vitest suites pass:

```bash
./node_modules/.bin/vitest run __tests__/types
./node_modules/.bin/vitest run __tests__/storage/db.test.ts
./node_modules/.bin/vitest run __tests__/parsers
./node_modules/.bin/vitest run __tests__/graph
./node_modules/.bin/vitest run __tests__/tools.test.ts
./node_modules/.bin/vitest run __tests__/utils/graphTransform.test.ts
```

---

## Risk Notes

- Closing metadata types will break many tests that currently construct partial graph objects. Fix tests by using real metadata, not casts.
- DB deserialization is the riskiest implementation area because stored JSON can be stale or malformed. Keep error tolerance, but make fallback typed per node/edge type.
- Do not remove `satisfies` from Cytoscape styles. It improves type safety.
- Do not try to eliminate all `unknown`; boundary `unknown` is correct. The goal is to prevent `unknown` from leaking into domain logic.
