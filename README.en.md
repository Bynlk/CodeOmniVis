<div align="center">

# CodeOmniVis

**Stop Letting AI Guess Your Architecture**

English | **[中文](README.md)**

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-00d4aa.svg)](LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/Node.js-%E2%89%A518-339933.svg)](https://nodejs.org/)
[![pnpm 9](https://img.shields.io/badge/pnpm-9-f69220.svg?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![GitHub stars](https://img.shields.io/github/stars/Bynlk/CodeOmniVis?style=social)](https://github.com/Bynlk/CodeOmniVis)

Turn your repo into an AI-queryable architecture graph across pages, components, APIs / RPC, and databases.

</div>

CodeOmniVis is not another coding agent. It is a shared architecture context layer for coding agents, IDE assistants, and human developers: scan the repo, build one graph, then expose that same graph through a browser UI, REST, and MCP.

Plug it into Claude, Cline, Cursor, or any MCP-capable client and the value becomes immediate.

Claude, Cline, Cursor, and similar tools are already good at editing files, running commands, and calling tools. Where they still drift is system boundaries and cross-layer impact:

- Which route or procedure does this page actually hit?
- If I change this model, which APIs, components, and data flows move with it?
- Is this service really dead code, or did I just fail to trace it?
- What context should I give the AI so it stops guessing?

CodeOmniVis exists to answer those questions from the codebase itself.

## Get Running In 5 Minutes

```bash
pnpm install
pnpm build
node packages/cli/bin/codeomnivis.js serve --project ./demo --no-open
```

Open `http://localhost:4321` and you immediately get three ways into the same graph:

- browser UI
- REST API
- MCP server

## Why It Matters Now

- **Not another coding agent**: it does not compete with Claude / Cline / Cursor, it gives them architecture context
- **One graph, three surfaces**: the same graph powers UI, CLI, REST, and MCP
- **Works on existing repos**: no IDE migration, no invasive instrumentation
- **Built for repeated queries**: cache persists at `~/.codeomnivis/projects/{hash}.db`, then watcher / WebSocket keep the map live

## Why Not Just Use Cursor / Cline / Claude Code?

Because those tools are optimized to **act**. CodeOmniVis is optimized to **prove structure**.

- let the agent implement, refactor, and fix
- let CodeOmniVis answer callers, impact, boundaries, and data flow
- the best workflow is not either-or; it is using CodeOmniVis as the architecture context layer under those tools

If you already work through MCP, this becomes even more direct: let the AI query the graph before it edits the repo.

## What You Can Do With It

- Understand an unfamiliar repository before changing it
- Check callers, impacted pages, and data paths before refactors or migrations
- Give Claude, Cline, Cursor, or any MCP-aware client real architecture context
- Keep a searchable, filterable, auto-refreshing project map alongside daily development

## What Is Available Today

| Area | Current surface |
| --- | --- |
| CLI | `serve`, `analyze`, `check`, `mcp`, `init` |
| UI | Graph canvas, search, filters, node details, data flow, issue list, stats panel |
| Server | `GET /api/graph*`, `POST /api/analyze`, `GET /api/health`, `ws://.../ws` |
| MCP | `get_api_routes`, `get_component_tree`, `find_callers`, `list_db_models`, `get_dataflow` |
| Cache | Persistent `sql.js` database at `~/.codeomnivis/projects/{hash}.db` |

> This repository is currently best used in source-first mode: build CodeOmniVis here, then point it at the project you want to analyze.

## Current Mainline Runtime Focus

| Dimension | Current mainline runtime |
| --- | --- |
| Frontend | Next.js App Router, Next.js Pages Router, React component tree, `fetch` / `axios` call detection |
| API / RPC | Next.js Route Handlers, tRPC, TSRPC (`serve` / MCP path), Express, NestJS |
| Data layer | Prisma, Drizzle, TypeORM |
| Workspace layouts | Basic path discovery for `pnpm workspace` / Turborepo |

> The repository already contains Kotlin / Spring / Ktor / Room / Exposed parser work, but those paths are not yet fully wired into the main README-recommended runtime flow, so they are not marketed here as first-class runtime coverage.

> Monorepo support is currently best-effort path discovery, not full multi-package graph federation.

## More Ways To Run It

### 1. Analyze any local repository directly

```bash
node /absolute/path/to/CodeOmniVis/packages/cli/bin/codeomnivis.js serve \
  --project /absolute/path/to/your-repo \
  --no-open
```

If the CLI is already in your `PATH`, the equivalent command is:

```bash
codeomnivis serve --project /absolute/path/to/your-repo --no-open
```

### 2. Export graph JSON or run consistency checks

```bash
cd /absolute/path/to/your-repo
node /absolute/path/to/CodeOmniVis/packages/cli/bin/codeomnivis.js analyze -o codeomnivis-graph.json
node /absolute/path/to/CodeOmniVis/packages/cli/bin/codeomnivis.js check
```

`analyze` and `check` currently operate on the current working directory, so the most reliable workflow is to `cd` into the target repository first.

## CLI Commands

| Command | What it does | Notes |
| --- | --- | --- |
| `serve --project <path> [--port 4321] [--host localhost] [--no-open]` | Starts the visualization server and runs initial analysis | Also starts file watching, REST API, and WebSocket |
| `analyze [-o codeomnivis-graph.json]` | Analyzes the current directory and writes graph JSON | Useful for offline inspection or CI artifacts |
| `check` | Runs consistency checks | Prints stats, parse errors, and consistency issues |
| `mcp --project <path>` | Starts the stdio MCP server | Intended for AI client integration |
| `init` | Generates a starter `.codeomnivis.json` | Recommended to tweak manually afterward |

## What the UI and API expose

| Capability | Notes |
| --- | --- |
| Graph canvas | React + Cytoscape.js visualization of nodes and edges |
| Search and filtering | Filter by node type, edge type, confidence, and isolated nodes |
| Node details | Inspect metadata, incoming edges, and outgoing edges |
| Data Flow panel | Trace a database model into API routes and consuming components |
| Issues panel | Shows parse-error output from the server |
| Stats panel | Shows node / edge distribution and overall graph size |
| AI panel | Frontend shell exists, but `/api/ai/chat` currently returns `501` |

The server also exposes a directly usable surface:

- `GET /api/graph`
- `GET /api/graph/nodes`
- `GET /api/graph/nodes/:id`
- `GET /api/graph/edges`
- `GET /api/graph/stats`
- `GET /api/graph/errors`
- `GET /api/graph/dataflow`
- `POST /api/analyze`
- `GET /api/health`
- `ws://<host>:<port>/ws`, which emits `graph_updated`

See [docs/api/rest-api.md](docs/api/rest-api.md) for the full contract.

## MCP Integration

CodeOmniVis includes a stdio MCP server so Cursor, Claude Desktop, and other MCP-capable clients can query your repository structure directly.

### Available tools

| Tool | Typical questions it answers |
| --- | --- |
| `get_api_routes` | What API, tRPC, or TSRPC entries exist? Which ones touch the database? |
| `get_component_tree` | What component tree renders from a given route or file? |
| `find_callers` | Who calls this node, and which pages are affected? |
| `list_db_models` | What database models exist in this project? |
| `get_dataflow` | How does a model move from DB to API to UI? |

### Example client configuration

```json
{
  "mcpServers": {
    "codeomnivis": {
      "command": "node",
      "args": [
        "/absolute/path/to/CodeOmniVis/packages/cli/bin/codeomnivis.js",
        "mcp",
        "--project",
        "/absolute/path/to/your-repo"
      ]
    }
  }
}
```

On first startup, if the project does not already have a cache database, the MCP server runs a full analysis before serving queries. Later calls reuse `~/.codeomnivis/projects/{hash}.db`.

See [docs/api/mcp-tools.md](docs/api/mcp-tools.md) for tool inputs and outputs.

## Configuration

You can place `.codeomnivis.json` in the project root. Configuration support is not yet perfectly aligned across every command: `serve` is the most complete consumer today, while `check` and `init` still have gaps and mismatches. Treat config as an **optional advanced override layer**, not as a fully stable contract.

The example below is closer to the target config shape than to a guarantee that every command fully honors every field today:

```json
{
  "frontend": {
    "dirs": ["app", "components"],
    "framework": "auto"
  },
  "backend": {
    "dirs": ["server", "api"],
    "framework": "trpc"
  },
  "database": {
    "prismaSchema": "prisma/schema.prisma",
    "typeormDirs": ["src/entities"]
  },
  "exclude": ["node_modules", "dist", ".next", "coverage"],
  "port": 4321,
  "parser": {
    "maxTraceDepth": 5,
    "incremental": true
  },
  "ui": {
    "theme": "dark",
    "layout": "dagre",
    "aggregateThreshold": 100
  }
}
```

If you just want a quick starter file, begin with:

```bash
codeomnivis init
```

Then adjust it to match the repository you are analyzing.

## Repository Layout

| Directory / package | Responsibility |
| --- | --- |
| [`packages/shared`](packages/shared) | Shared types, config, colors, and defaults |
| [`packages/analyzer`](packages/analyzer) | Parsers, graph building, data-flow tracing, consistency checks |
| [`packages/server`](packages/server) | REST API, WebSocket, incremental analysis |
| [`packages/ui`](packages/ui) | React + Cytoscape.js frontend |
| [`packages/mcp`](packages/mcp) | stdio MCP server |
| [`packages/cli`](packages/cli) | CLI entrypoints and project auto-detection |
| [`demo`](demo) | A small full-stack sample used to validate graph quality |
| [`docs`](docs) | API docs, architecture docs, reports, and plans |

For a more detailed tree, see [docs/project-directory.md](docs/project-directory.md).

## Demo

[`demo/`](demo) is a compact sample repository designed for graph validation. It includes:

- Next.js App Router pages
- Route Handler APIs
- tRPC router files
- React component trees
- A Prisma schema with model relationships

How to run it and what to inspect in the graph is documented in [demo/README.md](demo/README.md).

## Documentation

- [Documentation index](docs/README.md)
- [REST API](docs/api/rest-api.md)
- [MCP tools](docs/api/mcp-tools.md)
- [Project directory](docs/project-directory.md)
- [Project status report](docs/PROJECT_STATUS_REPORT.md)
- [Parser pipeline](docs/architecture/parser-pipeline.md)
- [Data model](docs/architecture/data-model.md)
- [Visualization design](docs/architecture/visualization.md)

## Development

### Requirements

- Node.js `>= 18`
- `pnpm@9`

### Common commands

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

The repository uses `pnpm workspace` and `turbo` for package orchestration.

## Roadmap

- More reliable monorepo and multi-package analysis
- Module folding / aggregation for large graphs
- Richer AI workflows beyond exposing MCP queries
- More frameworks and language ecosystems
- Better demo assets, screenshots, and publishing docs

## Contributing

- Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Community rules: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Security reporting: [SECURITY.md](SECURITY.md)

## License

[PolyForm Noncommercial License 1.0.0](LICENSE)

By default, this repository is intended for learning, research, personal, and other non-commercial use. Commercial usage requires separate permission.
