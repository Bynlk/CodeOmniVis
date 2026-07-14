# CodeOmniVis data model

CodeOmniVis stores one versioned `ProjectSnapshot` and projects it through CLI, REST, Web, and MCP. The snapshot is the semantic contract; the SQLite tables are its local transactional persistence.

## ProjectSnapshot

`ProjectSnapshot` schema version 1 contains:

- `snapshotId` — identity for one committed analysis;
- `snapshotDigest` — deterministic SHA-256 digest of semantic content;
- `project` — normalized root, project fingerprint, and detected framework metadata;
- `graph` — typed nodes and edges;
- `issues` and `parseErrors` — deterministic findings and recoverable diagnostics;
- `stats` and `freshness` — counts and current analysis state;
- `provenance` — analyzer version, source digest, files scanned, and optional imported test runs.

The digest excludes wall-clock fields such as generation time and normalizes the project root, ordering, and imported test results. Re-analyzing unchanged source through another surface must therefore produce the same digest.

## Node contract

Node IDs use `{type}:{filePath}:{name}`. `OmniNode` is a closed discriminated union: each `type` has its own metadata contract.

| Group | Node types |
| --- | --- |
| Web and API | `page`, `component`, `api_route`, `trpc_procedure`, `express_route`, `handler`, `service`, `module` |
| TSRPC | `tsrpc_service`, `tsrpc_api`, `tsrpc_msg` |
| Data | `db_model` |
| Kotlin | `kotlin_class`, `kotlin_interface`, `kotlin_object`, `kotlin_function`, `kotlin_route` |
| Tests | `test_suite`, `test_case`, `test_fixture` |

Test metadata records one of `vitest`, `jest`, `playwright`, `cypress`, `junit4`, `junit5`, or `kotest`. A parameterized declaration is one stable `test_case`; imported runtime rows are provenance, not additional graph nodes.

## Edge contract

Edge IDs use `{sourceId}--{type}--{targetId}`. Source and target must exist before an edge is committed. Every edge carries `confidence: "certain" | "inferred"` and type-specific metadata.

| Group | Edge types |
| --- | --- |
| UI and modules | `renders`, `navigates_to`, `imports`, `contains` |
| Cross-layer calls | `calls_api`, `handles`, `calls_service`, `queries_db`, `data_flows_to` |
| Data and messages | `db_relation`, `sends_msg`, `listens_msg` |
| Kotlin | `kotlin_inherits`, `kotlin_implements`, `kotlin_uses` |
| Tests | `tests`, `covers`, `uses_fixture` |

For test intelligence:

- `tests` links a suite to a case;
- `uses_fixture` links a case to lexical, parameter, or explicit fixture evidence;
- `covers` links a case to a production node using `direct_call`, `direct_import`, `route_reference`, or imported `source_mapping` evidence.

`covers` is a static relationship and must not be interpreted as runtime line or branch coverage. See [Test intelligence](../guides/test-intelligence.md).

## Transactional SQLite storage

The local `sql.js` cache uses these tables:

- `schema_meta` — cache schema version;
- `nodes` and `edges` — queryable graph projection, with foreign keys on edge endpoints;
- `parse_errors` — recoverable diagnostics;
- `project_meta` — key/value compatibility metadata;
- `snapshots` — serialized canonical snapshot payload.

Indexes cover node type/file, edge source/target/type, and error file/severity. Snapshot replacement deletes the previous projection and writes nodes, validated edges, errors, metadata, and the latest snapshot in one transaction. A failed replacement rolls back, so readers continue to see the prior committed snapshot.

The default persistent cache path is `~/.codeomnivis/projects/{project-hash}.db`; tests may use an in-memory database.
