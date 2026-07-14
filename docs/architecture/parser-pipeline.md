# Analyzer and parser pipeline

`@codeomnivis/analyzer` is the only owner of project detection and full analysis. CLI `analyze`/`serve`, REST/Web, and MCP do not assemble their own parser lists; they call the same analyzer pipeline or read its latest committed `ProjectSnapshot`.

## Execution order

1. Resolve and realpath the project root.
2. Detect frontend/backend/database frameworks, workspace packages, source directories, Prisma schema, Gradle build file, and optional `.codeomnivis.json` overrides.
3. Collect supported `.ts`, `.tsx`, `.js`, `.jsx`, `.kt`, `.kts`, and `.prisma` files. Hidden, dependency, build, coverage, and cache directories are excluded; escaping symlinks are rejected.
4. Compute source and project fingerprints.
5. Run registered production parsers into an in-memory scratch database.
6. Discover test suites, cases, and fixtures without executing tests, then link them to production nodes.
7. Resolve cross-file and cross-layer edges.
8. Sanitize the graph, removing self loops, duplicate relationships, and dangling endpoints.
9. Run deterministic issue detectors and aggregate recoverable parser warnings.
10. Compute the normalized snapshot digest.
11. Replace the persistent graph projection and snapshot in one transaction.

If collection finds no supported files, or supported files produce no graph nodes, analysis returns a typed `AnalysisError` instead of publishing a false fresh/empty result. If transactional persistence fails, the previous snapshot remains visible.

## Production parser registry

`createDefaultParsers()` returns a fresh ordered registry for every run:

1. Prisma
2. Next.js App Router
3. Next.js Pages Router
4. tRPC
5. TSRPC
6. Express
7. TypeORM
8. frontend API calls
9. React components
10. NestJS controller, module, and service
11. Drizzle
12. Kotlin base declarations
13. Spring Kotlin
14. Ktor
15. Room
16. Exposed

Each parser implements the shared `Parser` interface:

```typescript
interface Parser {
  name: string
  canHandle(filePath: string, projectMeta: ProjectMeta): boolean
  parse(filePath: string, context: ParseContext): Promise<ParseResult>
}
```

Parsers do not import one another and do not access persistent storage. They return nodes, edges, and diagnostics to `GraphBuilder`. A parser that cannot interpret one file returns empty output plus a warning; `GraphBuilder` also catches unexpected parser failures so one file cannot terminate the project analysis.

## Test adapter registry

After production parsing, `createDefaultTestAdapters()` runs Playwright, Cypress, Vitest/Jest, JUnit, and Kotest adapters over candidate files. Adapters use the same degradation rule and never access storage. Their outputs are linked after production nodes exist, which lets every `tests`, `uses_fixture`, and `covers` edge pass the same endpoint validation.

Static discovery is the default. `analyze`, `serve`, MCP, and REST never run target tests. See [Test intelligence](../guides/test-intelligence.md) for recognized syntax, explicit `test-run`, and bounded JUnit XML imports.

## Cross-layer linking

The linker consumes the combined production/test graph and resolves:

- component/page → API or procedure (`calls_api`);
- API/procedure → handler (`handles`);
- handler → service (`calls_service`);
- handler/service → model (`queries_db`);
- Kotlin route, function, class, and data relationships;
- test case → production target (`covers`).

Direct imports, resolved symbols, direct calls, and explicit fixture scope produce `certain` evidence. Pattern, route-string, or unresolved-but-unique matches produce `inferred` evidence. Competing duplicate observations keep the strongest confidence.

## Snapshot consumers

- CLI `analyze --json` emits the versioned snapshot envelope.
- `serve` and the React workbench read the same persisted graph through REST and receive freshness notifications through WebSocket.
- MCP tools attach the same committed snapshot to query results.

The cross-surface contract suite verifies identical digests and node/edge IDs across all three surfaces, including a mixed Vitest/Jest/Playwright/Cypress/JUnit/Kotest fixture.
