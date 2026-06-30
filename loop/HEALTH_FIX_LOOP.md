# HEALTH_FIX_LOOP — 全量缺陷一次性自驱修复工程文档

> 版本: v1 ·  生成日期: 2026-06-30 ·  分支: `fix/health-check`(自 master 切出)
> 目标: 把健康体检 + 双向验证确认的**全部开放缺陷**在一条 LOOP 内一次性修完,**零人工介入**,完全由 AI 自驱。
> 基线: master == origin/master,341 测试全过,AST `any=0 assertions=0 doubleCasts=0`。

---

## 0. 自驱原则(Autonomy Contract)

1. **不向人确认**:任务之间、任务内部的常规决策一律自行裁定,不暂停等待。仅当触发「升级熔断」(见 §6)才停。
2. **状态机驱动**:每个任务严格走 `BASELINE -> RED -> GREEN -> VERIFY -> REPAIR -> COMMIT -> NEXT`。
3. **一任务一绿提交**:每个任务产出且仅产出一个通过全部门禁的 commit,提交后立即 push,并追加 `loop/PROGRESS.json`。
4. **失败留痕**:任何门禁失败写 `loop/ERROR_LOG.md`(格式见该文件头)。同类失败累计 3 次 -> 升级熔断。
5. **红线禁止**:`as`/`as const`/尖括号断言、`!` 非空断言、`Record<string,unknown>` 宽 fallback、字符串键读 metadata、跳过失败门禁、`git push -f`、对用户工作做破坏性 reset。
6. **样式约定**:UI 组件遵循仓库现有写法(CSS Module / 现有 className 体系),**不引入 TailwindCSS**(遵从用户长期偏好)。
7. **改动隔离**:只动当前任务落点文件;顺带发现的新问题登记为新任务,不夹带提交。

---

## 1. 状态机定义

```
BASELINE  捕获当前 git/AST/测试基线,确认工作树干净
   v
RED       先写/改测试,使其表达"修复后才该通过"的行为 -> 跑测试应为红
   v
GREEN     实现最小修复,使 RED 测试转绿,不破坏其它测试
   v
VERIFY    跑该任务全部门禁(见 §2)
   v
REPAIR    门禁红 -> 定位修复;同类失败 < 3 次回到 GREEN,>= 3 次升级熔断
   v
COMMIT    git diff --check 干净 -> 单条绿提交 -> push -> 追加 PROGRESS.json
   v
NEXT      取下一任务;全部完成 -> 进入 H-MERGE
```

---

## 2. 全局门禁(Gates)

每个任务的 VERIFY 必须全绿,缺一不可:

| 门禁 | 命令 | 通过标准 |
|---|---|---|
| 空白/冲突标记 | `git diff --check` | 无输出 |
| 类型检查 | `pnpm turbo typecheck --filter=<受影响包>` | 0 error |
| 单元测试 | `TMPDIR="$PWD/.loop_tmp/tmpdir" pnpm turbo test --filter=<受影响包>` | 全过,新增 RED 用例转绿 |
| Lint | `pnpm turbo lint --filter=<受影响包>` | 0 error(warning 不增长) |
| 构建 | `pnpm turbo build --filter=<受影响包>` | success |
| 类型安全扫描 | `node loop/ast-scan.cjs` | `any=0 assertions=0 doubleCasts=0`;`recordUnknown` 不增长 |

> 涉及 type/metadata/graph/storage/parser/MCP/UI 的任务**强制**跑 ast-scan。
> H-MERGE 阶段改为 `--force` 全量(不带 filter)。

---

## 3. 任务清单(含测试目标与验收标准)

> 顺序按「依赖 + 风险」排定:先修阻断数据正确性的 Blocker,再安全,再边界/测试,最后工程/性能。
> 落点行号基于本次验证时的 HEAD,实现时以实际代码为准。

### H0 · Bootstrap(基础设施)
- **动作**:`git switch -c fix/health-check`;`BASELINE.json` 追加 health-fix 基线快照;`TASKS.md` 追加本清单。
- **验收**:分支已建,工作树干净,基线已记录。无代码改动。

---

### [Blocker] H1 · RACE-01 — 分析结果到不了查询层
- **缺陷**:`runAnalysis` 内部新建独立 `:memory:` OmniDatabase,与 `server` 查询用的库不是同一实例;分析数据写入后查询端永远读不到。
- **落点**:`packages/server/src/runAnalysis.ts:94,148`、`packages/server/src/index.ts:56,74`、`packages/server/src/incremental.ts:49,255`。
- **修复策略**:统一 DB 句柄生命周期 —— 由 server 持有单一 OmniDatabase 实例并注入 `runAnalysis`/`incremental`,移除内部独立建库;确保 `:memory:` 句柄在分析与查询间共享。
- **测试目标(RED->GREEN)**:新增 `server/__tests__/runAnalysis/sharedDb.test.ts` —— 「跑一次分析后,通过 server 查询接口能读到刚写入的节点/边」;断言查询结果 count > 0 且与分析产出一致。
- **验收标准**:① 新测试转绿;② server 包 typecheck/test/lint/build 全过;③ AST 不退化;④ 路径复核:全链只存在一个 DB 实例引用。

---

### [Blocker] H2 · DUP-01 — CLI 漏注册 TsRpcParser
- **缺陷**:`analyze.ts:50` 与 `check.ts:39` 各自手工拼 parser 列表,均漏掉 `TsRpcParser`;无单一来源,易再漂移。
- **落点**:`packages/cli/src/commands/analyze.ts:50`、`packages/cli/src/commands/check.ts:39`、`serve.ts`(对照)。
- **修复策略**:在 analyzer 包新增 `createDefaultParsers()` 工厂,集中注册全部 parser(含 TsRpcParser);analyze/check/serve 三命令统一调用该工厂。
- **测试目标(RED->GREEN)**:`analyzer/__tests__/parsers/createDefaultParsers.test.ts` —— 断言工厂返回的 parser 集合包含 TsRpcParser 等全部预期解析器(按 name/标识枚举);并加一条「analyze 与 check 使用同一集合」的一致性断言。
- **验收标准**:① 工厂为三命令唯一来源(grep 确认无手工拼列表残留);② 新测试转绿;③ analyzer + cli 包门禁全过。

---

### [Major] H3 · S-01 — 路径穿越
- **缺陷**:子树/文件接口未对入参路径做规整与边界校验,存在 `../` 穿越读取仓库外文件风险。
- **落点**:`packages/server/src/index.ts:121` 附近的路径处理。
- **修复策略**:对所有外部传入路径 `path.resolve` 后校验必须以项目根为前缀(规范化后比对),越界返回 400;封装为可复用守卫。
- **测试目标(RED->GREEN)**:`server/__tests__/routes/pathTraversal.test.ts` —— `../../etc/passwd`、绝对路径越界、符号化 `..` 组合均返回 400 且不读盘;合法子路径正常返回。
- **验收标准**:① 越界用例全部 400;② 合法用例不回归;③ server 门禁全过。

---

### [Major] H4 · S-04 — WebSocket 未校验 Origin
- **缺陷**:WS 升级握手不校验 Origin,任意站点可建连(CSWSH)。
- **落点**:`packages/server/src/index.ts:158` 升级处理。
- **修复策略**:升级阶段校验 Origin 是否在允许白名单(本地开发源 + 可配置),不符拒绝握手。
- **测试目标(RED->GREEN)**:`server/__tests__/ws/origin.test.ts` —— 非法 Origin 拒绝升级;合法 Origin 正常建连。
- **验收标准**:① 非法 Origin 被拒;② 合法连接不回归;③ server 门禁全过。

---

### [Major] H5 · BOUND-02 — findLayoutFile 潜在死循环
- **缺陷**:向上递归查找 layout 无仓库根终止条件,异常路径下可无限循环。
- **落点**:`packages/analyzer/src/parsers/nextjsApp.ts:487`。
- **修复策略**:加 repo-root 边界 + 最大层数上限,到根或超限即停。
- **测试目标(RED->GREEN)**:`analyzer/__tests__/parsers/findLayoutFile.test.ts` —— 给定无 layout 的深层路径,函数有限步内返回(不挂起);存在 layout 时正确命中。
- **验收标准**:① 终止性测试转绿(带超时保护);② 既有 nextjs 解析测试不回归;③ analyzer 门禁全过。

---

### [Major] H6 · BOUND-03 — 箭头函数组件未被识别为导出
- **缺陷**:`isVariableExported` 漏判 `export const X = () => {}` 形态,导致这类 React 组件不计入图谱。
- **落点**:`packages/analyzer/src/parsers/reactComponent.ts:194`。
- **修复策略**:补 `VariableStatement` 上的 export modifier 检测(含 `export const`/`export let`)。
- **测试目标(RED->GREEN)**:`analyzer/__tests__/parsers/reactComponent.test.ts` 增 case —— `export const Foo = () => <div/>` 被识别为导出组件;非导出 const 不误判。
- **验收标准**:① 新 case 转绿;② 既有组件解析不回归;③ analyzer 门禁全过 + ast-scan 不退化。

---

### [Major] H7 · TEST-BUG-01/02/03 — 伪测试重写
- **缺陷**:三个测试文件存在恒真/无有效断言,提供虚假信心。
- **落点**:验证阶段定位的三个 fake 测试文件(实现时 grep `expect(true)`/空 assert/`toBeDefined()` 占位 锁定)。
- **修复策略**:逐个重写为针对真实行为的断言;若被测逻辑无价值则替换为有意义覆盖。
- **测试目标**:三文件改造后:断言数 > 0 且与被测函数真实输入/输出绑定;故意注入 bug 时应变红(自检一次后回滚)。
- **验收标准**:① 三文件均含真实断言;② 全量 test 数不减少;③ 相关包门禁全过。

---

### [Minor] H8 · S-03 — 缺安全响应头
- **落点**:`packages/server/src/index.ts` app 初始化。
- **修复策略**:引入 helmet(或等价手写头),设置基础安全响应头。
- **测试目标**:`server/__tests__/routes/securityHeaders.test.ts` —— 响应含预期安全头(如 `x-content-type-options`)。
- **验收标准**:① 头存在;② 现有路由不回归;③ server 门禁全过。

---

### [Minor] H9 · LEAK-01 — 退出未释放 wss
- **落点**:`packages/server/src/index.ts:256` 进程退出路径。
- **修复策略**:注册 SIGINT/SIGTERM 钩子,优雅 `wss.close()` + DB 释放。
- **测试目标**:`server/__tests__/lifecycle/close.test.ts` —— 调用退出清理逻辑后 `wss.close()` 被触发(mock 断言)。
- **验收标准**:① 清理被调用;② 无回归;③ server 门禁全过。

---

### [Minor] H10 · MAGIC-02 — readyState 魔法数字
- **落点**:`packages/server/src/index.ts` 广播处 `readyState === 1`。
- **修复策略**:改用 `WebSocket.OPEN` 常量。
- **测试目标**:并入 H9/广播测试,断言仅向 OPEN 连接发送。
- **验收标准**:① 无裸数字 1;② 无回归。

---

### [Minor] H11 · DUP-03 — AI 配置表单 JSX 重复
- **缺陷**:`AiPanel` 与 `SettingsDrawer` 的 AI 配置表单 JSX 标记重复(R4 已统一逻辑层,残留视图重复)。
- **落点**:`packages/ui/src/components/TabBar/AiPanel.tsx`、`packages/ui/src/components/SettingsDrawer.tsx`。
- **修复策略**:抽公共受控组件 `<AiConfigForm/>`(消费 `useAiConfig`),两处复用;**不使用 TailwindCSS**,沿用现有样式方案。
- **测试目标**:`ui/__tests__/components/AiConfigForm.test.tsx` —— 渲染含 baseUrl/model/apiKey/记住密钥/错误提示;保存触发 `setAiConfig` 且非法 URL 显示错误。
- **验收标准**:① 两处复用同一组件(无重复 JSX);② UI 测试全过;③ UI 门禁全过 + ast-scan 不退化。

---

### [Perf] H12 · M2 — TraceRunner O(N) 遍历
- **缺陷**:`TraceRunner.tsx:42` 每步 `cy.edges().forEach` 全边扫描,O(steps x edges)。
- **落点**:`packages/ui/src/components/TabBar/TraceRunner.tsx:42`。
- **修复策略**:预建 `Map<sourceId, edge[]>` 邻接索引,每步 O(degree) 查找;保持光点动画行为不变。
- **测试目标**:`ui/__tests__/components/traceRunner.test.ts` —— 给定边集,索引查找返回与原遍历一致的命中边;大图下不重复全扫(以构造断言验证)。
- **验收标准**:① 行为等价测试转绿;② 64 步预算内动画无回归;③ UI 门禁全过。

---

### [Eng] H13 · E-03 — 测试不进类型检查
- **缺陷**:`tsconfig.base.json:19` 排除 `__tests__`,测试代码类型错误逃逸。
- **修复策略**:新增 `tsconfig.test.json`(或在 typecheck 脚本纳入 `__tests__`),使测试纳入类型检查;修掉暴露出的类型错误。
- **测试目标**:typecheck 覆盖 `__tests__`;故意写错类型应报错(自检后回滚)。
- **验收标准**:① 测试目录纳入 typecheck;② 全包 typecheck 0 error;③ 不引入 any/断言。

---

### [Eng] H14 · E-06 — unused-vars 警告清零
- **缺陷**:约 53 条 lint 警告(含 6 条 MODULE_TYPELESS 关联)。
- **修复策略**:逐包清理未使用变量/导入;MODULE_TYPELESS 类按债务说明处理(能消则消,不能消登记原因)。
- **测试目标**:`pnpm turbo lint` warning 数显著下降且不新增。
- **验收标准**:① lint 0 error;② warning 数较基线下降并记录残留原因;③ 无行为回归(test 全过)。

---

### [Perf] H15 · P-01 — UI 单 chunk ~750KB
- **缺陷**:UI 构建产物单 chunk ~750KB,未分包。
- **修复策略**:Vite `manualChunks` 拆分 vendor(react/cytoscape/i18n 等),按需懒加载重组件。
- **测试目标**:`pnpm turbo build --filter=ui` 后主 chunk 体积下降,产物多 chunk。
- **验收标准**:① 主 chunk 显著小于基线;② UI 功能/测试不回归;③ 构建成功。

---

### H-MERGE · 终态回归 + 合并 + 收尾
- **动作**:
  1. `git diff --check` 干净;
  2. `pnpm turbo typecheck lint build --force` 全绿;
  3. `TMPDIR=... pnpm turbo test --force` 全绿(测试总数 >= 341 + 新增用例);
  4. `node loop/ast-scan.cjs` -> `any=0 assertions=0 doubleCasts=0`,recordUnknown 不退化;
  5. ff-only 合并 `fix/health-check` -> `master`,push;
  6. 更新 `TECHNICAL_DEBT.md`(关闭已修项)、`PROGRESS.json`(H0–H15 + H-MERGE)、生成 `DELIVERY_REPORT`。
- **验收标准**:全量门禁绿;master == origin/master;台账与技术债文档与实际一致。

---

## 4. 任务依赖图

```
H0 --+- H1(Blocker, server/db)
     +- H2(Blocker, analyzer/cli)
     +- H3 H4 H8 H9 H10 (server 安全/生命周期，可串行)
     +- H5 H6 (analyzer 边界)
     +- H7 (测试重写，依赖各包逻辑稳定 -> 放 H1/H2 后)
     +- H11 H12 (UI)
     +- H13 (全仓 tsconfig，建议靠后，避免反复)
     +- H14 (lint，靠后一次性清)
     +- H15 (UI 构建，最后)
                  v
              H-MERGE
```
> 推荐执行序: H1 -> H2 -> H3 -> H4 -> H5 -> H6 -> H7 -> H8 -> H9 -> H10 -> H11 -> H12 -> H13 -> H14 -> H15 -> H-MERGE。

---

## 5. 全局完成定义(DoD)

- [ ] 2 个 Blocker(H1/H2)闭合,有针对性测试证明数据贯通 & parser 完整。
- [ ] 全部 Major(H3–H7)闭合,安全/边界/测试质量达标。
- [ ] 全部 Minor/Eng/Perf(H8–H15)闭合或登记残留原因。
- [ ] 每任务一绿提交 + push + PROGRESS 条目;git diff --check 始终干净。
- [ ] 终态:typecheck/lint/build/test 全绿;AST `any=0 assertions=0 doubleCasts=0`。
- [ ] 红线零触碰(无 cast/非空断言/宽 fallback/字符串键 metadata)。
- [ ] master ff 合并完成,文档(DEBT/PROGRESS/DELIVERY)校准。

---

## 6. 失败处理与升级熔断

1. 门禁失败 -> 写 ERROR_LOG -> REPAIR;**同类失败 < 3 次**回 GREEN 重试。
2. **同类失败 >= 3 次** -> 熔断该任务:回滚该任务未提交改动(`git restore`,不碰已提交工作),标记 PROGRESS 为 `blocked` + 原因,跳到下一独立任务,最后在 DELIVERY_REPORT 汇总。
3. 出现需要破坏性操作(reset/force push/删用户工作)才能继续 -> 立即停,登记并跳过,绝不执行红线动作。
4. 发现超出本清单的新缺陷 -> 登记为 `H-EXTRA-n`,不夹带进当前任务提交。

---

## 7. 产出物清单

- `fix/health-check` 分支(每任务一绿提交)-> ff 合并 master。
- `loop/PROGRESS.json`:H0–H15 + H-MERGE 逐条(含 commit hash + gates + metrics)。
- `loop/ERROR_LOG.md`:失败留痕。
- `loop/TECHNICAL_DEBT.md`:关闭已修项,更新残留。
- `DELIVERY_REPORT`(收尾):修复矩阵 + 回归结果 + 残留/熔断说明。
