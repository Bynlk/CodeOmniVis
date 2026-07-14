# cal.com validation

This is a reproducible compatibility measurement, not a claim that every cal.com runtime dependency or generated route is resolved.

## Fixed inputs

- cal.com revision: `f00434927386c9ecdcbd7e6c5f82d22044a245bc`
- CodeOmniVis revision: `003ff84ef6d652f93e5aa849ba59714cf2ef4e68`
- capture date: 2026-07-14
- host: Darwin 25.2.0 arm64
- Node.js: v26.3.1
- target dependency install: none; CodeOmniVis performed static analysis directly on the shallow checkout

The repository was obtained with:

```bash
git clone --depth 1 --filter=blob:none --no-tags https://github.com/calcom/cal.com.git
```

Validation command:

```bash
/usr/bin/time -p node packages/cli/dist/index.js analyze \
  --project /tmp/codeomnivis-calcom-f004 \
  --json
```

## Measured result

```codeomnivis-cal-validation
revision=f00434927386c9ecdcbd7e6c5f82d22044a245bc
duration_ms=50150
files_scanned=2243
nodes=3223
edges=4413
parse_errors=0
issues=1676
snapshot_digest=0cf9c6e0efdc421af6a55c9530117b0e366b9a74d168c77385f435bd874dc599
```

`/usr/bin/time -p` reported 50.15 seconds wall time, 37.32 seconds user CPU, and 5.74 seconds system CPU. The run completed below the project’s 60-second target and emitted one committed snapshot.

Selected node counts:

| Type | Count |
| --- | ---: |
| `api_route` | 260 |
| `handler` | 351 |
| `service` | 111 |
| `page` | 103 |
| `component` | 609 |
| `db_model` | 103 |
| `test_suite` | 492 |
| `test_case` | 1,021 |
| `test_fixture` | 121 |

Selected edge counts:

| Type | Count |
| --- | ---: |
| `handles` | 435 |
| `renders` | 1,242 |
| `db_relation` | 320 |
| `tests` | 1,016 |
| `uses_fixture` | 936 |
| `covers` | 429 |
| `calls_api` | 11 |
| `queries_db` | 24 |

## Interpretation and limits

- `parse_errors=0` means no parser produced a stored warning/error for this revision; it does not prove semantic completeness.
- The relatively small `calls_api` and `queries_db` counts show that cal.com’s generated clients, workspace aliases, and runtime indirection remain harder than the deterministic repository Demo.
- `issues=1676` is untriaged deterministic output and must not be treated as 1,676 confirmed defects.
- Static test `covers` edges are source-evidence links, not runtime line coverage.
- Wall time varies by machine and filesystem cache. CI enforces a deterministic 1,000-file synthetic performance contract separately.
