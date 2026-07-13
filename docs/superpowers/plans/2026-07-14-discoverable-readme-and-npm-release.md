# Discoverable README and npm Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an English-first, bilingual, visually credible and search-discoverable GitHub README backed by a publicly packable `@bynlk/codeomnivis` CLI.

**Architecture:** Keep the existing self-contained tsup package boundary, normalize and verify its public metadata, and add repository-level documentation/package verifiers. Use the running demo as the authoritative raster screenshot source and hand-authored SVG only for explanatory diagrams. Keep English and Chinese READMEs structurally equivalent while allowing natural localized prose.

**Tech Stack:** Markdown, SVG, Node.js ESM verification scripts, Vitest, npm pack, pnpm/Turborepo, React/Vite demo UI

---

## File Structure

- Modify `packages/cli/package.json` — canonical public npm identity and package metadata.
- Modify `package.json` — repository verification commands.
- Create `scripts/verifyReadme.mjs` — deterministic relative-link, asset, heading, keyword, and bilingual-contract checks.
- Create `scripts/verifyPackedCli.mjs` — build, pack, isolated install, CLI help, bundled UI, and demo-analysis smoke checks.
- Create `packages/cli/__tests__/packageMetadata.test.ts` — regression contract for public package metadata.
- Create `packages/cli/__tests__/docs/readmeContract.test.ts` — executes the README verifier from Vitest.
- Create `packages/cli/__tests__/integration/packedCli.test.ts` — checks dry-run tarball contents without publishing.
- Replace `README.md` — canonical English product-first README.
- Create `README.zh-CN.md` — structurally equivalent Chinese README.
- Delete `README.en.md` — obsolete English mirror.
- Create `docs/assets/readme/codeomnivis-workbench-hero.png` — real demo workbench capture.
- Create `docs/assets/readme/code-quality-findings.png` — real demo Quality view capture.
- Create `docs/assets/readme/typescript-full-stack-architecture-graph.svg` — explanatory cross-layer graph.
- Create `docs/assets/readme/mcp-ai-codebase-context.svg` — explanatory MCP query flow.
- Delete `docs/assets/readme/og-cover.png`, `docs/assets/readme/repo-to-graph.png`, and `docs/assets/readme/mcp-query-card.png` — obsolete visual identity.
- Update `AGENTS.md`, `CHANGELOG.md`, `DELIVERY_REPORT.md`, and current non-archival documentation references where the mixed-case npm package name would instruct users to run an invalid public command.

### Task 1: Lock the public package metadata contract

**Files:**
- Create: `packages/cli/__tests__/packageMetadata.test.ts`
- Modify: `packages/cli/package.json`
- Modify: `AGENTS.md`

- [ ] **Step 1: Write the failing metadata test**

Create a Vitest suite that reads `packages/cli/package.json` and asserts:

```typescript
expect(pkg.name).toBe('@bynlk/codeomnivis')
expect(pkg.description).toContain('TypeScript')
expect(pkg.engines).toEqual({ node: '>=18.0.0' })
expect(pkg.bugs).toEqual({ url: 'https://github.com/Bynlk/CodeOmniVis/issues' })
expect(pkg.publishConfig).toEqual({
  access: 'public',
  registry: 'https://registry.npmjs.org',
})
expect(pkg.files).toEqual(expect.arrayContaining(['dist', 'bin', 'README.md', 'LICENSE']))
expect(pkg.keywords).toEqual(
  expect.arrayContaining([
    'typescript',
    'architecture-visualization',
    'nextjs',
    'react',
    'prisma',
    'mcp',
  ]),
)
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @bynlk/CodeOmniVis test -- packageMetadata.test.ts
```

Expected: FAIL because the manifest still uses mixed-case `@bynlk/CodeOmniVis` and lacks the release fields.

- [ ] **Step 3: Normalize and complete the manifest**

Update the CLI manifest to:

```json
{
  "name": "@bynlk/codeomnivis",
  "description": "Zero-config TypeScript full-stack architecture visualizer with a local workbench and MCP server for AI coding agents",
  "bugs": { "url": "https://github.com/Bynlk/CodeOmniVis/issues" },
  "engines": { "node": ">=18.0.0" },
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org"
  },
  "files": ["dist", "bin", "README.md", "LICENSE"]
}
```

Add focused search keywords and preserve the existing `repository`, `homepage`, `bin`, runtime dependencies, and scripts. Update the active CLI filter example in `AGENTS.md` to lowercase.

- [ ] **Step 4: Run the focused test and workspace package lookup**

Run:

```bash
pnpm --filter @bynlk/codeomnivis test -- packageMetadata.test.ts
pnpm --filter @bynlk/codeomnivis build
```

Expected: PASS; pnpm resolves the lowercase package name and tsup produces `dist/index.js`, `dist/ui`, and `dist/wasm`.

- [ ] **Step 5: Commit the package identity**

```bash
git add packages/cli/package.json packages/cli/__tests__/packageMetadata.test.ts AGENTS.md
git commit -m "chore(cli): prepare public npm package metadata"
```

### Task 2: Add deterministic README verification

**Files:**
- Create: `scripts/verifyReadme.mjs`
- Create: `packages/cli/__tests__/docs/readmeContract.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing README contract test**

The Vitest test spawns the verifier from the repository root:

```typescript
const result = spawnSync(process.execPath, ['scripts/verifyReadme.mjs'], {
  cwd: repoRoot,
  encoding: 'utf8',
})

expect(result.status, result.stderr || result.stdout).toBe(0)
```

- [ ] **Step 2: Implement the verifier against the approved contract**

`scripts/verifyReadme.mjs` must:

1. read `README.md` and `README.zh-CN.md`;
2. fail if either file is missing;
3. extract relative Markdown links and image sources, ignoring `http:`, `https:`, and anchors;
4. resolve URI fragments and verify every local target exists;
5. require both language links;
6. require the same canonical section IDs through explicit HTML anchors;
7. require `npx @bynlk/codeomnivis serve` in both files;
8. require the four approved asset paths in both files;
9. require the English intent phrases from the design spec in relevant prose;
10. print `README verification passed` on success and actionable path-specific messages on failure.

Use a fixed `REQUIRED_SECTION_IDS` array rather than attempting to infer equivalence from translated headings.

- [ ] **Step 3: Add the root command**

Add:

```json
"verify:readme": "node scripts/verifyReadme.mjs"
```

- [ ] **Step 4: Run the focused test and verify the current docs fail**

Run:

```bash
pnpm --filter @bynlk/codeomnivis test -- readmeContract.test.ts
```

Expected: FAIL because `README.zh-CN.md` and the new visual assets do not exist yet.

- [ ] **Step 5: Commit the verification harness**

```bash
git add package.json scripts/verifyReadme.mjs packages/cli/__tests__/docs/readmeContract.test.ts
git commit -m "test(docs): add bilingual README contract"
```

### Task 3: Create the truthful visual assets

**Files:**
- Create: `docs/assets/readme/codeomnivis-workbench-hero.png`
- Create: `docs/assets/readme/code-quality-findings.png`
- Create: `docs/assets/readme/typescript-full-stack-architecture-graph.svg`
- Create: `docs/assets/readme/mcp-ai-codebase-context.svg`
- Delete: `docs/assets/readme/og-cover.png`
- Delete: `docs/assets/readme/repo-to-graph.png`
- Delete: `docs/assets/readme/mcp-query-card.png`

- [ ] **Step 1: Start the current demo and record its URL**

Run:

```bash
pnpm --filter @bynlk/codeomnivis dev serve --project ./demo --no-open
```

Expected: the CLI prints a loopback Web URL and completes the initial demo analysis.

- [ ] **Step 2: Capture the real architecture workbench**

Open the demo URL at a 1440×900 viewport, select the Architecture view, fit the graph, close temporary overlays, and save a full workbench screenshot to `codeomnivis-workbench-hero.png`. Confirm the COV mark, explorer, graph, inspector/status context, and dark restrained styling are visible.

- [ ] **Step 3: Capture the real Quality view**

Select Quality, retain a representative finding selection, and save a screenshot to `code-quality-findings.png`. Confirm severity, source location, deterministic description, and the Quality explorer are legible.

- [ ] **Step 4: Create the cross-layer SVG**

Create a 1600×760 SVG with a fixed `#090b0f` background, neutral panels, blue selection accent, and three explicit layers:

```text
Next.js pages + React components → API routes + services → Prisma models
                              ↓
                  shared architecture graph
                              ↓
                 Web UI · CLI/REST · MCP
```

Use only SVG primitives and text, no gradients, external fonts, scripts, or embedded raster data.

- [ ] **Step 5: Create the MCP SVG**

Create a 1600×760 SVG showing Cursor / Claude Code / Cline as clients, the CodeOmniVis MCP server, representative `find_callers`, `get_dataflow`, and `get_component_tree` queries, and the shared local graph. Keep arrows directional and label the boundary as local-only architecture context.

- [ ] **Step 6: Validate and replace assets**

Run:

```bash
file docs/assets/readme/codeomnivis-workbench-hero.png \
  docs/assets/readme/code-quality-findings.png \
  docs/assets/readme/typescript-full-stack-architecture-graph.svg \
  docs/assets/readme/mcp-ai-codebase-context.svg
```

Expected: two PNG images and two valid SVG XML documents. Remove the three obsolete white/turquoise PNGs.

- [ ] **Step 7: Commit the visual system**

```bash
git add docs/assets/readme
git commit -m "docs(docs): replace README visuals with product evidence"
```

### Task 4: Write the English canonical README and Chinese mirror

**Files:**
- Modify: `README.md`
- Create: `README.zh-CN.md`
- Delete: `README.en.md`
- Modify: `CHANGELOG.md`
- Modify: `DELIVERY_REPORT.md`

- [ ] **Step 1: Replace the English root README**

Write the approved product-first sequence with explicit shared anchors:

```html
<a id="why-codeomnivis"></a>
<a id="workflows"></a>
<a id="how-it-works"></a>
<a id="product-evidence"></a>
<a id="supported-stack"></a>
<a id="cli"></a>
<a id="mcp"></a>
<a id="api"></a>
<a id="limitations"></a>
<a id="development"></a>
<a id="roadmap"></a>
<a id="contributing"></a>
<a id="license"></a>
```

Keep `npx @bynlk/codeomnivis serve` above the problem statement. Use precise claims derived from current parsers, routes, commands, and tests. Link detailed contracts instead of copying them.

- [ ] **Step 2: Write the complete Chinese mirror**

Mirror all anchors, commands, tables, image paths, and capability/limitation facts. Translate prose naturally and link the language switch back to `README.md`.

- [ ] **Step 3: Update active package-name references**

Update current user-facing or release documentation that teaches the mixed-case package command. Preserve archived historical records unless they are linked from the new README as current instructions.

- [ ] **Step 4: Remove the obsolete mirror and run the contract**

Delete `README.en.md`, then run:

```bash
pnpm verify:readme
pnpm --filter @bynlk/codeomnivis test -- readmeContract.test.ts
```

Expected: PASS with all links, anchors, assets, commands, and required English intent phrases present.

- [ ] **Step 5: Commit the bilingual README**

```bash
git add README.md README.zh-CN.md README.en.md CHANGELOG.md DELIVERY_REPORT.md
git commit -m "docs(docs): launch searchable bilingual README"
```

### Task 5: Verify the packed CLI outside the monorepo

**Files:**
- Create: `scripts/verifyPackedCli.mjs`
- Create: `packages/cli/__tests__/integration/packedCli.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing dry-run package test**

Build the CLI and spawn:

```typescript
npm pack --dry-run --json --registry=https://registry.npmjs.org
```

Assert the JSON contains `bin/codeomnivis.js`, `dist/index.js`, at least one `dist/ui/assets/` file, `dist/wasm/tree-sitter-kotlin.wasm`, `README.md`, and `LICENSE`; assert no `src/`, `__tests__/`, `.planning/`, or `.superpowers/` entries.

- [ ] **Step 2: Run the focused test and verify the missing package docs fail**

Run:

```bash
pnpm --filter @bynlk/codeomnivis test -- packedCli.test.ts
```

Expected: FAIL until package-level README and license staging are added to the package build or pack preparation.

- [ ] **Step 3: Implement the isolated pack verifier**

`scripts/verifyPackedCli.mjs` must:

1. create a temporary directory with `mkdtemp`;
2. build the workspace;
3. copy the root README and LICENSE into `packages/cli` for the package boundary when necessary;
4. run `npm pack --json --registry=https://registry.npmjs.org` in `packages/cli`;
5. create an isolated consumer `package.json`;
6. install the tarball with the official registry;
7. run `npx --no-install codeomnivis --help`;
8. start `codeomnivis serve --project <repo>/demo --host 127.0.0.1 --port 0 --no-open`;
9. wait for the printed URL, request `/api/health` and `/`, and confirm the bundled UI responds;
10. stop the child process in `finally` and delete temporary files;
11. print `Packed CLI verification passed` on success.

All child-process failures must include the failed command and captured stderr without leaking environment variables.

- [ ] **Step 4: Add root release verification command**

Add:

```json
"verify:package": "node scripts/verifyPackedCli.mjs"
```

- [ ] **Step 5: Run package checks**

Run:

```bash
pnpm --filter @bynlk/codeomnivis test -- packedCli.test.ts
pnpm verify:package
```

Expected: PASS; the CLI is installed and serves its bundled UI from outside the monorepo.

- [ ] **Step 6: Commit the release verifier**

```bash
git add package.json scripts/verifyPackedCli.mjs packages/cli/__tests__/integration/packedCli.test.ts packages/cli/README.md packages/cli/LICENSE
git commit -m "test(cli): verify packed CLI in isolation"
```

### Task 6: Run completion audit and full verification

**Files:**
- Modify: `docs/plans/changelog.md`

- [ ] **Step 1: Audit the design acceptance criteria**

Check every criterion in `docs/superpowers/specs/2026-07-14-discoverable-readme-and-npm-release-design.md` against files and command output. Record the README and npm release preparation in `docs/plans/changelog.md` without claiming a public npm publish occurred.

- [ ] **Step 2: Run documentation and package verification**

```bash
pnpm verify:readme
pnpm verify:package
```

Expected: both scripts print their success messages.

- [ ] **Step 3: Run the full repository gates**

```bash
pnpm exec turbo test --force
pnpm exec turbo typecheck --force
pnpm exec turbo lint --force
pnpm exec turbo build --force
git diff --check
```

Expected: every task succeeds with no whitespace errors.

- [ ] **Step 4: Inspect the final Git and package state**

```bash
git status --short --branch
git diff --stat origin/master...HEAD
npm pack --dry-run --json --registry=https://registry.npmjs.org
```

Expected: only intentional source, documentation, test, and asset changes; no tarball, database, build output, or local agent directories are staged.

- [ ] **Step 5: Commit the audit record**

```bash
git add docs/plans/changelog.md
git commit -m "docs(docs): record README release verification"
```

The public `npm publish` command is deliberately not part of this plan. Present the verified package name, version, official registry, authenticated npm identity, tarball file list, and proposed release notes to the user before requesting separate publication approval.
