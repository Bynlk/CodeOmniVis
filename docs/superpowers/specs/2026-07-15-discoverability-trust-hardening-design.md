# Discoverability and Trust Hardening Design

**Date:** 2026-07-15
**Status:** Approved by the user's explicit autonomous-execution instruction

## 1. Objective

Make the public GitHub repository easier to find and easier to trust without replacing the product story that already shipped with `0.1.0`.

The work combines repository discoverability with two bounded runtime fixes found during the July 15 local quality review:

- reject IPv4-mapped IPv6 representations of loopback, private, and link-local AI upstream addresses;
- prevent test fixtures from being projected as production architecture nodes and quality findings.

The result must be live on GitHub, backed by green local and hosted checks, and must not publish or retag an npm version.

## 2. Product and Repository Positioning

The canonical positioning remains:

> A local-first TypeScript full-stack architecture visualizer that connects Next.js and React through APIs and services to database models, then exposes the same graph through a browser workbench, CLI/REST, and MCP.

The GitHub About description, repository topics, root README, Chinese README, and npm package metadata should use the same vocabulary. Claims that depend on implementation counts, such as a fixed parser total or an `any` count, are excluded from repository metadata because they age quickly and are not meaningful search intents.

## 3. Runtime Trust Fixes

### 3.1 AI destination normalization

`validateUpstreamBaseUrl()` currently rejects literal IPv4 private ranges and native IPv6 private ranges but accepts their IPv4-mapped IPv6 forms after WHATWG URL normalization, for example `::ffff:7f00:1`.

The shared AI URL policy will add a pure IPv4-mapped IPv6 decoder. Loopback detection and blocked-address detection will evaluate the decoded IPv4 value. The server request policy will reuse the shared loopback predicate so remote mode rejects mapped loopback destinations while local mode retains explicit localhost support.

Regression coverage must include dotted and hexadecimal mapped forms for loopback, RFC1918, and link-local/metadata addresses, plus a mapped public address that remains valid.

### 3.2 Production/test source separation

Analysis intentionally collects test files for static test intelligence. Production parsers currently implement test-path exclusions independently, which lets some Next.js and tRPC fixtures become production routes and critical quality findings.

A single source-path policy will classify test-only paths. `GraphBuilder` will skip production parser dispatch for those paths while `analyzeProject()` continues to pass the same files to test adapters. This preserves suite/case/fixture discovery and removes production graph pollution.

Coverage must prove both halves of the boundary: a parser is not called for a test fixture, while existing test-intelligence integration remains green.

## 4. README and Documentation

The existing English-first bilingual README and four truthful visual assets remain authoritative. The update is incremental:

- add npm version and download badges linked to the public package;
- add an explicit Quick Start heading above the one-command path;
- add a compact outcome table explaining what users see in the first minute;
- add a bilingual FAQ covering local-first behavior, source-code handling, static-analysis confidence, MCP, and commercial licensing;
- keep the real workbench and quality screenshots plus the two explanatory SVGs;
- extend the README verifier to protect the new FAQ and npm package link.

Trust documentation will also be corrected:

- `SECURITY.md` supports `0.1.x`, documents optional user-configured AI egress, and lists the current language/parser surface;
- `docs/project-directory.md` names the actual PolyForm Noncommercial license;
- historical status/engineering documents receive visible historical-snapshot banners instead of silently reading as current state;
- `CHANGELOG.md` and `docs/plans/changelog.md` record the changes;
- a dated reassessment report records the final evidence and explicitly excludes Codex Security scan results.

## 5. GitHub Configuration

The repository will gain configuration that improves maintenance and search visibility:

- modern issue forms for reproducible bug reports and scoped feature requests;
- issue-template config pointing security reports to the private vulnerability channel and questions to Discussions;
- `CODEOWNERS` for critical release, CI, package, and security-policy files;
- weekly grouped Dependabot updates for the pnpm workspace and GitHub Actions;
- CodeQL for JavaScript/TypeScript on pull requests, `master`, manual runs, and a weekly schedule;
- a compatibility CI job that supplements existing Node 20 Ubuntu coverage with Node 22, Node 24, and Windows Node 20.

After code and CI are green, GitHub About metadata will be updated through the authenticated GitHub API:

- concise durable description without volatile implementation counts;
- npm package URL as the homepage;
- twenty focused topics spanning architecture visualization, dependency graphs, supported frameworks, MCP, AI coding assistants, and developer tooling.

Branch protection is intentionally not changed in this task because enabling it without an agreed merge policy could lock out the repository owner or conflict with the release workflow.

## 6. Error Handling and Compatibility

- Invalid mapped destinations return the existing `AI_DESTINATION_REJECTED` behavior; no public response schema changes.
- Production parser skipping is a pre-dispatch policy and does not throw. Test adapters still own test discovery and degradation.
- All new CI workflows use official GitHub actions and least-privilege permissions.
- Dependabot is grouped to avoid high-volume single-package pull requests.
- Existing `v0.1.0` and npm dist-tags remain untouched.

## 7. Verification

Local completion requires:

1. focused red/green tests for mapped addresses, source-path policy, formatting gate, and README contract;
2. `pnpm quality:gate` with zero failures;
3. non-cached `pnpm exec turbo run lint typecheck build --force`;
4. self-analysis showing no production critical findings sourced from `__tests__/fixtures`;
5. official-registry package verification for `0.1.0` without publishing;
6. `git diff --check` and a clean tracked worktree.

GitHub completion requires:

1. branch pushed and pull request created;
2. all required CI and CodeQL checks green;
3. pull request merged to `master`;
4. GitHub About description, homepage, and topics updated and read back from the API;
5. root README on `master` verified through the GitHub API.

## 8. Non-goals

- no npm `0.1.1` publish or tag creation;
- no Codex Security Deep Scan or standard Security Scan result in the score;
- no full-repository Prettier rewrite;
- no dependency major-version migration;
- no broad parser decomposition beyond the shared source-path policy;
- no invented screenshots or generated product UI.
