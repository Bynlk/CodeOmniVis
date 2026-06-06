# OmniVis 工程化计划书

> 生成日期：2026-06-06
> 基于全量代码扫描 + 结论验证
> 目标：从"功能驱动"升级为"工程驱动"

---

## 一、当前状态

| 维度 | 状态 | 严重度 |
|------|------|--------|
| CI/CD | ❌ 零（无 workflow 文件） | 高 |
| 测试覆盖 | ❌ 1/6（仅 analyzer 有 80 个测试） | 高 |
| Lint | ❌ 零（无 ESLint 配置） | 中 |
| License | ⚠️ 根目录有 MIT，6 子包缺失 | 高（发布阻断） |
| npm 元数据 | ❌ 全部缺失 | 高（发布阻断） |
| 文档一致性 | ⚠️ tree-sitter 引用与实现不符 | 中 |

---

## 二、任务清单

### P0 — CI + License（20 分钟）

#### P0-1：创建 GitHub Actions CI

**文件**：`.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test
```

**验收标准**：push 到 main 后 GitHub Actions 自动运行 build + test。

#### P0-2：6 个子包补 license 字段

**修改文件**（6 个）：
- `packages/shared/package.json`
- `packages/analyzer/package.json`
- `packages/server/package.json`
- `packages/ui/package.json`
- `packages/mcp/package.json`
- `packages/cli/package.json`

**修改内容**：每个 package.json 添加 `"license": "MIT"`

**验收标准**：`pnpm licenses list` 不再警告缺失 license。

---

### P1 — 测试 + Lint（3-4 小时）

#### P1-1：server 包基本测试

**新增文件**：`packages/server/__tests__/routes/graph.test.ts`

**测试内容**：
- GET /api/graph 返回图数据
- GET /api/graph/nodes 返回节点列表
- GET /api/graph/nodes?type=page 按类型过滤
- GET /api/graph/nodes/:id 返回单节点
- GET /api/graph/nodes/:id/edges 返回边
- GET /api/graph/stats 返回统计
- GET /api/graph/errors 返回错误
- DELETE /api/graph 需要 X-Confirm header
- DELETE /api/graph 无 header 返回 400
- GET /api/health 返回 ok

**依赖**：需要安装 vitest + supertest

```bash
pnpm add -D vitest supertest @types/supertest --filter @omnivis/server
```

**验收标准**：10 个测试全部通过。

#### P1-2：cli 包基本测试

**新增文件**：`packages/cli/__tests__/utils/scanDirectory.test.ts`
**新增文件**：`packages/cli/__tests__/utils/autoDetect.test.ts`

**测试内容**：
- scanDirectory 递归扫描 .ts/.tsx/.js/.jsx
- scanDirectory 忽略 node_modules/.next/dist
- scanDirectory 返回相对路径
- autoDetect 检测 next/trpc/prisma
- autoDetect 补全 trpcRouterPaths
- autoDetect 补全 typeormEntityDirs

**验收标准**：6 个测试全部通过。

#### P1-3：ESLint 配置

**新增文件**：`eslint.config.js`（根目录）

```javascript
import js from '@eslint/js'
import ts from 'typescript-eslint'

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
]
```

**依赖**：需要安装 ESLint

```bash
pnpm add -D eslint @eslint/js typescript-eslint --filter omnivis
```

**修改文件**：各子包 `package.json` 添加 `"lint": "eslint src/"` 脚本

**验收标准**：`pnpm lint` 运行无错误（warn 可接受）。

---

### P2 — 文档 + 类型安全（3-4 小时）

#### P2-1：清理 tree-sitter 文档引用

**修改文件**：
- `CLAUDE.md` — 第 22 行，删除 `tree-sitter +`，改为 `ts-morph`
- `.claude/skills/parser-development.md` — 删除 tree-sitter 相关示例代码
- `CONTRIBUTING.md` — 第 29 行，删除 tree-sitter 引用
- `docs/superpowers/specs/2026-06-06-omnivis-design.md` — 更新解析引擎描述
- `docs/plans/development-plan.md` — 第 319 行，删除 tree-sitter 引用
- `docs/project-directory.md` — 第 277 行，删除 tree-sitter 引用

**验收标准**：`grep -r "tree-sitter" --include="*.md"` 仅在 archive 目录有结果。

#### P2-2：减少 analyzer 中的 any

**优先处理**（影响最大）：
1. `cytoscapeConfig.ts` — 14 处 as any，使用 Cytoscape.CSSStyleDeclaration
2. `crossLayer.ts` — metadata 访问，定义 CrossLayerMetadata 接口
3. `consistency.ts` — metadata 访问，使用 shared 类型

**验收标准**：`grep -r ": any" packages/analyzer/src/ | wc -l` 从 30+ 降至 15 以下。

---

### P3 — npm 发布就绪（15 分钟）

#### P3-1：补全 publish 元数据

**修改文件**：所有子包 `package.json`

**添加字段**：
```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_USERNAME/omnivis.git",
    "directory": "packages/PACKAGE_NAME"
  },
  "homepage": "https://github.com/YOUR_USERNAME/omnivis#readme",
  "keywords": ["omnivis", "architecture", "visualization", "typescript"],
  "publishConfig": {
    "access": "public"
  }
}
```

**验收标准**：`npm pack --dry-run` 无警告。

---

## 三、执行顺序

```
P0-1 (CI) ─────────────────────────────────┐
P0-2 (License) ────────────────────────────┤
                                           ├─→ P1-1 (server tests)
                                           ├─→ P1-2 (cli tests)
                                           ├─→ P1-3 (ESLint)
                                           │
                                           ├─→ P2-1 (tree-sitter docs)
                                           ├─→ P2-2 (any reduction)
                                           │
                                           └─→ P3-1 (npm metadata)
```

**建议**：新开窗口后，从 P0 开始执行，每完成一个任务运行 `pnpm build && pnpm test` 验证。

---

## 四、验收标准汇总

| 任务 | 验收命令 | 预期结果 |
|------|---------|---------|
| P0-1 CI | push 到 GitHub，查看 Actions | ✅ build + test 通过 |
| P0-2 License | `grep -r '"license"' packages/*/package.json` | 6 个包都有 "MIT" |
| P1-1 server 测试 | `pnpm --filter @omnivis/server test` | 10 个测试通过 |
| P1-2 cli 测试 | `pnpm --filter @omnivis/cli test` | 6 个测试通过 |
| P1-3 ESLint | `pnpm lint` | 无 error（warn 可接受） |
| P2-1 tree-sitter | `grep -r "tree-setter" --include="*.md" .` | 仅 archive 有结果 |
| P2-2 any 减少 | `grep -r ": any" packages/analyzer/src/ \| wc -l` | < 15 |
| P3-1 npm 元数据 | `npm pack --dry-run` (每个包) | 无警告 |

---

## 五、预计工时

| 优先级 | 任务 | 工时 |
|--------|------|------|
| P0 | CI + License | 20 分钟 |
| P1 | 测试 + Lint | 3-4 小时 |
| P2 | 文档 + 类型安全 | 3-4 小时 |
| P3 | npm 元数据 | 15 分钟 |
| **合计** | | **~8 小时** |

---

## 六、当前代码状态（供新窗口参考）

### 已完成的 Phase A-E 任务（29 项）

| Phase | 任务 | 关键修改 |
|-------|------|---------|
| A | 错误处理、颜色统一、死代码清理 | db.ts safeJsonParse、nodeConfig re-export shared、删除 useCytoscape.ts |
| B | StatsPanel、IssuesPanel、MCP 错误处理、CLI 重构 | 3 个 Tab 面板实现、scanDirectory 公共模块 |
| C | 性能优化、类型安全 | consistency.ts/crossLayer.ts Map 索引、PrismaParser DMMF 类型 |
| D | 安全加固 | CORS localhost、输入验证、DELETE 确认 |
| E | AiPanel、WebSocket、命令面板 | useWebSocket hook、CommandPalette 组件 |

### 关键文件清单

| 文件 | 作用 |
|------|------|
| `packages/analyzer/src/storage/db.ts` | SQLite 封装，safeJsonParse |
| `packages/analyzer/src/graph/consistency.ts` | 一致性检测，Map 索引 |
| `packages/analyzer/src/resolver/crossLayer.ts` | 跨层连线，Map 索引 |
| `packages/analyzer/src/parsers/prisma.ts` | Prisma 解析，DMMF 类型 |
| `packages/server/src/index.ts` | Express + WebSocket，CORS localhost |
| `packages/server/src/routes/graph.ts` | REST API，输入验证 |
| `packages/ui/src/App.tsx` | 根组件，集成 WebSocket + 命令面板 |
| `packages/ui/src/components/TabBar/StatsPanel.tsx` | 统计面板 |
| `packages/ui/src/components/TabBar/IssuesPanel.tsx` | 问题面板 |
| `packages/ui/src/components/TabBar/AiPanel.tsx` | AI 面板 |
| `packages/ui/src/components/CommandPalette.tsx` | 命令面板 |
| `packages/ui/src/hooks/useWebSocket.ts` | WebSocket 客户端 |
| `packages/cli/src/utils/scanDirectory.ts` | 公共扫描模块 |
| `packages/cli/src/utils/autoDetect.ts` | 项目检测补全 |

### 构建验证

```bash
pnpm build   # ✅ 6/6 包构建通过
pnpm test    # ✅ 80 个测试通过（analyzer 包）
```

---

*计划书版本：1.0 | 基于 2026-06-06 全量代码扫描*
