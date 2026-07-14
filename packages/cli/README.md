# @bynlk/codeomnivis

CodeOmniVis is a zero-config TypeScript full-stack architecture visualizer. One analyzer-owned `ProjectSnapshot` is projected through the CLI, the local Web/REST workbench, and MCP so humans and AI coding agents refer to the same node IDs, edge IDs, and `snapshotDigest`.

## Quick start

Run this at the root of a TypeScript or mixed TypeScript/Kotlin repository:

```bash
npx @bynlk/codeomnivis serve
```

Or point it at another local project:

```bash
npx @bynlk/codeomnivis serve --project /absolute/path/to/repository
```

## Public command contract

The following fenced block is verified against the CLI command registry:

```codeomnivis-cli-contract
analyze
check
init
mcp
serve
test-import
test-run
```

| Command | Purpose |
| --- | --- |
| `serve --project <path> [--port <port>] [--host <host>] [--no-open]` | Analyze, open the local workbench, watch source files, and publish updates |
| `analyze --project <path> [--output <file>] [--json]` | Write a graph or versioned snapshot envelope |
| `check` | Print parser diagnostics and deterministic findings for the current directory |
| `mcp --project <path>` | Start the protocol-only stdio MCP server |
| `test-import --project <path> --junit <file-or-glob>` | Import bounded JUnit XML without executing tests |
| `test-run --project <path> --runner <name> [--timeout <ms>]` | Explicitly execute an enumerated, shell-free test runner |
| `init` | Generate a starter `.codeomnivis.json` file |

Static analysis commands never execute target tests. Only `test-run` can do so, with validated paths, an argument array, `shell: false`, a 1-second to 30-minute timeout, and a 10 MiB output cap.

## Local and remote access

Loopback `serve` is zero-config. Binding to a non-loopback host requires `--token`; protected REST and WebSocket requests use a bearer token or a short-lived HttpOnly browser session. Keep the workbench local unless remote access is intentional.

## Documentation

- [GitHub repository](https://github.com/Bynlk/CodeOmniVis)
- [English README](https://github.com/Bynlk/CodeOmniVis#readme)
- [中文 README](https://github.com/Bynlk/CodeOmniVis/blob/master/README.zh-CN.md)
- [Test intelligence](https://github.com/Bynlk/CodeOmniVis/blob/master/docs/guides/test-intelligence.md)
- [MCP tools](https://github.com/Bynlk/CodeOmniVis/blob/master/docs/api/mcp-tools.md)
- [REST API](https://github.com/Bynlk/CodeOmniVis/blob/master/docs/api/rest-api.md)

CodeOmniVis analyzes source locally. Static analysis can miss runtime dependency injection, generated code, dynamic imports, reflective test registration, and metaprogramming; inspect confidence and source locations before making high-risk changes.

## License

PolyForm Noncommercial License 1.0.0. Commercial use requires separate permission.
