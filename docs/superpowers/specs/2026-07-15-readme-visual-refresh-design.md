# README Visual Refresh Design

**Date:** 2026-07-15
**Status:** Approved through the user's request to implement the reviewed redesign

## 1. Objective

Turn the English and Chinese root READMEs from long-form product manuals into focused GitHub landing pages. A first-time visitor should understand what CodeOmniVis does, see a truthful product result, and copy a working command within the first screen.

The redesign is successful when it improves hierarchy and visual trust without weakening technical accuracy, bilingual parity, search intent, or the project's explicit limitations.

## 2. Primary Audience and Reading Path

The primary visitor is a TypeScript developer evaluating an unfamiliar developer tool. The README must answer these questions in order:

1. What does CodeOmniVis show?
2. Can I run it immediately?
3. Is the result real and useful?
4. Which stacks and AI workflows are supported?
5. Where can I verify details, limitations, and development instructions?

The page should optimize for activation first and documentation discovery second. It should not reproduce the complete REST API, package map, roadmap, FAQ, and command manual inline.

## 3. Information Architecture

Both READMEs will use the same compact structure:

1. compact brand header with language and documentation links;
2. one-sentence product definition;
3. no more than four stable trust badges;
4. visible one-command Quick Start;
5. one primary product visual;
6. three concise outcomes covering repository mapping, cross-layer tracing, and AI context through MCP;
7. one architecture explanation anchored by the existing architecture SVG;
8. a shortened evidence-based support matrix;
9. visible MCP setup plus links to full CLI, REST, test-intelligence, and limitation documentation;
10. compact development, contributing, and license sections.

Target length is 160 to 200 lines per language. The full command and API references will move behind documentation links instead of remaining inline.

## 4. Header and Trust Signals

The header will preserve the real CodeOmniVis logo and restrained workbench identity. It will avoid decorative gradients, generated product imagery, oversized marketing copy, and redundant keyword lists.

The badge row will keep only stable, actionable signals:

- CI status;
- npm version linked to `@bynlk/codeomnivis`;
- supported Node.js version;
- PolyForm Noncommercial license.

The npm downloads badge will be removed because its current red `package not found or too new` state damages trust. The GitHub stars badge will also be removed because GitHub already exposes stars in the repository chrome and the badge wraps onto a second line at narrower widths.

Language and documentation links will appear before the primary visual so Chinese readers do not need to scroll past an English screenshot to find the Chinese README.

## 5. Visual Strategy

The README will continue to use truthful product evidence only. No AI-generated or invented UI is allowed.

The implementation will capture a new focused screenshot from the real bundled demo and replace the current primary hero. It must show the page-to-component-to-API relationship clearly at GitHub's rendered content width, preserve actual UI state, use a compact landscape aspect ratio, and be checked at desktop and narrow widths.

The architecture SVG remains the main explanatory diagram. The quality screenshot and MCP illustration do not need to remain as separate full-width sections when their information is already represented by concise copy and documentation links. Their source assets remain in the repository and may still be used by documentation pages.

## 6. Copy and Content Rules

- Keep the canonical package name `@bynlk/codeomnivis` and the exact Quick Start command.
- Preserve the durable search intents currently protected by `scripts/verifyReadme.mjs`, but state each intent once in natural copy rather than repeating it across sections.
- Prefer concrete verbs such as map, trace, query, inspect, and verify.
- Keep local-first behavior, static-analysis confidence, optional AI egress, experimental Kotlin coverage, and commercial-license constraints explicit.
- Remove claims that merely restate the same architecture-context idea.
- Keep English and Chinese structures aligned without forcing literal sentence-by-sentence translation.

## 7. README Contract Changes

The README verifier currently protects the previous long-form layout, including the broken downloads badge, fourteen section anchors, and all four visuals. It will be updated with the landing-page contract rather than bypassed.

The revised contract will require:

- the compact shared section anchors used by both languages;
- the Quick Start command and npm package URL;
- the stable badge set, explicitly excluding a downloads-badge requirement;
- the primary product visual and architecture diagram;
- bilingual links;
- durable search-intent phrases and trust/limitation statements;
- local link and asset validity.

The contract test name will be updated so it describes the new compact landing-page guarantees instead of the previous FAQ and four-visual layout.

## 8. Compatibility and Error Handling

- Existing commands, public APIs, package metadata, and runtime behavior are unchanged.
- Existing visual assets are not deleted merely because they leave the root README.
- Invalid local Markdown links remain a verification failure.
- English and Chinese drift remains a verification failure.
- The redesign must render without horizontal overflow in GitHub's desktop and narrow content widths.

## 9. Verification

Implementation completion requires:

1. `pnpm verify:readme`;
2. `pnpm exec vitest run packages/cli/__tests__/docs/readmeContract.test.ts`;
3. `pnpm format:check`;
4. `git diff --check`;
5. rendered inspection of the README header, Quick Start, primary visual, architecture section, support matrix, and narrow-width wrapping;
6. confirmation that both READMEs remain within the intended compact range or have an explicit evidence-based reason to exceed it.

## 10. Non-goals

- no product UI redesign;
- no invented or AI-generated product screenshots;
- no npm publish, tag, or release change;
- no GitHub About or topic update;
- no deletion of detailed documentation that remains useful outside the root README;
- no broad rewrite of unrelated documentation.
