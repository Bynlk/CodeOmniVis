# Discoverable README and npm Release Design

**Date:** 2026-07-14
**Status:** Approved for written-spec review

## 1. Objective

Rebuild CodeOmniVis's GitHub landing experience around a credible, searchable, visually rich product story and make the CLI genuinely installable with one public npm command.

The default `README.md` will be English so that GitHub and search engines can index the product for a global audience. `README.zh-CN.md` will provide a complete Chinese mirror. Both documents must describe only behavior that has been verified in the current repository.

The primary reader is a full-stack developer already using Cursor, Claude Code, Cline, or another AI coding agent. The primary conversion is not a GitHub star or an MCP configuration: it is successfully launching CodeOmniVis and seeing a repository architecture graph within 60 seconds.

## 2. Positioning

### Primary headline

> See your full-stack architecture. Give AI the context it's missing.

### Supporting promise

CodeOmniVis is a zero-configuration TypeScript architecture visualizer that connects Next.js pages, React components, APIs, services, and database models in one local workbench. It also exposes the same architecture context to AI coding agents through MCP.

### Messaging principles

- Lead with the working product and its output, not a manifesto.
- Explain the AI-context problem immediately after the quick start.
- Prefer concrete nouns and verified verbs over broad claims.
- State confidence, supported stacks, experimental support, and limitations explicitly.
- Do not describe the Web UI as an AI chat product.
- Keep the tone precise, restrained, and trustworthy.

## 3. Information Architecture

### 3.1 English default README

`README.md` will use the following order:

1. COV logo and project name
2. Status badges
3. Primary headline
4. Search-oriented supporting sentence
5. Real dark-workbench hero screenshot
6. One-command quick start: `npx @bynlk/codeomnivis serve`
7. English / Chinese / documentation links
8. Short problem statement: AI agents can act on files but still lose cross-layer architecture context
9. Three primary workflows
   - Understand an unfamiliar full-stack repository
   - Trace a page or component through APIs and services to data models
   - Give AI coding agents verified architecture context through MCP
10. Repository-to-graph architecture diagram
11. Three evidence-led product sections
   - Architecture workbench
   - Deterministic quality findings
   - MCP architecture queries
12. Supported-stack matrix
13. CLI reference
14. MCP configuration
15. REST and WebSocket entry points
16. Known limitations and experimental support
17. Repository structure and development commands
18. Roadmap, contributing, security, and license

The quick-start command must remain above the first long explanatory section.

### 3.2 Chinese mirror

`README.zh-CN.md` will mirror the English document's section order, commands, tables, links, and factual claims. It may adapt phrasing for natural Chinese rather than translating sentence by sentence. The top language switch will link back to `README.md`.

The existing `README.en.md` will be removed after inbound repository links are updated because English becomes the canonical root README.

## 4. Visual System

The README will use hybrid evidence: a real product screenshot first, one explanatory diagram, and focused product crops. Existing white-background turquoise illustrations do not match the current restrained dark product identity and will be replaced.

### 4.1 Required assets

All assets live under `docs/assets/readme/` and use searchable lowercase filenames:

| Asset | Purpose | Required content |
| --- | --- | --- |
| `codeomnivis-workbench-hero.png` | Primary product proof | Full dark workbench with graph, explorer, inspector/status context, and current COV branding |
| `typescript-full-stack-architecture-graph.svg` | Explain the data model | Repository source flowing through pages/components, API/service, and database layers into Web UI, CLI/REST, and MCP |
| `code-quality-findings.png` | Prove deterministic quality analysis | Quality explorer and findings canvas with severity, source location, and localized description visible |
| `mcp-ai-codebase-context.svg` | Explain AI-agent consumption | MCP client querying the shared architecture graph with representative tool names |

The hero and quality images must come from the current product UI or a deterministic local demo state, not an invented interface. Diagrams must use the same neutral dark surfaces, blue accent, semantic severity colors, and no gradients.

### 4.2 Image behavior

- Every image has descriptive alt text containing its actual subject, not a keyword list.
- SVG diagrams remain readable in GitHub light and dark themes by providing their own restrained background.
- Raster images should be wide enough for Retina GitHub rendering while staying reasonably compressed.
- Decorative images are avoided; every asset must explain a product capability.

## 5. Search Discoverability

Search coverage will be built into readable prose, headings, filenames, and alt text. The README must naturally include these intent clusters:

- TypeScript architecture visualizer
- full-stack architecture graph
- Next.js dependency graph
- React component graph
- Prisma ER diagram
- API and database dependency visualization
- MCP server for codebase architecture
- AI coding agent context
- Cursor, Claude Code, and Cline architecture context

Keywords must not be repeated mechanically. Each term should appear only where the corresponding capability is explained. The repository description and npm package metadata should reinforce the same positioning.

GitHub-specific discoverability includes:

- concise repository description recommendation;
- relevant repository topics recommendation;
- accurate badge labels and image alt text;
- stable heading anchors and internal links;
- a short first paragraph that can serve as a search snippet.

## 6. npm Package Contract

### 6.1 Package identity

The public package name will be normalized to lowercase:

```text
@bynlk/codeomnivis
```

The executable remains:

```text
codeomnivis
```

All workspace dependency references, lockfile entries, docs, examples, and package metadata that refer to the old mixed-case package name must be updated consistently.

### 6.2 Public package metadata

The CLI manifest must provide accurate values for:

- `name`
- `version`
- `description`
- `keywords`
- `license`
- `repository`
- `homepage`
- `bugs`
- `engines`
- `bin`
- `files`
- `publishConfig.registry`
- `publishConfig.access`

The package tarball must include the CLI entry point, bundled JavaScript, UI production assets, Kotlin WASM assets required by the runtime, license, and an npm-facing README. It must exclude source tests, local databases, planning files, and unrelated workspace artifacts.

### 6.3 Release gates

Before any public publish, implementation must prove:

1. `npm pack --dry-run --registry=https://registry.npmjs.org` contains the intended files only.
2. A real tarball can be installed in a new temporary directory.
3. `npx --no-install codeomnivis --help` works from that installation.
4. `codeomnivis serve` can start from the packed installation and serve the bundled UI.
5. The demo can be analyzed through the packed CLI.
6. Build, typecheck, lint, and tests pass from the workspace.

The machine's current default npm registry points to an internal mirror. Public-release commands must therefore set or verify `https://registry.npmjs.org` explicitly.

`npm publish` is an external, irreversible release action. It is outside automatic implementation and requires a final user confirmation after registry, npm identity, version, tarball contents, and release notes are shown.

## 7. Implementation Boundaries

### README content

README content should link to detailed API or architecture documents instead of duplicating them. The root README is a product landing page and quick reference, not the complete documentation site.

### Visual capture

The demo project is the authoritative screenshot source. If the current demo does not expose a required state, the implementation may add deterministic fixture data or a documented capture procedure, but it must not fake data that the running application cannot produce.

### Claims

Frameworks fully exercised by the recommended CLI path belong in the supported matrix. Parsers present in source but not fully integrated belong in an experimental section. Known monorepo, configuration, performance, and language limitations remain visible.

## 8. Failure Handling

- If a screenshot state cannot be produced from the current demo, keep the section but use a truthful diagram or omit the image until the state is reproducible.
- If the packed CLI cannot start without workspace files, fix the package boundary rather than documenting a repository-only workaround as a one-command install.
- If the scoped npm name cannot be published by the authenticated account, stop before publishing and present verified naming alternatives.
- If English and Chinese facts diverge, treat the English README as canonical for structure, reconcile the difference, and update both in the same change.
- Broken optional links should be removed or corrected; required quick-start and language links block completion.

## 9. Verification

### Automated checks

- Check all relative Markdown links and image targets in both READMEs.
- Verify both READMEs contain the same required headings, commands, supported-stack facts, and limitation categories.
- Validate SVG syntax and raster image dimensions.
- Run `npm pack --dry-run` against the official registry.
- Install and exercise the generated tarball in an isolated temporary directory.
- Run repository build, typecheck, lint, and test tasks.
- Run `git diff --check`.

### Manual checks

- Render both READMEs on a GitHub-compatible Markdown surface.
- Confirm the first viewport shows identity, value proposition, real product evidence, and the quick-start command.
- Confirm images remain legible in GitHub light and dark themes and at narrow widths.
- Confirm every marketing statement is backed by a current command, test, API, or visible UI state.

## 10. Acceptance Criteria

The work is complete when:

1. `README.md` is the English product-first canonical README.
2. `README.zh-CN.md` is a complete, structurally equivalent Chinese mirror.
3. The old English mirror and old white/turquoise README visuals are removed or fully superseded without broken links.
4. Four required visual assets exist and accurately reflect the current product.
5. The public CLI package name and metadata consistently use `@bynlk/codeomnivis`.
6. A packed tarball installs and runs the CLI and bundled UI outside the monorepo.
7. Search intent terms occur naturally in relevant headings, prose, filenames, and alt text.
8. Limitations and experimental support are clearly separated from verified support.
9. README link, bilingual consistency, package, build, typecheck, lint, test, and whitespace checks pass.
10. No `npm publish` is performed without explicit final approval.
