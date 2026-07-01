# 交付报告 — 第二轮独立审计修复 (AUDIT-FIX-ROUND2)

> 分支:`fix/audit-round2`(基于 `578d7fe`)
> 完成日期:2026-07-01
> 输入审计:`loop/AUDIT_REPORT.md`(19 项可修复缺陷 F1–F19)
> 执行方式:全自动 loop,零人工介入;每项缺陷独立 RED→GREEN→全门禁→单一绿色提交→即时推送。

---

## 1. 概述

第二轮独立深度审计在 Stage A+B 与首轮评审之后进行,覆盖安全、资源泄漏、正确性、重复逻辑、测试失真五类问题,确认 19 项可修复缺陷。本轮全部闭环,无遗留可修复项;另有 2 项(S-09、PERF-02)经评估属架构级改造,刻意保留为技术债务(见 §4)。

## 2. 修复矩阵(F1–F19)

| 编号 | 审计项 | 等级 | 包 | 提交 | 修复要点 |
|---|---|---|---|---|---|
| F1 | S-05 | High | server | `49f831c` | realpath 二次边界校验,拒绝边界内符号链接逃逸根目录 |
| F2 | BOUND-04 | High | mcp/analyzer | `e6b6870` | validateDepth 拒绝非法 MCP 深度;getSubtree 限深 + visited 去重;导出真实 handler |
| F3 | S-07 | Med | cli/server | `f46abe6` | 非环回绑定强制 token;变更端点用 timingSafeEqual 鉴权;cli serve 拒绝无 token 的非环回绑定 |
| F4 | S-08 | Med | cli/analyzer | `8edc180` | collectScanDirs 默认仅扫 projectRoot 内(isWithinRoot);跨目录须显式配置;monorepo 才扫同级 |
| F5 | S-06 | Med | shared/server | `a3e3e2d` | DNS rebinding 防护:fetch 前解析主机名(可注入 resolver),拒私网/链路本地/元数据/环回 |
| F6 | E-08 | Med | analyzer | `0ad80fe` | CrossLayerResult 返回 synthetic handler/service 节点并先 upsert,消除 dangling edge |
| F7 | E-07 | Med | server | `93d1e54` | 区分手动刷新与 watcher 自动重试;手动失败保持 stale 并 rethrow → POST /api/analyze 返回 500(`b2bca77` 为 ledger-only 推进提交) |
| F8 | E-10 | Med | shared/analyzer/cli | `1334aa5` | 默认解析器纳入 Kotlin/Spring/Ktor/Room/Exposed;扫描 .kt;Gradle 构建文件探测框架 |
| F9 | BOUND-05 | Med | analyzer | `073a737` | findParentApiRoutes:visited 阻断 calls_service 环;MAX_PARENT_ROUTE_DEPTH=64 防栈溢出 |
| F10 | LEAK-04 | Med | ui | `5930b7a` | WebSocketController 状态机(disposed+shouldReconnect);卸载先禁重连再 close,防重连泄漏 |
| F11 | LEAK-02 | High | server | `acb81e5` | start() 监听失败(EADDRINUSE)不再永久挂起:同步 reject + 清理退出钩子/watcher |
| F12 | LEAK-03 | High | server | `008ecde` | stop() 不再 removeAllListeners 清空共享单例事件总线,仅 off 本实例订阅 |
| F13 | LEAK-05 | Med | cli | `b6b6fe3` | runAnalyze/runCheck:db 句柄在 try 外打开、finally close,异常路径不泄漏 sql.js 句柄 |
| F14 | E-11 | Med | shared/cli | `78d7488` | loadConfig mergeWithDefaults 逐字段运行时校验,非法 .codeomnivis.json 回退默认不污染下游 |
| F15 | E-13 | Med | ui | `141d06d` | GraphFilterController 监听 cytoscape 'add',GraphCanvas 刷新后重放当前过滤 |
| F16 | E-12 | Low | ui | `8a072b9` | 抽出纯函数 filterNodesByQuery;Header 搜索框实际过滤侧栏节点列表/计数 |
| F17 | E-09 | Low | analyzer | `50aa2f5` | runFullAnalysis 跟踪并返回真实跨层边数,不再硬编码 0(无文件分支保持 0) |
| F18 | DUP-04 | Low | cli | `b58a16c` | check 命令复用 collectScanDirs(projectRoot, config),消除硬编码扫描目录与 process.cwd() 漂移 |
| F19 | TEST-BUG-04 | Low | mcp | `149b146` | tools.test 改为导入并断言真实 MCP handler(含 filter、上下游遍历、非法入参分支),废除简化复刻 |

按等级:High 4(F1/F2/F11/F12)· Med 11 · Low 4。按类别:安全 4(F1/F3/F4/F5)· 资源泄漏 5(F10–F13 + F9 边界)· 正确性 7(F2/F6/F7/F8/F14/F15/F16/F17)· 重复逻辑 1(F18)· 测试失真 1(F19)。

## 3. 最终全量回归

| 门禁 | 结果 |
|---|---|
| 测试 | **439 passed** — shared 88 / ui 53 / analyzer 197 / mcp 19 / cli 18 / server 64 |
| typecheck | 11/11 任务 0 error |
| lint | 6/6 任务 0 error;6 条均为允许的 B-2 `MODULE_TYPELESS_PACKAGE_JSON` 告警,exit 0 |
| build | 6/6 任务成功 |
| `git diff --check` | clean(无空白/冲突标记) |
| AST 门禁 | `any=0 unknown=92 assertions=0 doubleCasts=0 recordUnknown=1` |

AST 红线全程守护:零 `as`/断言/双重 cast/`Record<string,unknown>` 宽回退;`unknown=92` 全部位于运行时边界(HTTP JSON、cytoscape data()、storage 反序列化、req.body),`recordUnknown=1` 为 prisma.ts 中合法的 JS 模块命名空间守卫。测试代码同样遵守红线(ast-scan 扫描 __tests__)。

> 计数说明:turbo 仅为定义了该 script 的包调度任务,故 typecheck/lint/build 的任务计数不等于 6 个包全量。以上计数来自本轮实测命令:`pnpm turbo typecheck --force` → `Tasks: 11 successful, 11 total`;`pnpm turbo lint --force` → `Tasks: 6 successful, 6 total`;`pnpm turbo build --force` → `Tasks: 6 successful, 6 total`。

## 4. 残留 / 刻意保留的债务

| 审计项 | 债务编号 | 原因 |
|---|---|---|
| S-09(apiKey 浏览器侧存储) | TECHNICAL_DEBT B-6 | 已降级默认 sessionStorage;彻底修复需服务端会话托管,属架构级改造,超出单缺陷最小修复范围 |
| PERF-02(全量重分析) | TECHNICAL_DEBT B-7 | 现为方案一(状态可视化 + 智能监听 + 手动兜底);增量 AST diff / 文件级缓存属后续方案 |

无 blocked 任务(circuit breaker 未触发)。其余既有债务(B-1~B-5、B-8)状态不变,见 `TECHNICAL_DEBT.md`。

## 5. 合并

`fix/audit-round2` 相对基线 `578d7fe` 领先 37 个提交(实测命令:`git rev-list --count 578d7fe..HEAD`;base..HEAD=`578d7fe..ea25945`)且为线性历史,`master` 为分支祖先,满足 **ff-only** 合并条件。合并后 master 即为本报告所述全绿状态。
