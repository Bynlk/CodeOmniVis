# Contributing to CodeOmniVis

Thanks for your interest in contributing! 🎉

## Quick Start

```bash
# 1. Fork & clone
git clone https://github.com/your-username/CodeOmniVis.git
cd CodeOmniVis

# 2. Install the exact dependency graph
pnpm install --frozen-lockfile

# 3. Build all packages
pnpm build

# 4. Run the release-quality gate
pnpm quality:gate
```

## Project Structure

This is a monorepo managed by pnpm workspaces + Turborepo:

```
packages/
├── shared/      # Shared types (OmniNode, OmniEdge, OmniGraph)
├── analyzer/    # Parsing engine (ts-morph)
├── server/      # Express web server + WebSocket
├── ui/          # React + Cytoscape.js visualization
├── mcp/         # MCP Server for AI assistants
├── cli/         # Published @bynlk/codeomnivis CLI
└── contract-tests/ # CLI/REST/MCP snapshot parity
```

## Development

```bash
# Build and run the published CLI surface
pnpm --filter @bynlk/codeomnivis build
node packages/cli/bin/codeomnivis.js serve --project ./demo --no-open

# Build a single package
pnpm --filter @codeomnivis/analyzer build

# Watch mode for UI
pnpm --filter @codeomnivis/ui dev
```

## Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @codeomnivis/analyzer test

# Run browser and public-contract checks
pnpm test:e2e
pnpm verify:contracts

# Run formatting, lint, types, build, coverage, E2E, audit, docs, and package checks
pnpm quality:gate
```

- Each parser needs at least 3 tests: normal input, error input, edge case
- Test files go in `__tests__/` directories with fixtures in `__tests__/fixtures/`
- Parser failures must degrade to warnings instead of aborting the whole analysis
- New edges must have existing endpoints and explicit `certain` or `inferred` confidence
- Public CLI, REST, or MCP changes must update the verified fenced contract blocks

## Commit Convention

```
<type>(<scope>): <description>

type:   feat | fix | refactor | test | docs | chore
scope:  shared | analyzer | server | ui | mcp | cli | demo | docs
```

Examples:
- `feat(analyzer): add Prisma schema parser`
- `fix(resolver): handle circular imports gracefully`
- `docs(readme): update quick start guide`

## Reporting Bugs

Use the [Bug Report](https://github.com/Bynlk/CodeOmniVis/issues/new?template=bug_report.md) template.

## Suggesting Features

Use the [Feature Request](https://github.com/Bynlk/CodeOmniVis/issues/new?template=feature_request.md) template.

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## Questions?

Open a [Discussion](https://github.com/Bynlk/CodeOmniVis/discussions) or reach out via Issues.
