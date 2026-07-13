# Unified Quality Workbench Design

## Context

The Web Quality view currently reads only `GET /api/graph/errors`. An empty response means the parser completed without recoverable errors, but the interface presents that result as if the project had no quality findings.

The same analyzed graph already produces two other classes of findings outside the Web UI:

- `codeomnivis check` runs `ConsistencyChecker` and reports graph consistency risks.
- `codeomnivis analyze` runs `AuthDetector`, `NPlusOneDetector`, and `RSCBoundaryDetector` and reports source-level risks.

On the official demo on 2026-07-13, the evidence is:

- parser errors: 0
- authentication findings: 6 critical `unguarded_route` issues
- consistency findings: 7 warning `dead_route` issues

Therefore, the Web statement “0 findings” is semantically incorrect even though its parser-error count is technically correct.

## Product Decision

Quality is one workspace that presents all deterministic findings from the latest analysis. It is not a parser log and it is not an AI review.

The view combines:

1. recoverable parser output;
2. graph consistency findings;
3. authentication findings;
4. N+1 query findings;
5. React Server Component boundary findings.

Every row identifies its source, severity, type, message, and best available source location. The UI must never display a healthy empty state if one request failed or one detector failed.

## Considered Approaches

### 1. Separate issues endpoint and client-side merge — selected

Add `GET /api/graph/issues` for deterministic project risks. Keep `GET /api/graph/errors` as the parser-output contract. The UI normalizes and merges both responses.

This preserves clear ownership, reuses the existing detectors, avoids a storage migration, and lets parser errors remain useful to existing clients.

### 2. One merged `/api/quality` endpoint

The server could merge parser errors and project issues. This would reduce one request, but it would couple two existing contracts and make parser-error consumers depend on risk-detector execution.

### 3. Persist all issues in SQLite

The analysis pipeline could write findings beside nodes, edges, and parser errors. This would support historical queries, but it introduces schema migration, invalidation, and detector-version concerns that are not needed for the current product.

## API Contract

`GET /api/graph/issues` returns the standard REST envelope:

```json
{
  "data": [
    {
      "id": "auth-handler:app/api/user/route.ts:GET",
      "source": "security",
      "severity": "critical",
      "type": "unguarded_route",
      "description": "API route \"GET /api/user\" has no authentication guard",
      "locations": [{ "file": "app/api/user/route.ts", "line": 4 }],
      "relatedNodeIds": ["handler:app/api/user/route.ts:GET"],
      "relatedEdgeIds": []
    }
  ],
  "meta": {
    "count": 1,
    "critical": 1,
    "warning": 0,
    "info": 0,
    "detectors": [
      { "id": "consistency", "status": "complete" },
      { "id": "auth", "status": "complete" },
      { "id": "n_plus_one", "status": "complete" },
      { "id": "rsc", "status": "complete" }
    ]
  }
}
```

Shared types define the source, detector status, and optional structured message contract so Server and UI cannot drift. Runtime validation remains at the UI network boundary. Detector findings keep the English `description` as a backward-compatible fallback and add `messageKey` plus primitive `messageParams` for presentation-layer localization.

The Server runs each detector independently. If one detector throws, the route still returns findings from the others and marks that detector as `failed` with a safe message. A failed detector must not turn into an empty healthy state.

## Server Architecture

A focused `graphIssues.ts` module owns detector orchestration:

- load the sanitized graph from the database;
- run `ConsistencyChecker`, `AuthDetector`, `NPlusOneDetector`, and `RSCBoundaryDetector`;
- attach the source labels `consistency`, `security`, `performance`, and `framework`;
- catch failures per detector;
- de-duplicate by stable issue ID;
- sort by severity and location for deterministic output;
- calculate the response summary.

The graph router only loads current inputs, calls the collector, and returns a REST response. It receives the active project root through a provider function so runtime project switching is reflected without rebuilding the router.

## UI Architecture

The UI adds:

- `getGraphIssues` with strict response validation;
- `useGraphIssues` using the `['graph-issues']` query key;
- a pure `mergeQualityFindings` view-model function;
- updated Quality canvas, explorer, header, and rail counts.

The normalized UI severity order is:

1. critical;
2. error;
3. warning;
4. info.

Parser findings use source `parser` and retain `error | warning | info`. Project issues retain `critical | warning | info` and use the source supplied by the Server.

The main list shows severity, source, issue type, description, and `file:line`. When the project root is available, the location is a VS Code source link using the existing URI builder. The explorer summarizes severity and source counts without duplicating the full list.

## Loading, Partial Failure, and Empty States

- While both requests are pending, show the existing restrained skeleton.
- If one request succeeds and the other fails, show the successful findings plus a partial-results notice.
- If a detector reports `failed`, show a partial-results notice naming that detector.
- If both requests fail, show the unavailable state.
- Show “No quality findings” only when both requests succeeded, every detector completed, and the merged list is empty.

This distinction is required for a trustworthy developer tool.

## Refresh and Project Switching

The `['graph-issues']` query is invalidated by all existing analysis state transitions:

- manual Refresh;
- successful project switch;
- WebSocket `graph_updated`;
- the shared analysis-query invalidation helper.

Project-root lookup is dynamic on the Server and the UI source-link root remains invalidated on project switch through the existing project query.

## Internationalization and Accessibility

All new copy is provided in English and Simplified Chinese. Source, severity, type, and every deterministic detector description are translated. Detectors emit a stable `messageKey` and string/number parameters rather than requiring the UI to parse English prose. The UI falls back to `description` when a future or older detector omits structured message data. Parser messages remain raw parser output because they may contain arbitrary compiler/library diagnostics that must not be rewritten.

The Quality list is a semantic ordered list. Partial and total failures use `role="status"` or `role="alert"` as appropriate. Source-location links have descriptive accessible labels and visible keyboard focus.

## Performance

The issues query does not poll. It runs on initial load and after explicit analysis invalidation. The detector endpoint performs no additional project analysis and reads the current graph plus the source files needed by existing detectors.

No new dependency is introduced.

## Acceptance Criteria

1. The official demo returns 13 project issues: 6 critical authentication findings and 7 warning consistency findings.
2. With zero parser errors, the Web Quality view shows those 13 issues and never shows a healthy empty state.
3. Parser errors and project issues display source, severity, type, and location.
4. A single detector failure yields partial results and an explicit degraded-state notice.
5. Refresh, WebSocket graph updates, and project switching invalidate both parser errors and project issues.
6. English and Chinese Quality copy render without mixed hard-coded UI labels or English-only deterministic descriptions; raw parser diagnostics remain unchanged.
7. Server, UI, shared-package, and full-repository tests, typechecks, lint, and builds pass.
8. Real browser verification shows no console warnings or errors at desktop and narrow viewport widths.
