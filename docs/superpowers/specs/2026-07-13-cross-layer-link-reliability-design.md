# Cross-Layer Link Reliability Design

**Date:** 2026-07-13
**Status:** Awaiting written-spec approval
**Scope:** Second repair batch — reliable frontend call, tRPC, handler, service, and database links plus a representative demo.

## 1. Problem

The canonical analysis pipeline now scans the full workspace, but the official demo still does not demonstrate a complete cross-layer request path. Its current graph contains REST handlers and direct Prisma links, yet no frontend `calls_api` edge and no `calls_service` edge.

Confirmed causes:

- `demo/package.json` does not declare `@trpc/server`, so automatic detection leaves the backend framework unknown and disables `TrpcParser`.
- `TrpcParser` records each procedure with `routerName: "unknown"`, so `trpc.booking.list.useQuery()` cannot match a parsed `list` procedure even when tRPC parsing is forced on.
- symbol tracing may return an empty DB-call set without throwing; the resolver treats that as success and never runs its documented fallback.
- the demo contains no service modules, so a trustworthy analyzer should not invent `calls_service` edges.
- imported service paths are currently kept without resolving `.ts`, `.tsx`, or `index.ts`, preventing later DB tracing from reading the actual file.
- file-wide fallback scanning can attach every DB call to every handler in the same file, producing visually convincing but false edges.

## 2. Chosen Approach

Repair analyzer contracts and make the demo exercise those contracts explicitly.

Alternatives considered:

- **Demo-only rewiring:** adjust the sample until existing regexes produce edges. Fast, but hides general parser defects and does not protect user projects.
- **Broad file heuristics:** connect every caller in a file to every service/DB reference in that file. Produces more edges, but undermines the product's “trusted architecture” positioning.
- **Chosen — contract-first plus representative demo:** preserve direct evidence where available, use scoped fallback only when symbol resolution is empty, and update the demo to contain real REST, tRPC, service, and Prisma paths.

## 3. Architecture

### 3.1 tRPC identity

`TrpcParser` will derive a router key from its declaration:

- `bookingRouter` → `booking`
- `userRouter` → `user`
- a declaration already named `booking` remains `booking`

Every child procedure receives this router key in `metadata.routerName`; the router container and procedure names remain stable and continue to use the existing node ID format. `CrossLayerLinker` will match hooks by the exact `(routerName, procedureName)` pair before any fallback.

No edge is emitted when the hook has no matching procedure. Unresolved placeholder edges remain temporary analysis evidence and are removed before persistence.

### 3.2 Handler and service calls

Service resolution will use both import declarations and actual calls inside the caller's source range:

1. Resolve relative imports against `projectRoot`.
2. Resolve extensionless paths through `.ts`, `.tsx`, `.js`, `.jsx`, and `index.*` candidates.
3. Confirm the imported service symbol is called by the specific handler/procedure resolver.
4. Create or reuse a service node tied to the real source file.
5. Emit `calls_service` with `certain` confidence when both import and call are explicit; use `inferred` only for a documented fallback.

Merely importing a service somewhere in a file is not sufficient to connect every handler in that file.

### 3.3 Scoped database tracing

DB tracing remains symbol-first. An empty symbol result is treated as “not resolved,” not as proof that no DB call exists.

Fallback order:

1. Inspect the exact AST body represented by the caller node: Next.js method handler, tRPC property resolver, exported service function, or class method.
2. Extract supported Prisma/TypeORM calls from that body.
3. If exact scoping cannot be recovered and the file has only one eligible caller, scan the file with `inferred` confidence.
4. If the file has multiple callers and cannot be scoped, emit no DB edge rather than attaching ambiguous calls to all callers.

For tRPC, the procedure property supplies the source range, while its resolver handler is the edge source. This preserves `procedure -> handles -> resolver -> queries_db` instead of skipping the handler layer.

This preserves the “degrade rather than crash” rule without turning parser uncertainty into false graph certainty.

### 3.4 Representative demo

The demo will declare the dependencies used in its source and add real service files:

- `server/services/bookingService.ts`
- `server/services/userService.ts`

REST handlers will call those services, and services will call Prisma. Frontend components will contain at least one recognized REST call while existing tRPC hooks remain to exercise tRPC matching.

The demo is an analyzer fixture, not a production application, but its imports and dependency declarations must be internally coherent.

## 4. Expected Paths

At least these path shapes must be present after analysis:

```text
BookingList component
  -> calls_api -> /api/booking
  -> handles -> GET handler
  -> calls_service -> booking service
  -> queries_db -> Booking
```

```text
BookingDetail component
  -> calls_api -> booking.getById tRPC procedure
  -> handles -> getById resolver
  -> queries_db -> Booking
```

Equivalent user paths are required for `/api/user` or `user.me`, but tests will assert identities rather than only aggregate counts.

## 5. Error Handling

- Parser and resolver failures return warnings and continue analyzing other files.
- Missing service files produce no `calls_service` edge and an optional diagnostic; they do not create unreadable fake file paths.
- Ambiguous procedure/service/DB matches produce no edge unless a single documented inferred match exists.
- Every persisted edge must reference nodes present in the final graph and include confidence.
- Repeated analysis must produce the same edge IDs and counts.

## 6. Testing Strategy

All behavior changes follow RED → GREEN → REFACTOR.

Required tests:

1. `TrpcParser` propagates `bookingRouter` as router key `booking` to every procedure.
2. A tRPC hook resolves to the correct procedure and not to a same-named procedure in another router.
3. Extensionless relative service imports resolve to their real source file.
4. Two handlers in one file calling different services receive only their own `calls_service` edge.
5. Empty symbol tracing falls back to scoped AST DB extraction.
6. Two procedures in one router querying different models receive only their own `queries_db` edge.
7. Syntax or resolution failures degrade without aborting the graph.
8. Demo integration asserts exact frontend → API/tRPC → handler → service/DB paths.
9. Demo final graph has at least one edge of each core cross-layer type: `calls_api`, `handles`, `calls_service`, and `queries_db`.
10. Demo final graph has zero dangling edges and is stable across two consecutive analyses.

## 7. Acceptance Criteria

- Automatic demo detection enables tRPC using declared dependencies.
- The demo contains a verified REST path through a real service to a Prisma model.
- The demo contains a verified tRPC hook path to the correct procedure and DB model.
- No cross-layer edge uses an `unknown` target in the persisted graph.
- No handler is connected to a service or model referenced only by a different handler in the same file.
- Analyzer and CLI regression suites, typecheck, lint, and forced uncached build pass.
- Running the official demo analysis twice produces stable node/edge identities.

## 8. Out of Scope

- WebSocket Origin/backoff, unavailable frontend states, per-view errors, i18n cleanup, Settings, and mobile drawer fixes (third batch).
- Adding a generic application runtime or making the demo deployable.
- Broad refactoring unrelated to TypeScript cross-layer links.
- Overwriting or committing existing uncommitted user changes.
