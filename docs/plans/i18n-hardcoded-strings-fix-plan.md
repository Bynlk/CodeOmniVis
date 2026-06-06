# i18n 硬编码字符串修复计划

> **创建日期**: 2026-06-06
> **状态**: 待执行
> **范围**: `packages/ui/src/` 全部用户可见字符串
> **目标**: 将 51 处硬编码字符串全部替换为 `t()` 调用，实现真正的中英双语切换

---

## 一、现状

- i18n 基础设施已就位（i18next + react-i18next，zh-CN.json / en-US.json 各 57 个 key）
- **5 个文件**已正确使用 `t()`：FilterPanel、TabBar、Header（部分）、NodeTooltip、StatsPanel（部分）
- **10 个文件**存在硬编码字符串，共 **51 处**
- `AiPanel.tsx` 最严重：导入了 `useTranslation` 但从未调用 `t()`
- `edgeConfig.ts` 中 `EDGE_TYPE_LABELS` 是死代码（无组件引用），但翻译 key 已存在于 locale 文件中

---

## 二、修复策略

### 核心原则

1. **不改组件逻辑** — 只替换字符串为 `t()` 调用，不改动 UI 结构
2. **key 命名遵循已有惯例** — 参照现有 `nodeType.*`、`edgeType.*`、`detail.*` 的命名方式
3. **aria-label 也要国际化** — 无障碍属性同样是用户可见的
4. **删除死代码** — `edgeConfig.ts` 中的 `EDGE_TYPE_LABELS` 无引用，直接删除
5. **每个文件改完自测** — 切换语言确认显示正确

### key 命名规范

```
{组件名小写}.{语义}
示例：ai.assistant、detail.location、sidebar.nodes
通用状态放 common.* 下：common.loading、common.error
```

---

## 三、分批执行计划

### Batch 1：翻译 key 补全（locale 文件）

**文件**：
- `packages/ui/src/locales/en-US.json`
- `packages/ui/src/locales/zh-CN.json`

**新增 key 列表**（共 ~40 个新 key）：

```
common.loading        → "Loading..." / "加载中..."
common.error          → "Error" / "错误"
common.send           → "Send" / "发送"

app.loadingGraph      → "Loading graph..." / "加载图谱中..."
app.errorLoadingGraph → "Error loading graph:" / "加载图谱失败："

sidebar.nodes         → "Nodes" / "节点"
sidebar.noNodesFound  → "No nodes found" / "未找到节点"

detail.closePanel     → "Close panel" / "关闭面板"
detail.details        → "Details" / "详情"
detail.line           → "Line" / "行"

header.subtitle       → "Architecture Visualizer" / "架构可视化"
header.searchPlaceholder → "Search nodes... ({shortcut})" / "搜索节点...（{shortcut}）"
header.searchNodes    → "Search nodes" / "搜索节点"
header.refreshGraph   → "Refresh graph" / "刷新图谱"

graph.canvasLabel     → "Graph visualization canvas" / "图谱可视化画布"

stats.loading         → "Loading..." / "加载中..."
stats.failedToLoad    → "Failed to load stats" / "加载统计失败"
stats.overview        → "Overview" / "概览"

issues.loading        → "Loading..." / "加载中..."
issues.failedToLoad   → "Failed to load issues" / "加载问题失败"
issues.noIssuesFound  → "No issues found" / "未发现问题"
issues.errors         → "errors" / "个错误"
issues.warnings       → "warnings" / "个警告"
issues.info           → "info" / "个信息"

ai.assistant          → "AI Assistant" / "AI 助手"
ai.askAboutArchitecture → "Ask questions about your project architecture" / "询问项目架构相关问题"
ai.thinking           → "Thinking..." / "思考中..."
ai.placeholder        → "Ask about your architecture..." / "询问你的架构..."
ai.send               → "Send" / "发送"
ai.noResponse         → "No response" / "无响应"
ai.serviceUnavailable → "AI service not available. Connect an AI provider to enable this feature." / "AI 服务不可用。连接 AI 提供商以启用此功能。"

commandPalette.noResults → "No results found" / "未找到结果"
commandPalette.navigate  → "Navigate" / "导航"
commandPalette.select    → "Select" / "选择"
commandPalette.close     → "Close" / "关闭"
commandPalette.esc       → "ESC" / "ESC"
```

**验证**：两个 JSON 文件 key 数量一致，JSON 格式合法。

---

### Batch 2：HIGH 优先级文件（AiPanel、CommandPalette）

#### `AiPanel.tsx` — 8 处硬编码，`t()` 从未调用

| 行 | 当前 | 替换为 |
|----|------|--------|
| 43 | `'No response'` | `t('ai.noResponse')` |
| 45 | `'AI service not available...'` | `t('ai.serviceUnavailable')` |
| 48 | `'AI service not available...'` | `t('ai.serviceUnavailable')` |
| 60 | `"🤖 AI Assistant"` | `{t('ai.assistant')}` (emoji 保留在 JSX 中) |
| 61 | `"Ask questions about..."` | `{t('ai.askAboutArchitecture')}` |
| 77 | `"Thinking..."` | `{t('ai.thinking')}` |
| 88 | `placeholder="Ask about..."` | `placeholder={t('ai.placeholder')}` |
| 97 | `"Send"` | `{t('ai.send')}` |

**注意**：`useTranslation` 已导入，只需补上 `t()` 调用。

#### `CommandPalette.tsx` — 5 处硬编码，`t()` 仅用 1 次

| 行 | 当前 | 替换为 |
|----|------|--------|
| 102 | `t('filter.nodeTypes') + '...'` | `t('commandPalette.placeholder')` (新增 key) |
| 105 | `"ESC"` | `{t('commandPalette.esc')}` |
| 112 | `"No results found"` | `{t('commandPalette.noResults')}` |
| 142 | `"Navigate"` | `{t('commandPalette.navigate')}` |
| 143 | `"Select"` | `{t('commandPalette.select')}` |
| 144 | `"Close"` | `{t('commandPalette.close')}` |

**验证**：切换语言，AiPanel 和 CommandPalette 所有文本正确显示中/英文。

---

### Batch 3：MEDIUM 优先级文件

#### `Sidebar.tsx` — 11 处硬编码

- `NODE_TYPE_LABELS` 的 9 个值：改为函数 `getNodeTypeLabel(type, t)`，内部调用 `t('nodeType.${type}')`（key 已存在于 locale 文件中）
- `"Nodes ({count})"` → `{t('sidebar.nodes', { count: graph?.nodes.length || 0 })}`
- `"No nodes found"` → `{t('sidebar.noNodesFound')}`

#### `NodeDetailPanel.tsx` — 7 处硬编码

| 行 | 替换为 |
|----|--------|
| 39 | `aria-label={t('detail.closePanel')}` |
| 51 | `{t('detail.location')}` (key 已存在) |
| 54 | `{t('detail.line')} {node.line}` |
| 61 | `{t('detail.details')}` |
| 73 | `{t('detail.upstream')} ({inEdges.length})` (key 已存在) |
| 95 | `{t('detail.downstream')} ({outEdges.length})` (key 已存在) |
| 122 | `{t('detail.openVSCode')}` (key 已存在) |

#### `IssuesPanel.tsx` — 6 处硬编码

| 行 | 替换为 |
|----|--------|
| 26 | `{t('issues.loading')}` |
| 30 | `{t('issues.failedToLoad')}` |
| 37 | `{t('issues.noIssuesFound')}` |
| 54 | `{t('issues.errors')}` |
| 57 | `{t('issues.warnings')}` |
| 60 | `{t('issues.info')}` |

#### `StatsPanel.tsx` — 3 处硬编码

| 行 | 替换为 |
|----|--------|
| 29 | `{t('stats.loading')}` |
| 33 | `{t('stats.failedToLoad')}` |
| 45 | `{t('stats.overview')}` |

**验证**：切换语言，Sidebar 节点类型、NodeDetail、Issues、Stats 全部正确中英切换。

---

### Batch 4：LOW 优先级文件

#### `App.tsx` — 2 处硬编码

| 行 | 替换为 |
|----|--------|
| 125 | `{t('app.loadingGraph')}` |
| 129 | `{t('app.errorLoadingGraph')}` |

**注意**：App.tsx 需要在顶层使用 `useTranslation`，或用 `Trans` 组件。

#### `Header.tsx` — 5 处硬编码（部分已用 t()）

| 行 | 替换为 |
|----|--------|
| 53 | `{t('header.subtitle')}` |
| 67 | `placeholder={t('header.searchPlaceholder', { shortcut: '⌘K' })}` |
| 69 | `aria-label={t('header.searchNodes')}` |
| 72 | 保留（品牌名 "Omni" 不翻译） |
| 86 | `aria-label={t('header.refreshGraph')}` |

#### `GraphCanvas.tsx` — 1 处硬编码

| 行 | 替换为 |
|----|--------|
| 179 | `aria-label={t('graph.canvasLabel')}` |

**验证**：切换语言，App 加载状态、Header 搜索框、Graph 画布 aria-label 正确显示。

---

### Batch 5：清理死代码

#### `edgeConfig.ts` — 删除 `EDGE_TYPE_LABELS`

- 该记录无任何组件 import/使用
- 翻译 key 已在 locale 文件中通过 `edgeType.*` 定义
- 直接删除整个 `EDGE_TYPE_LABELS` 常量及其 import

#### `LangToggle.tsx` — 2 处硬编码

- `'🌐 EN'` / `'🌐 中'` — 这是语言切换按钮，显示的是"目标语言"的名称
- **建议保留硬编码**：这是唯一不需要翻译的字符串（中文界面显示"EN"，英文界面显示"中"）
- 如果要统一，可以用 `t('lang.switchLabel')` 但语义上是冗余的

---

## 四、验证清单

每个 Batch 完成后执行：

- [ ] `pnpm --filter @omnivis/ui build` 编译通过
- [ ] 切换到英文（en-US），所有页面无中文残留
- [ ] 切换到中文（zh-CN），所有页面无英文残留
- [ ] 检查 aria-label 在 DevTools 中正确显示
- [ ] 检查 placeholder 文本正确显示
- [ ] 翻译 key 无拼写错误（对比 en-US.json 和 zh-CN.json 的 key 一致性）

---

## 五、工作量估算

| Batch | 文件数 | 改动量 | 预计时间 |
|-------|--------|--------|----------|
| 1 - locale 补全 | 2 | ~40 个新 key | 15 分钟 |
| 2 - AiPanel + CommandPalette | 2 | 14 处替换 | 15 分钟 |
| 3 - Sidebar + Detail + Issues + Stats | 4 | 27 处替换 | 30 分钟 |
| 4 - App + Header + GraphCanvas | 3 | 8 处替换 | 10 分钟 |
| 5 - 清理死代码 | 1 | 删除 | 5 分钟 |
| **总计** | **12** | **~51 处** | **~75 分钟** |

---

## 六、风险与注意事项

1. **App.tsx 的 `useTranslation` 位置** — App 是根组件，需确认 `I18nextProvider` 已在 `main.tsx` 中包裹，否则 `t()` 无法工作
2. **Sidebar 的 `NODE_TYPE_LABELS` 改造** — 从静态 Record 改为函数调用，需确认所有引用处都传入 `t`
3. **interpolation 参数** — `header.searchPlaceholder` 包含 `{shortcut}` 变量，需确认 i18next interpolation 配置正确
4. **不翻译品牌名** — "Omni"、"OmniVis"、"VS Code" 等品牌名保留英文原文
5. **emoji 保留** — "🤖"、"🌐" 等 emoji 不翻译，保留在 JSX 中
