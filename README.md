# OmniVis

> Full-stack architecture visualizer for TypeScript projects

OmniVis is a zero-config CLI tool that automatically generates interactive topology diagrams for TypeScript full-stack projects (Next.js + tRPC/Express + Prisma/TypeORM).

## Quick Start

```bash
npx omnivis serve
```

That's it! OmniVis will:
1. Auto-detect your project structure
2. Parse Prisma schema, Next.js routes, tRPC routers
3. Generate an interactive architecture diagram
4. Open it in your browser

## Features

- **Zero Configuration**: Works out of the box
- **Full-Stack Analysis**: Frontend → API → Database
- **Interactive Visualization**: Zoom, pan, click to explore
- **Real-Time Updates**: WebSocket support for live updates
- **MCP Server**: AI assistant integration

## Supported Frameworks

| Layer | Frameworks |
|-------|-----------|
| Frontend | Next.js (App/Pages Router) |
| API | tRPC, Express |
| Database | Prisma, TypeORM |

## CLI Commands

```bash
# Start visualization server
omnivis serve

# Analyze and output JSON
omnivis analyze

# Check for consistency issues
omnivis check

# Generate config file
omnivis init

# Start MCP server
omnivis mcp
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start development
pnpm --filter @omnivis/cli dev serve
```

## Architecture

```
omnivis/
├── packages/
│   ├── shared/       # Shared types and constants
│   ├── analyzer/     # Parsing engine
│   ├── server/       # Express web server
│   ├── ui/           # React + Cytoscape.js UI
│   ├── mcp/          # MCP Server
│   └── cli/          # CLI tool
└── demo/             # Demo project
```

## License

MIT
