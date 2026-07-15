# README Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long bilingual root READMEs with compact GitHub landing pages that show a working command and truthful product evidence within the first screen.

**Architecture:** Treat `scripts/verifyReadme.mjs` as the executable public-content contract. Make that contract fail against the old layout, capture one new hero from the real bundled demo, then rewrite both READMEs to the same compact structure and finish with rendered desktop/narrow inspection.

**Tech Stack:** Markdown, Node.js ESM verification scripts, Vitest, pnpm, CodeOmniVis CLI/demo, GitHub-flavored Markdown, in-app browser automation

---

## File Structure

- Modify `scripts/verifyReadme.mjs` — enforce the compact anchor, badge, visual, trust, bilingual, and line-count contract.
- Modify `packages/cli/__tests__/docs/readmeContract.test.ts` — describe the compact landing-page contract.
- Create `docs/assets/readme/codeomnivis-workbench-focus.jpg` — truthful focused screenshot captured from the bundled demo.
- Modify `README.md` — compact English GitHub landing page.
- Modify `README.zh-CN.md` — structurally equivalent compact Chinese landing page.
- Modify `CHANGELOG.md` — replace the previous Unreleased README addition with the visual-refresh result.
- Modify `docs/plans/changelog.md` — record why the previous long-form layout was superseded.

### Task 1: Define the compact README contract and verify it fails

**Files:**

- Modify: `scripts/verifyReadme.mjs`
- Modify: `packages/cli/__tests__/docs/readmeContract.test.ts`

- [ ] **Step 1: Replace the old section and visual requirements**

Use these exact shared contracts in `scripts/verifyReadme.mjs`:

```javascript
const REQUIRED_SECTION_IDS = [
  'quick-start',
  'workflows',
  'how-it-works',
  'supported-stack',
  'mcp',
  'trust',
  'development',
  'contributing',
  'license',
]
const REQUIRED_ASSETS = [
  'docs/assets/readme/codeomnivis-workbench-focus.jpg',
  'docs/assets/readme/typescript-full-stack-architecture-graph.svg',
]
const REQUIRED_BADGE_ALT_TEXT = [
  'CI',
  'npm version',
  'Node.js >= 18',
  'License: PolyForm Noncommercial',
]
const FORBIDDEN_BADGE_ALT_TEXT = ['npm downloads', 'GitHub stars']
const MAX_README_LINES = 200
```

Keep the existing npm package URL, Quick Start command, local-link verification, bilingual-link verification, and `REQUIRED_ENGLISH_INTENT` phrases.

- [ ] **Step 2: Add compactness, forbidden-badge, and trust checks**

Add these checks without weakening existing local-link validation:

```javascript
function verifyCompactLanding(readmePath, markdown) {
  const lineCount = markdown.split(/\r?\n/u).length
  if (lineCount > MAX_README_LINES) {
    errors.push(
      `${readmePath}: exceeds compact landing limit (${lineCount}/${MAX_README_LINES} lines)`,
    )
  }
  for (const altText of REQUIRED_BADGE_ALT_TEXT) {
    if (!markdown.includes(`![${altText}](`)) {
      errors.push(`${readmePath}: missing stable badge alt text "${altText}"`)
    }
  }
  for (const altText of FORBIDDEN_BADGE_ALT_TEXT) {
    if (markdown.includes(`![${altText}](`)) {
      errors.push(`${readmePath}: forbidden unstable badge alt text "${altText}"`)
    }
  }
}
```

Call `verifyCompactLanding()` for both READMEs. Require the English README to contain `local-first`, `certain`, `inferred`, and `Commercial use requires`; require the Chinese README to contain `本地`, `certain`, `inferred`, and `商业用途需要`.

- [ ] **Step 3: Rename the contract test**

Change the Vitest description to:

```typescript
it('keeps the compact bilingual landing, trust claims, visuals, commands, and search intent aligned', () => {
```

- [ ] **Step 4: Run the new contract and verify red**

Run:

```bash
pnpm verify:readme
pnpm exec vitest run packages/cli/__tests__/docs/readmeContract.test.ts
```

Expected: both commands fail because the current READMEs exceed 200 lines, include forbidden badges, lack the `trust` anchor, and do not reference the new focused hero.

### Task 2: Capture a truthful focused product hero

**Files:**

- Create: `docs/assets/readme/codeomnivis-workbench-focus.jpg`

- [ ] **Step 1: Build the CLI and UI**

Run:

```bash
pnpm exec turbo run build --filter=@bynlk/codeomnivis
```

Expected: Turbo builds or restores the CLI, bundled UI, and all upstream workspace dependencies before the CLI bundle runs. Direct `pnpm --filter @bynlk/codeomnivis build` is intentionally not used because it bypasses Turbo's `^build` dependency graph in a clean worktree.

- [ ] **Step 2: Start the bundled demo in a persistent terminal session**

Run:

```bash
node packages/cli/bin/codeomnivis.js serve --project ./demo --no-open --port 4322
```

Expected: `/api/health` reports healthy and the workbench is available at `http://127.0.0.1:4322`. Port 4322 keeps the capture isolated from any existing default-port CodeOmniVis session.

- [ ] **Step 3: Prepare the real focus state in the browser**

Use a 1280×720 browser viewport. Open the local workbench, select `BookingList`, and activate the Focus view. Verify before capture:

- the canvas shows `BookingPage → BookingList → /api/booking`;
- the inspector shows `components/BookingList.tsx`;
- freshness is `Up to date`;
- no modal, tooltip, loading state, or browser chrome covers the workbench.

- [ ] **Step 4: Save the viewport screenshot**

Save the actual browser viewport bytes to:

```text
docs/assets/readme/codeomnivis-workbench-focus.jpg
```

Expected image properties: browser-native JPEG, 1280×720, no artificial callouts, no generated UI, no post-processing that changes product state.

- [ ] **Step 5: Stop the demo server**

Send Ctrl-C to the persistent terminal session and confirm port 4322 is no longer listening.

### Task 3: Rewrite the bilingual landing pages and turn the contract green

**Files:**

- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `scripts/verifyReadme.mjs`
- Modify: `packages/cli/__tests__/docs/readmeContract.test.ts`
- Create: `docs/assets/readme/codeomnivis-workbench-focus.jpg`

- [ ] **Step 1: Replace the English README with the approved order**

Use these exact section anchors and headings, in this order:

```markdown
<a id="quick-start"></a>

## Quick Start

<a id="workflows"></a>

## One graph, three workflows

<a id="how-it-works"></a>

## How it works

<a id="supported-stack"></a>

## Supported stack

<a id="mcp"></a>

## MCP setup

<a id="trust"></a>

## Trust and limitations

<a id="development"></a>

## Development

<a id="contributing"></a>

## Contributing

<a id="license"></a>

## License
```

The header must contain the 72px real logo, English/Chinese/docs/demo links before the hero, exactly four stable badges, and this visible command before the screenshot:

```bash
npx @bynlk/codeomnivis serve
```

Use the new focused JPEG once and the architecture SVG once. Keep every phrase in `REQUIRED_ENGLISH_INTENT` naturally present exactly where it helps the reader. Do not restore the downloads or stars badges.

The three workflow entries must cover:

1. map an unfamiliar repository in the workbench;
2. trace a page through components, APIs, services, and database models;
3. provide the same architecture graph to Cursor, Claude Code, and Cline through MCP.

The Trust section must explicitly state local-first processing, no source upload or telemetry, optional configured AI egress, `certain` versus `inferred` confidence, static-analysis limitations, experimental Kotlin coverage, and commercial-use permission requirements.

- [ ] **Step 2: Replace the Chinese README with the same structure**

Use these matching headings:

```markdown
## 快速开始

## 一张图谱，三种工作流

## 工作原理

## 支持范围

## MCP 配置

## 信任边界与限制

## 本地开发

## 参与贡献

## 许可证
```

Keep the same anchors, commands, badge alt text, image paths, support tiers, MCP JSON, and trust semantics. Use natural Chinese rather than literal sentence-by-sentence translation.

- [ ] **Step 3: Keep the compact support matrix**

Both READMEs must keep four evidence levels only:

- Demo-verified core path;
- parser and regression coverage;
- static test intelligence;
- experimental Kotlin/JVM ecosystem support.

Move workspace-discovery nuance into the Trust section and link detailed semantics to `docs/guides/test-intelligence.md`, `docs/api/rest-api.md`, and `docs/api/mcp-tools.md`.

- [ ] **Step 4: Format the changed text files**

Run:

```bash
pnpm exec prettier --write README.md README.zh-CN.md scripts/verifyReadme.mjs packages/cli/__tests__/docs/readmeContract.test.ts
```

- [ ] **Step 5: Run the focused contract and verify green**

Run:

```bash
pnpm verify:readme
pnpm exec vitest run packages/cli/__tests__/docs/readmeContract.test.ts
```

Expected: README verification passes and the single Vitest contract passes.

- [ ] **Step 6: Commit the compact bilingual landing**

```bash
git add README.md README.zh-CN.md docs/assets/readme/codeomnivis-workbench-focus.jpg \
  scripts/verifyReadme.mjs packages/cli/__tests__/docs/readmeContract.test.ts
git commit -m "docs(docs): focus the bilingual README landing"
```

### Task 4: Record the redesign and perform final rendered verification

**Files:**

- Modify: `CHANGELOG.md`
- Modify: `docs/plans/changelog.md`

- [ ] **Step 1: Reconcile the Unreleased changelog entry**

Replace the old Added bullet that promises a downloads badge and long FAQ with a Changed bullet stating that the bilingual landing now prioritizes Quick Start, stable trust badges, a focused real-demo hero, compact evidence, MCP setup, and documentation links.

- [ ] **Step 2: Record the plan change reason**

Add a 2026-07-15 row to `docs/plans/changelog.md` explaining that live GitHub inspection found a broken downloads badge, a Quick Start below the first viewport, unreadable scaled screenshots, and a 9,881px documentation-heavy landing page.

- [ ] **Step 3: Format and run all relevant checks**

Run:

```bash
pnpm exec prettier --write CHANGELOG.md docs/plans/changelog.md
pnpm format:check
pnpm verify:readme
pnpm exec vitest run packages/cli/__tests__/docs/readmeContract.test.ts
git diff --check
```

Expected: every command exits 0 with no formatting, contract, or whitespace failures.

- [ ] **Step 4: Render the final Markdown at desktop and narrow widths**

Render both README files through GitHub's `POST /markdown` API without publishing them, pass the returned HTML to temporary in-app-browser data URLs, and inspect at 1280×900 and 760×900 viewport sizes. Do not write the rendered HTML into the repository. Verify:

- Quick Start is visible before the hero;
- the badge row contains no red or wrapped unstable badge;
- the focused screenshot remains understandable;
- tables do not overflow horizontally;
- language and documentation links remain above the visual;
- English and Chinese section order matches;
- no local link or image is broken.

- [ ] **Step 5: Commit the project record**

```bash
git add CHANGELOG.md docs/plans/changelog.md
git commit -m "docs(docs): record README visual refresh"
```

- [ ] **Step 6: Run final branch verification**

Run:

```bash
pnpm format:check
pnpm verify:readme
pnpm exec vitest run packages/cli/__tests__/docs/readmeContract.test.ts
git diff --check
git status --short --branch
```

Expected: all checks pass and the tracked worktree is clean on `codex/readme-visual-refresh`.
