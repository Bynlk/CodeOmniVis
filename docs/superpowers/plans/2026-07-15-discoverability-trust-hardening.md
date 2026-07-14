# Discoverability and Trust Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two reproducible trust defects from the July 15 review, strengthen the bilingual GitHub landing experience and repository automation, and merge the verified result to GitHub without publishing a new npm version.

**Architecture:** Keep `analyzeProject()` and the existing bilingual README/visual system intact. Add one shared address-normalization policy, one analyzer source-path policy before production parser dispatch, and repository-only documentation/automation changes. Verify locally first, then use a branch/PR/CI/merge flow before updating GitHub About metadata.

**Tech Stack:** TypeScript, Vitest, Node.js ESM verification scripts, Markdown, GitHub Actions, Dependabot, CodeQL, GitHub CLI, pnpm/Turborepo

---

## File Structure

- Modify `packages/shared/src/types/ai.ts` — decode IPv4-mapped IPv6 hosts and expose the shared loopback predicate.
- Modify `packages/shared/src/index.ts` — export the shared loopback predicate.
- Modify `packages/shared/__tests__/types/ai.test.ts` — mapped-address URL and DNS regression coverage.
- Modify `packages/server/src/aiRequestPolicy.ts` — reuse the shared predicate for remote loopback policy.
- Modify `packages/server/__tests__/ai/requestPolicy.test.ts` — remote-mode mapped-loopback rejection.
- Create `packages/analyzer/src/graph/sourcePathPolicy.ts` — classify test-only source paths.
- Create `packages/analyzer/__tests__/graph/sourcePathPolicy.test.ts` — normal, test, fixture, and boundary path coverage.
- Modify `packages/analyzer/src/graph/builder.ts` — skip production parser dispatch for test-only sources.
- Modify `packages/analyzer/__tests__/graph/builder.test.ts` — prove parser dispatch is skipped without changing test intelligence.
- Modify `scripts/verifyChangedFormatting.mjs` and `scripts/verifyChangedFormatting.test.mjs` — include changed Markdown in the incremental formatting gate.
- Modify `scripts/verifyReadme.mjs` and `packages/cli/__tests__/docs/readmeContract.test.ts` — protect FAQ and npm package links.
- Modify `README.md` and `README.zh-CN.md` — npm badges, explicit Quick Start, first-minute outcomes, and FAQ.
- Modify `SECURITY.md`, `docs/project-directory.md`, `docs/ENGINEERING_PLAN.md`, and `docs/plans/PROJECT_STATUS.md` — correct current facts and mark historical snapshots.
- Modify `CHANGELOG.md`, `docs/plans/changelog.md`, and `docs/README.md` — record and index the hardening work.
- Create `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/feature_request.yml`, and `.github/ISSUE_TEMPLATE/config.yml` — structured contribution intake.
- Delete `.github/ISSUE_TEMPLATE/bug_report.md` and `.github/ISSUE_TEMPLATE/feature_request.md` — remove duplicate legacy templates.
- Create `.github/CODEOWNERS`, `.github/dependabot.yml`, and `.github/workflows/codeql.yml` — ownership, dependency updates, and CodeQL.
- Modify `.github/workflows/ci.yml` — Node 22/24 and Windows compatibility job.
- Create `docs/reports/2026-07-15-quality-reassessment.md` — final 100-point evidence and limitations, excluding Codex Security scan results.

### Task 1: Close IPv4-mapped IPv6 AI destination bypasses

**Files:**

- Modify: `packages/shared/__tests__/types/ai.test.ts`
- Modify: `packages/server/__tests__/ai/requestPolicy.test.ts`
- Modify: `packages/shared/src/types/ai.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/server/src/aiRequestPolicy.ts`

- [ ] **Step 1: Add failing shared URL and DNS tests**

Add mapped private cases and one mapped public control:

```typescript
expect(validateUpstreamBaseUrl('https://[::ffff:127.0.0.1]/v1').ok).toBe(false)
expect(validateUpstreamBaseUrl('https://[::ffff:a00:1]/v1').ok).toBe(false)
expect(validateUpstreamBaseUrl('https://[::ffff:a9fe:a9fe]/v1').ok).toBe(false)
expect(validateUpstreamBaseUrl('https://[::ffff:5db8:d822]/v1').ok).toBe(true)
expect(validateResolvedAddresses(['::ffff:127.0.0.1']).ok).toBe(false)
```

- [ ] **Step 2: Add the failing server policy test**

```typescript
await expect(
  resolveUpstreamDestination('https://[::ffff:127.0.0.1]/v1', async () => [], false),
).rejects.toMatchObject({ code: 'AI_DESTINATION_REJECTED', status: 400 })
```

- [ ] **Step 3: Run focused tests and verify red**

Run:

```bash
pnpm --filter @codeomnivis/shared test -- ai.test.ts
pnpm --filter @codeomnivis/server test -- requestPolicy.test.ts
```

Expected: at least the mapped private/loopback assertions fail because the current policy accepts them.

- [ ] **Step 4: Implement pure mapped-address normalization**

In `packages/shared/src/types/ai.ts`, decode dotted and two-hextet IPv4-mapped tails to an IPv4 string. Export a named loopback predicate and call it from both `isBlockedHost()` and `validateResolvedAddresses()`. Preserve mapped public addresses.

In `packages/server/src/aiRequestPolicy.ts`, replace the private loopback regex with the exported shared predicate so `allowLoopback: false` handles mapped loopback consistently.

- [ ] **Step 5: Run focused tests and verify green**

Run the two focused commands from Step 3.

Expected: all shared AI and server request-policy tests pass.

- [ ] **Step 6: Commit the boundary fix**

```bash
git add packages/shared/src/types/ai.ts packages/shared/src/index.ts \
  packages/shared/__tests__/types/ai.test.ts packages/server/src/aiRequestPolicy.ts \
  packages/server/__tests__/ai/requestPolicy.test.ts
git commit -m "fix(server): reject mapped private AI destinations"
```

### Task 2: Keep test fixtures out of the production graph

**Files:**

- Create: `packages/analyzer/src/graph/sourcePathPolicy.ts`
- Create: `packages/analyzer/__tests__/graph/sourcePathPolicy.test.ts`
- Modify: `packages/analyzer/src/graph/builder.ts`
- Modify: `packages/analyzer/__tests__/graph/builder.test.ts`

- [ ] **Step 1: Write source-path classification tests**

Cover these exact expectations:

```typescript
expect(isTestSourcePath('src/app/page.tsx')).toBe(false)
expect(isTestSourcePath('src/widget.test.tsx')).toBe(true)
expect(isTestSourcePath('src/widget.spec.ts')).toBe(true)
expect(isTestSourcePath('packages/a/__tests__/fixtures/app/route.ts')).toBe(true)
expect(isTestSourcePath('e2e/workbench.spec.ts')).toBe(true)
expect(isTestSourcePath('src/contest/page.tsx')).toBe(false)
```

- [ ] **Step 2: Write a failing GraphBuilder dispatch test**

Register a parser whose `canHandle` and `parse` increment counters, call `parseFiles()` with an `__tests__/fixtures` path, and assert both counters remain zero and the graph stays empty.

- [ ] **Step 3: Run focused tests and verify red**

```bash
pnpm --filter @codeomnivis/analyzer test -- sourcePathPolicy.test.ts builder.test.ts
```

Expected: the new module is missing and the current builder dispatches the parser.

- [ ] **Step 4: Implement the source-path policy and pre-dispatch guard**

Create `isTestSourcePath(filePath: string): boolean` using normalized path segments plus `.test.`, `.spec.`, `.cy.`, `__tests__`, and top-level/segment `e2e` rules. In `GraphBuilder.parseFiles()`, continue to the next file before production parser dispatch when the policy returns true.

Do not remove test directories from `collectAnalysisFiles()`; `analyzeProject()` must still pass them to `discoverTests()`.

- [ ] **Step 5: Run focused and test-intelligence tests**

```bash
pnpm --filter @codeomnivis/analyzer test -- sourcePathPolicy.test.ts builder.test.ts testDiscovery.test.ts
pnpm test:contracts
```

Expected: production dispatch exclusion and cross-entry test intelligence both pass.

- [ ] **Step 6: Verify the repository no longer reports fixture criticals**

Build analyzer and run an in-memory self-analysis. Assert no critical issue location contains `/__tests__/fixtures/`.

- [ ] **Step 7: Commit the graph signal fix**

```bash
git add packages/analyzer/src/graph/sourcePathPolicy.ts \
  packages/analyzer/src/graph/builder.ts \
  packages/analyzer/__tests__/graph/sourcePathPolicy.test.ts \
  packages/analyzer/__tests__/graph/builder.test.ts
git commit -m "fix(analyzer): exclude test fixtures from production graph"
```

### Task 3: Strengthen the bilingual landing and trust documentation

**Files:**

- Modify: `scripts/verifyChangedFormatting.test.mjs`
- Modify: `scripts/verifyChangedFormatting.mjs`
- Modify: `scripts/verifyReadme.mjs`
- Modify: `packages/cli/__tests__/docs/readmeContract.test.ts`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `SECURITY.md`
- Modify: `docs/project-directory.md`
- Modify: `docs/ENGINEERING_PLAN.md`
- Modify: `docs/plans/PROJECT_STATUS.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/plans/changelog.md`

- [ ] **Step 1: Make the formatting and README contract tests fail**

Change the formatting test to expect Markdown to be formattable. Extend `REQUIRED_SECTION_IDS` with `faq`, require `https://www.npmjs.com/package/@bynlk/codeomnivis`, and require the npm badge alt text in both READMEs.

- [ ] **Step 2: Run the contracts and verify red**

```bash
pnpm test:format
pnpm verify:readme
```

Expected: Markdown formatting selection and missing README FAQ/npm evidence fail.

- [ ] **Step 3: Extend the incremental format gate**

Add `.md` to `FORMATTABLE_EXTENSIONS`. Preserve all existing generated/cache/user-directory exclusions and the lockfile exclusion.

- [ ] **Step 4: Update both READMEs without replacing truthful assets**

Add npm version/download badges, `<a id="quick-start"></a>`, a Quick Start heading, a compact first-minute outcome table, and `<a id="faq"></a>` with five equivalent FAQ answers. Keep the existing four visual asset paths and current support matrix.

- [ ] **Step 5: Correct trust documentation**

Update `SECURITY.md` to `0.1.x`, document optional configured AI egress, and retain the no-telemetry/no-source-modification statements. Correct the current license comment in `docs/project-directory.md`; add historical banners to the two old status/engineering snapshots; record changes in both changelogs.

- [ ] **Step 6: Format touched files and run contracts**

```bash
pnpm exec prettier --write README.md README.zh-CN.md SECURITY.md \
  docs/project-directory.md docs/ENGINEERING_PLAN.md docs/plans/PROJECT_STATUS.md \
  CHANGELOG.md docs/plans/changelog.md scripts/verifyChangedFormatting.mjs \
  scripts/verifyChangedFormatting.test.mjs scripts/verifyReadme.mjs \
  packages/cli/__tests__/docs/readmeContract.test.ts
pnpm test:format
pnpm verify:readme
pnpm --filter @bynlk/codeomnivis test -- readmeContract.test.ts
```

Expected: all formatting and README contracts pass.

- [ ] **Step 7: Commit documentation and discoverability content**

```bash
git add README.md README.zh-CN.md SECURITY.md CHANGELOG.md docs \
  scripts/verifyChangedFormatting.mjs scripts/verifyChangedFormatting.test.mjs \
  scripts/verifyReadme.mjs packages/cli/__tests__/docs/readmeContract.test.ts
git commit -m "docs(docs): strengthen searchable project landing"
```

### Task 4: Add durable GitHub repository automation

**Files:**

- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Delete: `.github/ISSUE_TEMPLATE/bug_report.md`
- Delete: `.github/ISSUE_TEMPLATE/feature_request.md`
- Create: `.github/CODEOWNERS`
- Create: `.github/dependabot.yml`
- Create: `.github/workflows/codeql.yml`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add structured issue forms and routing**

Require version, OS, Node version, project stack, reproduction, expected behavior, logs, and confirmation that secrets were removed for bugs. Require problem, proposed outcome, alternatives, and scope for features. Route security reports to private advisories and questions to Discussions.

- [ ] **Step 2: Add ownership and grouped updates**

Set `@Bynlk` as the default owner and explicit owner for workflows, package metadata, release scripts, `SECURITY.md`, and `CODEOWNERS`. Configure weekly grouped npm updates from `/` and monthly GitHub Actions updates from `/`, each with a bounded open-PR limit.

- [ ] **Step 3: Add least-privilege CodeQL**

Create a JavaScript/TypeScript CodeQL workflow for `master`, pull requests, manual runs, and a weekly schedule. Set `contents: read`, `actions: read`, and job-level `security-events: write`; use official `checkout@v4` and `github/codeql-action/*@v3` actions.

- [ ] **Step 4: Add compatibility coverage**

Add one CI matrix job with Ubuntu Node 22, Ubuntu Node 24, and Windows Node 20. Install with frozen lockfile, then run build, typecheck, and the package test suites. Keep the existing Node 20 Ubuntu quality, coverage, browser, and package jobs unchanged.

- [ ] **Step 5: Validate YAML formatting and local commands**

```bash
pnpm exec prettier --check .github
pnpm test:release
pnpm typecheck
pnpm build
```

Expected: Prettier and all local commands pass; hosted GitHub validation occurs after push.

- [ ] **Step 6: Commit repository configuration**

```bash
git add .github
git commit -m "chore(docs): configure GitHub project discovery"
```

### Task 5: Reassess, verify, publish to GitHub, and audit completion

**Files:**

- Create: `docs/reports/2026-07-15-quality-reassessment.md`
- Modify: `docs/README.md`
- Modify: `docs/plans/changelog.md`

- [ ] **Step 1: Run the complete local quality gate**

```bash
pnpm quality:gate
pnpm exec turbo run lint typecheck build --force
node scripts/verifyRegistryInstall.mjs 0.1.0
git diff --check
```

Expected: every command exits zero; official-registry verification installs and runs the already-published `0.1.0` without publishing.

- [ ] **Step 2: Write the final reassessment**

Use the existing seven weights `25/15/15/10/20/10/5`, current command output, self-analysis, repository configuration, and remaining limitations. Explicitly state that no Codex Security Deep Scan or standard Security Scan result contributes to the score.

- [ ] **Step 3: Index and commit the report**

```bash
git add docs/reports/2026-07-15-quality-reassessment.md docs/README.md docs/plans/changelog.md
git commit -m "docs(docs): record final quality reassessment"
```

- [ ] **Step 4: Push and create the pull request**

```bash
git push -u origin codex/discoverability-hardening
gh pr create --base master --head codex/discoverability-hardening \
  --title "fix: harden trust boundaries and GitHub discovery" \
  --body-file <generated-pr-body>
```

- [ ] **Step 5: Wait for hosted checks and repair failures**

Use `gh pr checks --watch`. Inspect failing job logs, fix only evidenced failures, rerun local focused checks, push, and repeat until every required CI and CodeQL check is green.

- [ ] **Step 6: Merge and update GitHub About metadata**

Merge the PR after hosted checks pass. Update the durable description, npm homepage, and twenty approved search topics with `gh repo edit`, then read them back with `gh repo view --json`.

- [ ] **Step 7: Verify the merged public state**

Confirm `origin/master` contains the merge, fetch `README.md` from the GitHub Contents API, verify the npm badge/FAQ/Quick Start, and confirm no npm tag or dist-tag changed.

- [ ] **Step 8: Mark the persistent goal complete**

Only after all local, hosted, metadata, README, and no-publish assertions are proven, call the goal completion tool and report the final evidence.
