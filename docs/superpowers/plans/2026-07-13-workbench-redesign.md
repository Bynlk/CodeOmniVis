# CodeOmniVis Workbench Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dashboard-like UI with a restrained IDE workbench that offers four graph-driven views and progressive architecture disclosure.

**Architecture:** Keep React Query, the existing UI store, services, Cytoscape context, and REST contracts. Introduce a view-model layer that derives architecture/request/data graphs from `OmniGraph`; compose a new shell from a command bar, view rail, explorer, canvas header, inspector, and status bar. Quality becomes a dedicated non-graph canvas backed by current errors and stats services.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Cytoscape.js, React Query, Vitest.

---

### Task 1: View model and workbench state

**Files:**
- Create: `packages/ui/src/types/workbench.ts`
- Create: `packages/ui/src/lib/workbenchViews.ts`
- Modify: `packages/ui/src/store/uiStore.ts`
- Test: `packages/ui/__tests__/lib/workbenchViews.test.ts`

- [ ] Write failing tests proving each view keeps the correct node/edge families and architecture overview hides implementation-detail nodes.
- [ ] Run `pnpm --filter @codeomnivis/ui test -- --run __tests__/lib/workbenchViews.test.ts`; expect missing-module failure.
- [ ] Implement `WorkbenchView`, `ArchitectureDepth`, and `deriveWorkbenchGraph` with endpoint-safe edge filtering.
- [ ] Add `activeView` and `architectureDepth` actions to the UI store.
- [ ] Run the focused tests and UI typecheck; expect pass.

### Task 2: Stable workbench shell

**Files:**
- Create: `packages/ui/src/components/Workbench/WorkbenchShell.tsx`
- Create: `packages/ui/src/components/Workbench/ViewRail.tsx`
- Create: `packages/ui/src/components/Workbench/ExplorerPanel.tsx`
- Create: `packages/ui/src/components/Workbench/CanvasHeader.tsx`
- Create: `packages/ui/src/components/Workbench/StatusBar.tsx`
- Test: `packages/ui/__tests__/components/workbenchShell.test.tsx`

- [ ] Write failing SSR tests for five-region shell semantics, four view controls, no AI destination, and accessible labels.
- [ ] Run the focused test; expect missing-component failure.
- [ ] Implement the flat, compact shell and responsive rail/explorer behavior.
- [ ] Run focused tests and UI typecheck; expect pass.

### Task 3: Progressive graph canvas

**Files:**
- Modify: `packages/ui/src/components/GraphCanvas.tsx`
- Create: `packages/ui/src/components/Workbench/CanvasToolbar.tsx`
- Modify: `packages/ui/src/utils/cytoscapeConfig.ts`
- Test: `packages/ui/__tests__/components/canvasToolbar.test.tsx`

- [ ] Write failing tests for overview/full/focus controls and view-specific labels.
- [ ] Implement depth controls, view-specific empty states, double-click focus, and restrained Cytoscape styling.
- [ ] Verify keyboard behavior, viewport preservation, focused tests, and typecheck.

### Task 4: Quality canvas and contextual inspector

**Files:**
- Create: `packages/ui/src/components/Workbench/QualityCanvas.tsx`
- Modify: `packages/ui/src/components/NodeDetailPanel.tsx`
- Modify: `packages/ui/src/components/Legend.tsx`
- Test: `packages/ui/__tests__/components/qualityCanvas.test.tsx`

- [ ] Write failing tests for quality summary, severity grouping, empty state, and inspector sections.
- [ ] Implement a list-oriented quality surface without metric-card grids.
- [ ] Restyle the inspector and legend to match the workbench vocabulary.
- [ ] Run focused tests and typecheck.

### Task 5: App composition, copy, and states

**Files:**
- Modify: `packages/ui/src/App.tsx`
- Modify: `packages/ui/src/index.css`
- Modify: `packages/ui/tailwind.config.js`
- Modify: `packages/ui/src/locales/zh-CN.json`
- Modify: `packages/ui/src/locales/en-US.json`
- Modify: `packages/ui/src/components/ErrorBoundary.tsx`
- Test: `packages/ui/__tests__/components/workbenchApp.test.tsx`

- [ ] Write failing structure tests proving App uses the new workbench and omits the legacy tab bar and AI panel.
- [ ] Compose all views, move settings/project switching into the command bar, and add skeleton/empty/error states.
- [ ] Replace gradients, emoji navigation, decorative shadows, and glass surfaces with the DESIGN.md tokens.
- [ ] Run all UI tests, typecheck, lint, and build.

### Task 6: Read-only target validation and visual QA

**Files:**
- No files under `/Users/new/Desktop/ai-try-on/aitryon` may be created, modified, or deleted.

- [ ] Record a before snapshot of `git status --short` and filesystem metadata for the target repository.
- [ ] Analyze the target using CodeOmniVis with cache stored only under `~/.codeomnivis/projects`.
- [ ] Start the rebuilt UI locally, inspect desktop and narrow layouts, and capture screenshots outside the target repository.
- [ ] Confirm target `git status --short` is byte-for-byte unchanged.
- [ ] Run `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `git diff --check`.
