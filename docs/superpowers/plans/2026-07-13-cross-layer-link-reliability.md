# Cross-Layer Link Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce stable, evidence-backed frontend → API/tRPC → handler → service → database paths in the official demo without ambiguous file-wide links.

**Architecture:** `TrpcParser` provides stable router identities. `CrossLayerLinker` delegates source-scoped service and DB discovery to focused resolver modules; symbol tracing remains first choice and scoped AST extraction is the fallback. The demo contains both REST-through-service and direct tRPC resolver paths, verified by exact edge identities.

**Tech Stack:** TypeScript, ts-morph, Vitest, Prisma schema fixtures, pnpm/Turborepo.

---

## File Structure

- Modify `packages/analyzer/src/parsers/trpc.ts`: propagate normalized router identity to procedure metadata.
- Modify `packages/analyzer/__tests__/parsers/trpc.test.ts`: router identity and chained procedure regressions.
- Create `packages/analyzer/src/resolver/sourceScope.ts`: resolve real source paths and locate handler/procedure/service AST scopes.
- Create `packages/analyzer/src/resolver/serviceLinkResolver.ts`: link only service symbols called inside a caller scope.
- Create `packages/analyzer/src/resolver/dbCallResolver.ts`: symbol-first and scoped-fallback DB call extraction.
- Create focused resolver tests under `packages/analyzer/__tests__/resolver/`.
- Modify `packages/analyzer/src/resolver/crossLayer.ts`: delegate TypeScript service and DB links to focused resolvers.
- Modify `packages/analyzer/__tests__/resolver/crossLayer.test.ts`: exact tRPC and multi-handler isolation tests.
- Modify `demo/package.json`: declare tRPC and Zod dependencies used by demo source.
- Create `demo/server/services/bookingService.ts` and `demo/server/services/userService.ts`.
- Modify demo REST routes and frontend components to exercise REST and tRPC paths.
- Create `packages/cli/__tests__/integration/demoCrossLayer.test.ts`: exact end-to-end paths, stability, and dangling-edge assertions.
- Modify `demo/README.md` and `docs/plans/changelog.md`: document expected paths and verification evidence.

### Task 1: Stable tRPC Router Identity

**Files:**
- Modify: `packages/analyzer/__tests__/parsers/trpc.test.ts`
- Modify: `packages/analyzer/src/parsers/trpc.ts`

- [x] **Step 1: Write the failing router identity test**

Parse `server/routers/booking.ts` and assert every real child procedure has router key `booking`, while the declaration node remains distinguishable as `bookingRouter`.

```ts
const procedures = result.nodes.filter(node =>
  isNodeOfType(node, 'trpc_procedure') && ['list', 'getById', 'create'].includes(node.name)
)
expect(procedures.map(node => node.metadata.routerName)).toEqual(['booking', 'booking', 'booking'])
```

- [x] **Step 2: Run the parser test and verify RED**

```bash
pnpm --filter @codeomnivis/analyzer test -- trpc.test.ts
```

Expected: FAIL because procedure metadata currently contains `routerName: "unknown"`.

- [x] **Step 3: Implement router key propagation**

Derive the declaration name once per `createTRPCRouter` call, normalize a terminal `Router` suffix, and pass the key into `parseProcedures`.

```ts
function routerKey(declarationName: string): string {
  const normalized = declarationName.replace(/Router$/, '')
  return normalized.length > 0 ? normalized : declarationName
}
```

- [x] **Step 4: Verify GREEN**

Run the Task 1 test command. Expected: all tRPC parser tests PASS.

### Task 2: Exact tRPC Hook Matching

**Files:**
- Modify: `packages/analyzer/__tests__/resolver/crossLayer.test.ts`
- Modify: `packages/analyzer/src/resolver/crossLayer.ts`

- [x] **Step 1: Write a failing same-name procedure test**

Create `booking.getById` and `user.getById` nodes plus a `trpc.booking.getById.useQuery` placeholder. Assert the resolved edge targets only the booking procedure.

- [x] **Step 2: Run and verify RED**

```bash
pnpm --filter @codeomnivis/analyzer test -- crossLayer.test.ts
```

Expected: FAIL if matching falls back to procedure name without the router identity.

- [x] **Step 3: Make exact metadata matching authoritative**

Match `(routerName, procedureName)` first. Keep exact full-name compatibility only when node metadata itself represents that same pair; do not choose the first same-named procedure.

- [x] **Step 4: Verify GREEN**

Run the Task 2 command. Expected: selected tests PASS.

### Task 3: Source Scope and Real Import Resolution

**Files:**
- Create: `packages/analyzer/src/resolver/sourceScope.ts`
- Create: `packages/analyzer/__tests__/resolver/sourceScope.test.ts`

- [x] **Step 1: Write failing source resolution tests**

Cover extensionless `./bookingService`, directory `./services`, a missing import, a Next `GET` function, a tRPC `getById` property, and an exported service function.

```ts
expect(resolveSourceImport(projectRoot, routeFile, '../../../server/services/bookingService'))
  .toBe('server/services/bookingService.ts')
expect(findCallerScope(sourceFile, trpcHandler)?.getStartLineNumber()).toBe(12)
```

- [x] **Step 2: Run and verify RED**

```bash
pnpm --filter @codeomnivis/analyzer test -- sourceScope.test.ts
```

Expected: FAIL because the module does not exist.

- [x] **Step 3: Implement focused source utilities**

Use a small ts-morph `Project` and resolve only existing files through `.ts`, `.tsx`, `.js`, `.jsx`, and `index.*`. Locate scopes by `HandlerMetadata.functionName`, tRPC property name, or `ServiceMetadata.methodName`. Catch parse/read failures and return `null`.

- [x] **Step 4: Verify GREEN**

Run the Task 3 command. Expected: selected tests PASS.

### Task 4: Scoped Handler-to-Service Links

**Files:**
- Create: `packages/analyzer/src/resolver/serviceLinkResolver.ts`
- Create: `packages/analyzer/__tests__/resolver/serviceLinkResolver.test.ts`
- Modify: `packages/analyzer/src/resolver/crossLayer.ts`

- [x] **Step 1: Write a failing handler isolation test**

Use one route file with `GET` calling `listBookings` and `POST` calling `createBooking`, imported from separate service files. Assert each handler receives only its called service edge and every service node points to an existing file.

- [x] **Step 2: Run and verify RED**

```bash
pnpm --filter @codeomnivis/analyzer test -- serviceLinkResolver.test.ts
```

Expected: FAIL because current file-wide import matching connects every handler to every imported service.

- [x] **Step 3: Implement scoped service resolution**

For each handler, inspect call expressions inside `findCallerScope`. Match local named/default import bindings, resolve the import to a real source file, and return real service nodes plus `certain` edges. Skip missing or merely imported-but-unused services.

- [x] **Step 4: Delegate from `CrossLayerLinker`**

Replace `extractServiceImports`, extensionless path handling, and the file-wide TypeScript handler loop with `ServiceLinkResolver`. Preserve Kotlin handling.

- [x] **Step 5: Verify GREEN**

Run the Task 4 command and `crossLayer.test.ts`. Expected: selected tests PASS.

### Task 5: Scoped Database Fallback

**Files:**
- Create: `packages/analyzer/src/resolver/dbCallResolver.ts`
- Create: `packages/analyzer/__tests__/resolver/dbCallResolver.test.ts`
- Modify: `packages/analyzer/src/resolver/crossLayer.ts`

- [x] **Step 1: Write failing DB isolation tests**

Create two tRPC procedures in one file: one queries `ctx.prisma.booking`, the other `ctx.prisma.user`. Represent them through resolver handler nodes and assert each handler links only to its own model. Add a mocked symbol result with zero calls and assert scoped fallback still finds the correct DB call.

- [x] **Step 2: Run and verify RED**

```bash
pnpm --filter @codeomnivis/analyzer test -- dbCallResolver.test.ts
```

Expected: FAIL because empty symbol results currently suppress fallback and file-wide scanning is ambiguous.

- [x] **Step 3: Implement symbol-first scoped extraction**

Use `SymbolResolver.traceHandlerToDb` when available. If it returns zero calls, inspect call expressions only inside `findCallerScope` and extract supported Prisma/TypeORM expressions. Attribute a tRPC procedure property's calls to its synthetic resolver handler. Deduplicate by caller/model/operation.

- [x] **Step 4: Restrict ambiguous fallback**

Use whole-file regex only when the file contains one eligible caller; mark those calls `inferred`. With multiple unscoped callers, return no calls.

- [x] **Step 5: Delegate from `CrossLayerLinker` and verify GREEN**

Replace its TypeScript DB loop with `DbCallResolver`, preserving existing Kotlin DB edges. Run Task 5 tests plus `crossLayer.test.ts` and `symbolResolver.test.ts`.

### Task 6: Representative Demo Paths

**Files:**
- Modify: `demo/package.json`
- Create: `demo/server/services/bookingService.ts`
- Create: `demo/server/services/userService.ts`
- Modify: `demo/app/api/booking/route.ts`
- Modify: `demo/app/api/user/route.ts`
- Modify: `demo/components/BookingList.tsx`
- Modify: `demo/components/UserProfile.tsx`

- [x] **Step 1: Write the failing demo integration test shell**

Create `packages/cli/__tests__/integration/demoCrossLayer.test.ts`, auto-detect the real demo, run analysis into an in-memory DB, and assert the four core edge types are present. At this point it must fail for missing calls/service paths.

- [x] **Step 2: Run and verify RED**

```bash
pnpm --filter @codeomnivis/analyzer build
pnpm --filter @bynlk/codeomnivis test -- demoCrossLayer.test.ts
```

- [x] **Step 3: Add coherent demo dependencies and services**

Declare `@trpc/server` and `zod`. Export named booking/user service functions that contain Prisma calls. Keep files parser-friendly and internally coherent.

- [x] **Step 4: Route REST handlers through services**

Use extensionless relative named imports and make GET/POST call distinct service functions so handler isolation is exercised.

- [x] **Step 5: Exercise both REST and tRPC clients**

Make `BookingList` fetch `/api/booking`; keep `BookingDetail` on `trpc.booking.getById`; make `UserProfile` fetch `/api/user` while other tRPC procedures remain in the sample.

- [x] **Step 6: Verify GREEN**

Build Analyzer and rerun the integration test. Expected: exact REST-through-service and tRPC-to-DB paths PASS.

### Task 7: Stability and Full Verification

**Files:**
- Modify: `packages/cli/__tests__/integration/demoCrossLayer.test.ts`
- Modify: `demo/README.md`
- Modify: `docs/plans/changelog.md`

- [x] **Step 1: Add final graph invariants**

Assert zero dangling edges, no persisted target containing `:unknown:`, at least one of every core cross-layer edge, and equal sorted node/edge ID sets across two runs.

- [x] **Step 2: Run package suites**

```bash
pnpm --filter @codeomnivis/analyzer test
pnpm --filter @bynlk/codeomnivis test
pnpm --filter @codeomnivis/server test
```

- [x] **Step 3: Run repository verification**

```bash
pnpm typecheck
pnpm lint
pnpm exec turbo build --force
```

- [x] **Step 4: Run the official demo command twice**

Write outputs to `/tmp`, compare sorted node and edge IDs, and inspect edge-type counts and exact path endpoints.

- [x] **Step 5: Update docs and changelog**

Document the REST and tRPC paths, exact verification counts, and any remaining third-batch frontend issues. Run `git diff --check`. Do not commit.
