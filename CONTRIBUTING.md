# Contributing to OmniVis

Thanks for your interest in contributing! 🎉

## 🚀 Quick Start

```bash
# 1. Fork & clone
git clone https://github.com/your-username/CodeOmniVis.git
cd CodeOmniVis

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm build

# 4. Run tests
pnpm test
```

## 📦 Project Structure

This is a monorepo managed by pnpm workspaces + Turborepo:

```
packages/
├── shared/      # Shared types (OmniNode, OmniEdge, OmniGraph)
├── analyzer/    # Parsing engine (tree-sitter + ts-morph)
├── server/      # Express web server + WebSocket
├── ui/          # React + Cytoscape.js visualization
├── mcp/         # MCP Server for AI assistants
└── cli/         # CLI entry point
```

## 🛠️ Development

```bash
# Start CLI in dev mode
pnpm --filter @omnivis/cli dev serve

# Build a single package
pnpm --filter @omnivis/analyzer build

# Watch mode for UI
pnpm --filter @omnivis/ui dev
```

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @omnivis/analyzer test
```

- Each parser needs at least 3 tests: normal input, error input, edge case
- Test files go in `__tests__/` directories with fixtures in `__tests__/fixtures/`

## 📝 Commit Convention

```
<type>(<scope>): <description>

type:   feat | fix | refactor | test | docs | chore
scope:  shared | analyzer | server | ui | mcp | cli | demo | docs
```

Examples:
- `feat(analyzer): add Prisma schema parser`
- `fix(resolver): handle circular imports gracefully`
- `docs(readme): update quick start guide`

## 🐛 Reporting Bugs

Use the [Bug Report](https://github.com/Bynlk/CodeOmniVis/issues/new?template=bug_report.md) template.

## 💡 Suggesting Features

Use the [Feature Request](https://github.com/Bynlk/CodeOmniVis/issues/new?template=feature_request.md) template.

## 📜 Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## ❓ Questions?

Open a [Discussion](https://github.com/Bynlk/CodeOmniVis/discussions) or reach out via Issues.
