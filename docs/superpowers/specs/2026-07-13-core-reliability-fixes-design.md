# CodeOmniVis Core Reliability Fixes Design

**Date:** 2026-07-13
**Status:** Awaiting written-spec approval
**Scope:** First repair batch only — workspace discovery, canonical analysis input, empty-result semantics, and documented local startup.

## 1. Problem

CodeOmniVis currently produces a trustworthy graph for conventional single-app layouts, but its official `serve` path can scan zero files in a pnpm/Turborepo repository whose source lives under `packages/*`. The same project can also be scanned through different directory rules depending on whether the caller is `analyze`, `serve`, or the server refresh path.

This creates two user-facing failures:

1. A valid workspace is detected as `unknown` and produces an empty graph.
2. Zero scanned files or zero graph nodes can still be described as a successful, fresh, issue-free analysis.

The existing parser rule remains unchanged: an individual parser failure must degrade to warnings and must not terminate the complete analysis.

## 2. Chosen Approach

Use one canonical analysis-file collector shared by every analysis entry point, and make project detection populate that collector with all relevant workspace package roots.

Alternatives considered:

- Patch only the hard-coded `packages/*` case in `serve`. This is small but leaves `analyze`, refresh, and future workspace layouts inconsistent.
- Let each command maintain its own scanner. This preserves current ownership boundaries but repeats the defect and makes identical CLI operations produce different graphs.
- **Chosen:** centralize collection at the analyzer boundary, while keeping framework/workspace detection in the CLI detection layer. The dependency direction already permits CLI and Server to call Analyzer, and no parser needs to know about workspaces.

## 3. Architecture

### 3.1 Workspace discovery

`autoDetectProject(projectRoot, config)` will:

- read root dependencies;
- discover package directories declared by `pnpm-workspace.yaml` and supported `package.json#workspaces` patterns;
- ignore `node_modules`, build output, hidden directories, and package paths outside the project root;
- merge dependencies from discovered package manifests for framework and ORM detection;
- populate `ProjectMeta.packages` and source-directory metadata with project-relative, normalized paths;
- keep explicit `.codeomnivis.json` directory overrides authoritative.

Malformed or unreadable child manifests will produce a recoverable warning where the current API supports diagnostics; they will not invalidate other packages.

### 3.2 Canonical file collection

Analyzer will own a focused file-collection unit used by `runAnalysis`. It will collect:

- TypeScript, JavaScript, JSX/TSX, Kotlin, and Prisma inputs supported by existing parsers;
- configured frontend/backend directories;
- discovered workspace package source directories;
- explicit Prisma, tRPC, TSRPC, TypeORM, and build-file inputs;
- conventional single-project directories for backward compatibility.

Implicitly discovered paths must remain inside `projectRoot`. An explicit `.codeomnivis.json` directory may opt into a sibling directory, preserving the existing configuration contract. Results are normalized to forward-slash paths relative to `projectRoot`, deduplicated by real path to avoid symlink/overlap duplicates, and sorted for deterministic tests.

`serve`, server refresh, and other callers will use `runAnalysis` rather than reimplementing file selection. The `analyze` command may keep its output/reporting orchestration, but it must call the same exported collector or the same analysis primitive.

### 3.3 Analysis outcome semantics

The system will distinguish these outcomes:

- **Successful analysis:** at least one supported file was scanned and at least one graph node was created.
- **Unsupported or empty project:** zero supported files; return a typed/top-level analysis failure with an actionable message naming the project root and supported/configurable locations.
- **No graph produced:** files were scanned but no nodes were created; return a distinct failure explaining that inputs were found but no supported architecture elements were recognized.
- **Partial analysis:** nodes were created and one or more parsers emitted recoverable errors; keep the graph, report warning/error counts, and do not crash.

Consequences by entry point:

- `analyze` must not print `Analysis complete` for either empty condition.
- `check` must not print `No consistency issues found` when no valid graph exists.
- `serve` must not announce a successful/fresh analysis with an empty graph. If the server remains available for diagnostics, its status must remain not successfully analyzed rather than fresh.
- refresh must set `lastAnalyzedAt` and `fresh` only after a valid graph-producing analysis.

The richer frontend unavailable/not-analyzed presentation belongs to the third repair batch; this batch establishes correct server/CLI truth first.

### 3.4 Database lifecycle

A complete analysis replaces the previous graph only as part of a controlled full-snapshot run. Database handles created by the analysis function remain protected by `try/finally`; injected server-owned handles are never closed by Analyzer. Empty/failed runs must not leave a stale graph labeled as the new successful result.

## 4. Data Flow

```text
project root + config
        |
        v
workspace/project detection
        |
        v
ProjectMeta (packages + source dirs + frameworks)
        |
        v
canonical file collector
        |
        v
runAnalysis -> parsers -> graph builder -> cross-layer linker -> database
        |
        +--> valid graph: success/fresh
        +--> parser warnings with graph: partial success
        +--> zero files or zero nodes: explicit analysis failure/not fresh
```

## 5. Testing Strategy

All behavioral changes follow RED → GREEN → REFACTOR.

Required regression coverage:

1. A pnpm workspace fixture with sources only under `packages/*` discovers package dependencies and scans those source files.
2. Overlapping directories and symlinked directories yield each real source file once.
3. Implicit paths escaping the project root are rejected; an explicitly configured sibling directory remains supported and is tested separately.
4. `serve`, `analyze`, and refresh produce the same file set for the same `ProjectMeta`.
5. Zero supported files cannot produce a success result.
6. Supported files that create zero nodes cannot produce a fresh/success result.
7. Parser warnings with a non-empty graph remain recoverable.
8. `check` does not report a clean project when no valid analysis exists.
9. The repository itself and `demo/` are exercised as integration fixtures after unit tests.

## 6. Documentation

Update the development command to target the actual package name and pass CLI arguments correctly. The documented command must be executed during verification; a filter that matches no package is a failure even if pnpm exits successfully.

## 7. Acceptance Criteria

- Running the official serve workflow against `/Users/new/CodeOmniVis` scans source files beneath workspace packages and creates a non-empty graph.
- Framework/database detection is based on root plus discovered workspace manifests, not only `apps/web`.
- `analyze`, `serve`, `check`, and refresh cannot classify a zero-file or zero-node result as successful/fresh/clean.
- Conventional single-project and split `frontend/` + `backend/` fixtures continue to work.
- Focused tests, package tests, root typecheck, lint, and build pass.
- Browser/API verification shows non-empty graph data for the project and no contradictory successful status after an analysis failure.

## 8. Out of Scope

- Repairing `calls_api`, `calls_service`, and `queries_db` matching logic (second batch).
- Frontend unavailable/unknown states, per-view error copy, WebSocket backoff, i18n, Settings, and mobile drawer changes (third batch).
- Unrelated refactoring or overwriting existing uncommitted user changes.
