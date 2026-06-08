#!/bin/bash
# CodeOmniVis TSRPC 支持 — Push + PR 脚本
# 使用前请替换 <YOUR_TOKEN> 为你的 GitHub PAT

set -e

# ====== 方式 1：用 token 推送 ======
# git remote set-url origin https://<YOUR_TOKEN>@github.com/Bynlk/CodeOmniVis.git
# git push origin master

# ====== 方式 2：用 SSH 推送 ======
# git remote set-url origin git@github.com:Bynlk/CodeOmniVis.git
# git push origin master

# ====== 创建 PR ======
# 推送后执行：

cat << 'EOF'
PR 内容：

Title: feat: add TSRPC framework support

Body:

## Summary

Add full TSRPC (TypeScript RPC) framework support to CodeOmniVis, enabling automatic analysis of TSRPC projects with zero configuration.

### What's new

**Parser (`TsrpcParser`)**
- Parse `Api*.ts` files → `tsrpc_api` nodes (ApiCall<Req, Res> pattern)
- Parse `Ptl*.ts` files → protocol nodes (Req/Res interfaces, conf config)
- Parse `Msg*.ts` files → `tsrpc_msg` nodes (WebSocket message types)
- `parseServiceProto()` supplements missing nodes from auto-generated serviceProto.ts
- Support anonymous default exports (`export default async function`)

**Edge types**
- `sends_msg` — client.sendMsg() / server.broadcast()
- `listens_msg` — client.listenMsg() / server.addMsgListener()

**Framework detection**
- Detect `tsrpc`, `tsrpc-browser`, `tsrpc-base-client` in package.json
- Detect `tsrpc.config.ts` as TSRPC project indicator
- `findTsrpcPaths()` discovers api/protocol dirs and serviceProto.ts

**Cross-layer linking**
- Case-insensitive matching for callApi/listenMsg/sendMsg → tsrpc_api/tsrpc_msg nodes
- Handles linking for tsrpc_api nodes

**UI**
- Node emoji: tsrpc_api (🔌), tsrpc_msg (📨)
- i18n: zh-CN and en-US translations for all new node/edge types

**Tests**
- 12 test cases covering all TSRPC patterns
- Fixtures: ApiGetTodos.ts, PtlGetTodos.ts, MsgTodoUpdate.ts, frontend/calls.ts

### Bug fixes (included)
- Fix `findPrismaSchema` returning absolute path instead of relative
- Fix `findTrpcRouterPaths` not finding files in known router directories

### Files changed
- 18 files modified, 5 new files
- ~1,200 lines added

### Test results
- shared: 33/33 ✅
- analyzer: 172/172 ✅
- cli: 13/13 ✅
- server: 15/15 ✅
- Total: 233/233 ✅

---

### Checklist
- [x] TSRPC parser implemented and tested
- [x] serviceProto.ts parsing support
- [x] sends_msg/listens_msg edge types
- [x] Framework auto-detection
- [x] Cross-layer linking
- [x] UI emoji and i18n
- [x] 12 test cases passing
- [x] All 233 tests passing (0 failures)
- [x] README updated

EOF
