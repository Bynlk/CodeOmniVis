# CodeOmniVis 统一自治交付 Loop 工程

> 适用仓库：`/Users/new/CodeOmniVis`（唯一 git 工作树）。Desktop 副本已弃用。
> 本文件统一治理两个阶段，使用同一套自治格式、同一套门禁、同一套账本。

## 0. 编排总览（串行，A → B）

```
Stage A  类型安全     分支 feat/type-driven-design   计划: docs/superpowers/plans/2026-06-30-type-driven-design.md
   │  跑完 Task 9 strict ESLint 落地 → 合并回 master（新基线冻结）
   ▼
Stage B  前端能力     分支 feat/ui-feature-suite     计划: docs/plans/2026-06-30-ui-feature-plan.md  任务 #15–#20
   │  跑完 #20 → 合并回 master → DELIVERY_REPORT
   ▼
完成
```

为什么串行：两阶段改动半径在 `shared/types/{node,edge}.ts`、`analyzer/resolver/dataFlowTracer.ts`、`server/routes/graph.ts`、`mcp`、`ui` 高度重叠；A 的 Task 9 把 `no-unsafe-*`/`no-explicit-any` 设为 error，B 若先行会被门禁卡死并大量返工。A 先行可让 B 在封闭类型上「顺推导写」。

## 1. 默认执行模式（两阶段通用）

```text
human confirmation: 不需要（挂机自治）
commit policy: 每个任务一个绿色 commit
push policy: 每个绿色 commit 后 push
allowed automatic decisions: 窄类型建模、测试夹具修复、逐包验证回退、保守工程取舍
NOT allowed without explicit user request: force push、破坏性 reset 用户工作、跳过失败门禁
```

## 2. Loop 状态机（每个任务都跑）

```text
BASELINE → RED → GREEN → VERIFY → REPAIR(同类失败最多 3 次) → COMMIT → NEXT
```

- BASELINE：读任务与相关文件，确认 git status，影响类型安全的任务记录 AST 指标。
- RED：先写/改最小的失败测试或 typecheck，确认按预期失败。
- GREEN：实现满足测试且保持运行行为的最小改动；禁止 cast、宽 fallback、字符串 key 读 metadata。
- VERIFY：跑焦点测试 + 逐包 typecheck + (涉及图类型/存储/parser/MCP/UI 解析时) AST 扫描。
- REPAIR：分类失败，原地修复，同一失败类最多 3 次；超出则拆成更小可独立验证的切片。
- COMMIT：仅在 VERIFY 退出 0（或唯一失败是已记录的无关环境失败）时提交并 push。
- NEXT：不询问，继续下一任务。

## 3. 失败分类与自治动作

| 失败类 | 自治动作 |
| --- | --- |
| 类型模型不匹配 | 修源头，不加 cast |
| 测试夹具不完整 | 用该 type 的真实 metadata 补齐，不用空对象 |
| 边界解析失败 | 在边界加 guard/parser，领域层保持 typed |
| 同类失败 3 次仍不过 | 拆成更小可独立验证的 commit 继续 |
| 可能数据丢失（覆盖无关用户工作） | **停止并上报**（唯一需要人工的类） |

## 4. 非协商门禁

**环境已就绪**：pnpm@9.0.0、turbo、tsc、eslint 均可用。`pnpm turbo typecheck/test/lint` 是**有效**门禁（类型计划里「找不到包管理器」的注记为过时环境备注，已升级为下列命令）。

每个改代码的任务后：
```bash
git diff --check
pnpm turbo typecheck --filter=<改动的包>
pnpm turbo test --filter=<改动的包>
```

涉及类型/metadata 的任务额外跑 AST 扫描（路径见各计划文档内嵌的 node 脚本），趋势必须满足：
```text
any: 0    assertions: 0    doubleCasts: 0    unknown: 仅允许出现在运行时边界
```

Stage B 收尾全量回归：
```bash
pnpm turbo typecheck && pnpm turbo lint && pnpm turbo test && pnpm turbo build
```

## 5. 逐包验证矩阵（焦点命令，回退用）

| 改动区域 | 命令 |
| --- | --- |
| shared | `pnpm --filter @codeomnivis/shared exec tsc --noEmit && pnpm --filter @codeomnivis/shared exec vitest run` |
| analyzer | `pnpm --filter @codeomnivis/analyzer exec vitest run` |
| server | `pnpm --filter @codeomnivis/server exec tsc --noEmit && pnpm --filter @codeomnivis/server exec vitest run` |
| mcp | `pnpm --filter @codeomnivis/mcp exec vitest run` |
| ui | `pnpm --filter @codeomnivis/ui exec tsc --noEmit && pnpm --filter @codeomnivis/ui exec vitest run` |
| cli | `pnpm --filter @bynlk/CodeOmniVis exec tsc --noEmit` |

## 6. 统一账本文件（两阶段共用同一格式）

| 文件 | 用途 |
| --- | --- |
| `loop/PROGRESS.json` | 机器可读进度（stage / task / status / commit / gates / metrics） |
| `loop/TASKS.md` | 任务清单 + DOD（每任务 checkbox） |
| `loop/DOD.md` | 全局完成定义 |
| `loop/BASELINE.json` | 起始基线（已采集真实值，见下） |
| `loop/ERROR_LOG.md` | 失败记录与修复 |
| `docs/superpowers/progress/type-driven-design-loop.md` | Stage A 计划自带账本（保留，附加 entry） |
| `DELIVERY_REPORT.md` / `CHANGELOG.md` / `TECHNICAL_DEBT.md` | 收尾产出 |

每任务向 PROGRESS.json 追加一条；写账本失败不阻塞执行，在下个成功 commit 补回。

## 7. 停止条件

仅在以下情形停止：
1. 最终验收全过且分支已 push；
2. 必须执行的破坏性操作会影响无关用户工作；
3. 同一失败类 3 次后仍无法拆小；
4. 缺依赖且无更窄的本地命令能验证改动。

停止时保留最安全状态并上报：`git status --short --branch`、`git log --oneline -5`、最后一个绿色 commit、确切失败命令。
