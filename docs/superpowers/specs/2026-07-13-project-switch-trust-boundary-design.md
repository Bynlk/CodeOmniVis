# Project Switch Trust Boundary Design

## Problem

The Settings drawer asks for an absolute path and labels the action “Switch project”. The Server currently resolves every target against the project used to start the process and rejects any sibling or unrelated absolute directory as `PATH_TRAVERSAL`.

That boundary is appropriate for a remotely reachable Server, but it makes the primary local CLI workflow unable to switch projects as advertised.

The binding-aware path policy fixes authorization, but a real `demo -> repository root` switch exposed a second failure. `IncrementalAnalyzer` keeps the `ProjectMeta` detected at process startup, changes only `projectRoot`, clears the active graph, and then analyzes the new directory with stale metadata. A monorepo root therefore reports `NO_SUPPORTED_FILES`; the public project root remains the old value while the analyzer may point at the new root and the previous graph has already been erased.

## Decision

Project-root authorization depends on the Server binding:

- Loopback binding (`localhost`, `127.x`, or `::1`): accept any existing absolute directory.
- Non-loopback binding: retain the configured startup project as the boundary and require the existing mutation token.
- Relative input on any binding: resolve only within the startup boundary.

All targets still must be existing directories. A switch is also an atomic state transition: detect metadata before destructive work, analyze with the target root and target metadata, and publish the new root only after analysis succeeds. If detection or analysis fails, the old root, metadata, graph, parse errors, freshness state, and watcher remain usable.

## Alternatives

1. **Binding-aware trust boundary — selected.** Matches the local CLI product promise while preserving the current remote security boundary.
2. **Keep the boundary and rename the UI to “Switch subproject”.** Safest, but materially weaker than the intended multi-project local workbench.
3. **Require an explicit path allowlist.** Strong and configurable, but adds setup to the zero-configuration local workflow and is unnecessary when the process is loopback-only.

## Resolution Rules

The Server uses a focused resolver with inputs `startupRoot`, `requestedRoot`, and `allowArbitraryAbsolute`:

1. Trim and validate the request before resolution.
2. If the request is absolute and arbitrary absolute roots are allowed, normalize it directly.
3. Otherwise, call the existing symlink-aware `resolveWithinBoundary` guard.
4. Reject a failed boundary check with `PATH_TRAVERSAL`.
5. Reject a missing or non-directory target with `INVALID_PROJECT_ROOT`.

`allowArbitraryAbsolute` is true only when `isLoopbackHost(host)` is true. It is derived from the configured bind host, not from request headers.

## Metadata Detection Boundary

The Server package must not import CLI internals because the package dependency direction is `server <- cli`. `ServerOptions` therefore accepts an optional asynchronous `detectProjectMeta(root)` dependency. The CLI injects its complete `autoDetectProject(root, loadConfig(root))` implementation; route tests inject deterministic metadata without scanning a real repository.

When the dependency is omitted, the analyzer clears the previous metadata for a different root and lets `runAnalysis` use its own fallback detection. It must never reuse metadata belonging to the previous project.

Metadata detection runs after path authorization and directory validation but before stopping the old watcher or mutating graph state. A detection failure returns an analysis error and leaves every active-project surface unchanged.

## Atomic Switch Lifecycle

Before switching, `IncrementalAnalyzer` snapshots the active root, `ProjectMeta`, graph, parse errors, freshness fields, and pending-change fields. It serializes with any in-flight analysis, stops the old watcher, installs the target root and metadata, starts the target watcher, and performs a manual analysis.

On success, the new graph is already stored and the caller may update `app.locals.projectRoot`. On failure, the analyzer stops the target watcher, restores the old graph and parse errors, restores all root/metadata/freshness fields, restarts the old watcher, broadcasts the restored status, and rethrows the original analysis error. `app.locals.projectRoot` is updated only after this completes successfully.

The rollback is not an instruction to hide parser warnings. Recoverable parser failures remain Quality findings; rollback applies only when the top-level analysis cannot produce a valid graph.

## Security Invariants

- Non-loopback project switching still requires a valid token.
- Non-loopback absolute paths outside the startup boundary remain rejected.
- Boundary-internal symlinks escaping the startup root remain rejected remotely.
- Relative `../` escape attempts remain rejected in all modes.
- The client cannot opt into local trust with a request field or header.
- Metadata detection never runs for an unauthorized or nonexistent target.
- A failed switch never changes the effective source-link root or watcher root.

## Acceptance Criteria

1. A loopback Server can switch from one temporary project root to an existing sibling absolute directory.
2. A non-loopback Server with a valid token still rejects that sibling with `PATH_TRAVERSAL`.
3. A non-loopback Server accepts a legitimate startup-root subdirectory.
4. Relative escape and boundary-symlink tests remain green.
5. After a real local switch, `GET /api/project`, graph data, Quality issues, freshness, and source links all use the new root.
6. The target `ProjectMeta` passed to analysis has the target root and discovered workspace packages; startup metadata is not reused.
7. If metadata detection fails, `GET /api/project`, analyzer root, graph, parse errors, freshness, and watcher remain on the original project.
8. If target analysis fails after clearing or partially writing graph data, the same original-project state is restored and the route returns an error.
9. A successful `demo -> repository root -> demo` round trip produces non-empty graphs on both projects and correct Quality/source-link roots.
10. Full tests, typecheck, lint, build, browser, and console verification pass.
