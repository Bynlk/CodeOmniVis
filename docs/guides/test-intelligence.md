# Test intelligence

CodeOmniVis discovers test structure while it analyzes application code and projects both through the same versioned `ProjectSnapshot`. The Tests workbench view, CLI JSON output, `GET /api/tests`, and MCP `get_test_coverage` tool therefore refer to the same node IDs, edge IDs, and `snapshotDigest`.

This feature is static test intelligence, not runtime code coverage. A `covers` edge means that source evidence links a test case to a production node; it does not prove that the target line executed or passed.

## Supported discovery

| Framework | Recognized static constructs |
| --- | --- |
| Vitest | `describe`, `it`, `test`, `xit`, `xtest`, `.skip`, `.each`, and `beforeAll`/`beforeEach`/`afterEach`/`afterAll`, selected by an import from `vitest` |
| Jest | The same suite, case, parameterization, skip, and lifecycle constructs, selected by `@jest/globals` or explicit Jest evidence |
| Playwright | `test.describe`, test cases, `.skip`, `test.extend({...})` fixtures, and destructured fixture parameters, selected by `@playwright/test` |
| Cypress | `describe`/`context`, `it`/`test`, skip modifiers, lifecycle hooks, `cypress/e2e` paths, Cypress imports, and `cy.visit`/`cy.request` evidence |
| JUnit 4 | Classes, `@Test`, `@Before`/`@After`, and `@Ignore`, selected from `org.junit.*` imports |
| JUnit 5 | Classes and nested classes, `@Test`, `@ParameterizedTest`, `@MethodSource`, `@ValueSource`, `@BeforeEach`/`@AfterEach`, `@BeforeAll`/`@AfterAll`, and `@Disabled`, selected from `org.junit.jupiter.*` imports |
| Kotest | `FunSpec`, `StringSpec`, `BehaviorSpec`, and `DescribeSpec` suites; literal `test("...")` cases; and `beforeEach`/`beforeSpec`/`afterEach`/`afterSpec` hooks |

Only statically readable names become nodes. A parameterized declaration is one stable `test_case`; CodeOmniVis records its parameter-source expression but does not invent runtime rows. Dynamic names and custom DSL extensions that cannot be resolved safely are skipped. Runtime rows can be retained only through an explicit JUnit XML import.

Adapter failures follow the project-wide degradation rule: that file contributes an empty test result plus a warning, while production analysis continues.

## Graph model and confidence

Test discovery adds three node types:

- `test_suite` — a file, `describe` block, class, nested class, or Kotest spec;
- `test_case` — one statically named test declaration;
- `test_fixture` — a lifecycle hook or declared fixture factory.

It adds three edge types:

- `tests`: suite → case containment;
- `uses_fixture`: case → fixture usage;
- `covers`: case → production target based on static evidence.

Every edge has existing endpoints and a confidence value:

- `certain` — direct function call, lexical lifecycle scope, or explicit fixture parameter;
- `inferred` — direct import without a confirmed call, or a literal route reference.

Coverage edges are deduplicated by source, type, and target. If multiple observations identify the same edge, `certain` evidence wins over `inferred` evidence.

## Default safety: analysis never runs tests

`serve`, `analyze`, `check`, MCP startup, and all REST requests only read source and previously imported result files. They never invoke npm, pnpm, Gradle, Vitest, Jest, Playwright, or Cypress in the target project.

Execution is available only through the explicit bounded command:

```bash
npx @bynlk/codeomnivis test-run \
  --project /absolute/path/to/repository \
  --runner vitest \
  --timeout 600000 \
  -- tests/orders.test.ts
```

Accepted runners are `vitest`, `jest`, `playwright`, `cypress`, and a project-root `gradlew`. The runner is started with an argument array and `shell: false`; the working directory is the validated project root. Timeouts must be between 1 second and 30 minutes. Output is capped at 10 MiB, and timeout cleanup sends `SIGTERM` before `SIGKILL`. Absolute argument paths outside the project and NUL-containing arguments are rejected.

A failing test process reports its original exit code and does not replace the last static snapshot.

## Importing JUnit XML

Import existing results without executing a test process:

```bash
npx @bynlk/codeomnivis analyze --project /absolute/path/to/repository --json
npx @bynlk/codeomnivis test-import \
  --project /absolute/path/to/repository \
  --junit 'build/test-results/**/*.xml'
```

`test-import` accepts files only inside the project root, does not follow escaping symlinks, rejects files larger than 10 MiB, disables XML entity processing, and rejects `DOCTYPE` or `ENTITY` declarations before parsing. Imported pass/fail/skip cases are stored in snapshot provenance. Unmatched runtime rows remain provenance and never fabricate graph nodes.

`test-run --junit <path>` performs the same import after the explicitly requested runner exits.

## Web, REST, and MCP projections

The Tests workbench view groups suite → case, exposes framework filters, and focuses `covers` edges when a case is selected.

REST:

```text
GET /api/tests
GET /api/tests?framework=vitest
GET /api/tests?target=OrdersService
```

The response contains `suites`, `cases`, `fixtures`, `coverage`, a summary, and `meta.snapshotId`/`meta.snapshotDigest`.

MCP:

```json
{
  "name": "get_test_coverage",
  "arguments": {
    "framework": "junit5",
    "target": "Order"
  }
}
```

The MCP result uses the same projection and includes the committed snapshot. CLI `analyze --json` exposes the complete snapshot envelope for automation.

## Performance and limits

The repository gate generates 1,000 deterministic Vitest files and requires complete project analysis, including test discovery, to finish in under 60 seconds. The current local verification completed in about 1.2 seconds; CI enforces the 60-second cross-machine contract rather than that local observation.

Static discovery cannot expand runtime-generated names, reflective test registration, custom Kotest DSL extensions, or parameter rows created only during execution. Imported results enrich provenance but do not turn CodeOmniVis into a line-coverage collector.
