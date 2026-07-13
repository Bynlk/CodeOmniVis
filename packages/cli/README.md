# @bynlk/codeomnivis

CodeOmniVis is a zero-config TypeScript full-stack architecture visualizer. It connects Next.js pages, React components, APIs, services, and database models in a local workbench and exposes the same graph to AI coding agents through MCP.

## Quick start

Run this at the root of a TypeScript repository:

```bash
npx @bynlk/codeomnivis serve
```

Or point it at another local project:

```bash
npx @bynlk/codeomnivis serve --project /absolute/path/to/repository
```

## Commands

| Command | Purpose |
| --- | --- |
| `serve` | Analyze a project and open the local architecture workbench |
| `analyze` | Write the graph as JSON |
| `check` | Print parser diagnostics and deterministic findings |
| `mcp` | Start the stdio MCP server for AI coding agents |
| `init` | Generate a starter `.codeomnivis.json` file |

## Documentation

- [GitHub repository](https://github.com/Bynlk/CodeOmniVis)
- [English README](https://github.com/Bynlk/CodeOmniVis#readme)
- [中文 README](https://github.com/Bynlk/CodeOmniVis/blob/master/README.zh-CN.md)
- [MCP tools](https://github.com/Bynlk/CodeOmniVis/blob/master/docs/api/mcp-tools.md)
- [REST API](https://github.com/Bynlk/CodeOmniVis/blob/master/docs/api/rest-api.md)

CodeOmniVis analyzes source locally. Static analysis can miss runtime dependency injection, generated code, dynamic imports, and metaprogramming; inspect confidence and source locations before making high-risk changes.

## License

PolyForm Noncommercial License 1.0.0. Commercial use requires separate permission.
