# Kotlin 解析与可视化支持 — 实施计划

## Context

OmniVis 当前只支持 TypeScript 全栈项目（Next.js + Express/tRPC + Prisma/TypeORM）。用户希望扩展到 Kotlin 生态，支持 Spring Boot、Ktor、Room（Android）三个框架，新增 Kotlin 专用节点类型，并实现 TypeScript 前端 → Kotlin 后端的跨层连线。

## 技术选型：tree-sitter-kotlin

- 使用 `web-tree-sitter` + `tree-sitter-kotlin`（WASM），无需 JVM
- tree-sitter 提供完整的 CST（具体语法树），支持精确的行列号
- 与现有 ts-morph 解析器模式一致（AST 遍历 + 模式匹配）
- 依赖：`web-tree-sitter`、`tree-sitter-kotlin`

## 实施步骤

### Phase 1：基础设施（shared + analyzer 核心）

#### Step 1.1：扩展类型系统
**文件：** `packages/shared/src/types/node.ts`

新增 Kotlin 专用节点类型到 `NodeType` union：
```
'kotlin_class' | 'kotlin_interface' | 'kotlin_object' | 'kotlin_function' | 'kotlin_route'
```

新增对应 Metadata 接口：
- `KotlinClassMetadata` — className, kind (data/sealed/abstract/open/value/inner), packageName, annotations, superClass?, interfaces[]
- `KotlinInterfaceMetadata` — interfaceName, packageName, annotations, superInterfaces[]
- `KotlinObjectMetadata` — objectName, packageName, isCompanion, annotations
- `KotlinFunctionMetadata` — functionName, packageName, isTopLevel, isExtension, receiverType?, returnType?, annotations
- `KotlinRouteMetadata` — method (GET/POST/PUT/DELETE), path, framework (ktor/spring), annotations

#### Step 1.2：扩展边类型
**文件：** `packages/shared/src/types/edge.ts`

新增边类型到 `EdgeType` union：
```
'kotlin_inherits' | 'kotlin_implements' | 'kotlin_uses'
```

新增对应 Metadata 接口：
- `KotlinInheritsMetadata` — superClass, line
- `KotlinImplementsMetadata` — interfaceName, line
- `KotlinUsesMetadata` — usageType (field/parameter/return/annotation), line

#### Step 1.3：扩展 ProjectMeta
**文件：** `packages/shared/src/types/graph.ts`

- `FrameworkType` 新增：`'spring' | 'ktor'`
- `DatabaseType` 新增：`'exposed' | 'room'`
- `ProjectMeta` 新增字段：`buildFile?: string`（build.gradle.kts 路径）

#### Step 1.4：扩展 UI 节点配置
**文件：** `packages/ui/src/lib/nodeConfig.ts`

为新节点类型添加颜色和 Emoji：
- `kotlin_class` — 🟣 purple
- `kotlin_interface` — 🔵 blue
- `kotlin_object` — 🟠 orange
- `kotlin_function` — 🟢 green
- `kotlin_route` — 🟡 yellow

**文件：** `packages/ui/src/utils/cytoscapeConfig.ts`

为新边类型添加样式。

---

### Phase 2：tree-sitter 基础设施

#### Step 2.1：安装依赖
**文件：** `packages/analyzer/package.json`

```json
{
  "web-tree-sitter": "^0.24.0",
  "tree-sitter-kotlin": "^0.3.0"
}
```

#### Step 2.2：创建 tree-sitter 初始化模块
**文件：** `packages/analyzer/src/parsers/kotlin/treeSitterInit.ts`

- 懒加载初始化 `web-tree-sitter`（只需一次）
- 加载 `tree-sitter-kotlin.wasm` 语言文件
- 导出 `getKotlinParser()` 单例
- 导出 `parseKotlinFile(filePath: string): Parser.Tree` 工具函数

#### Step 2.3：创建 Kotlin 节点遍历器
**文件：** `packages/analyzer/src/parsers/kotlin/kotlinWalker.ts`

实现 `KotlinWalker` 类，遍历 tree-sitter CST 提取：
- 类/接口/对象声明（含修饰符、注解、父类、实现接口）
- 函数声明（含参数、返回类型、扩展函数接收者）
- 包声明、import 语句
- 注解（用于框架检测）

返回结构化的 `KotlinFileAnalysis` 对象。

---

### Phase 3：Kotlin 解析器实现

#### Step 3.1：基础 Kotlin 解析器
**文件：** `packages/analyzer/src/parsers/kotlin/kotlinParser.ts`

实现 `Parser` 接口：
- `name: 'kotlin'`
- `canHandle(filePath, projectMeta)` — 匹配 `.kt` 文件，排除 test 目录
- `parse(filePath, context)` — 使用 KotlinWalker 遍历，生成节点和边

产出节点：
- `kotlin_class` — 每个 class/data class/sealed class
- `kotlin_interface` — 每个 interface
- `kotlin_object` — 每个 object 声明（含 companion object）
- `kotlin_function` — 顶级函数

产出边：
- `kotlin_inherits` — 类继承关系
- `kotlin_implements` — 接口实现关系
- `kotlin_uses` — 类之间的依赖关系（字段类型、参数类型）

#### Step 3.2：Spring Boot Kotlin 解析器
**文件：** `packages/analyzer/src/parsers/kotlin/springKotlinParser.ts`

- `name: 'spring-kotlin'`
- `canHandle` — 检查 `projectMeta.backendFramework === 'spring'` + `.kt` 文件
- 识别注解：`@RestController` → `kotlin_route`，`@Service` → `kotlin_class`，`@Repository` → `db_model`，`@Entity` → `db_model`
- 识别 `@GetMapping`/`@PostMapping`/`@RequestMapping` → `kotlin_route` 节点
- 产出 `handles` 边连接 route → handler function

#### Step 3.3：Ktor 解析器
**文件：** `packages/analyzer/src/parsers/kotlin/ktorParser.ts`

- `name: 'ktor'`
- `canHandle` — 检查 `projectMeta.backendFramework === 'ktor'` + `.kt` 文件
- 识别 `routing { }` DSL 块中的 `get()`/`post()`/`put()`/`delete()` 调用
- 识别 `@Route` 注解
- 产出 `kotlin_route` 节点和 `handles` 边

#### Step 3.4：Room (Android) 解析器
**文件：** `packages/analyzer/src/parsers/kotlin/roomParser.ts`

- `name: 'room'`
- `canHandle` — 检查 `projectMeta.databaseType === 'room'` + `.kt` 文件
- 识别 `@Entity` 注解 → `db_model` 节点
- 识别 `@Dao` 接口 → `kotlin_interface` 节点
- 识别 `@Query`/`@Insert`/`@Update`/`@Delete` → `queries_db` 边

#### Step 3.5：Exposed ORM 解析器
**文件：** `packages/analyzer/src/parsers/kotlin/exposedParser.ts`

- `name: 'exposed'`
- `canHandle` — 检查 `projectMeta.databaseType === 'exposed'` + `.kt` 文件
- 识别 `object XxxTable : IntIdTable()` 模式 → `db_model` 节点
- 识别 `class Xxx : IntEntity()` 模式 → `db_model` 节点
- 识别 `transaction { }` 块中的查询 → `queries_db` 边

#### Step 3.6：注册所有 Kotlin 解析器
**文件：** `packages/analyzer/src/parsers/kotlin/index.ts`

导出所有 Kotlin 解析器。

**文件：** `packages/analyzer/src/parsers/index.ts`

新增 `export * from './kotlin'`。

---

### Phase 4：项目检测

#### Step 4.1：Gradle 构建文件解析
**文件：** `packages/cli/src/utils/gradleDetect.ts`

- 解析 `build.gradle.kts` / `build.gradle` 提取依赖
- 检测 Spring Boot：`org.springframework.boot` 插件
- 检测 Ktor：`io.ktor:*` 依赖
- 检测 Exposed：`org.jetbrains:exposed` 依赖
- 检测 Room：`androidx.room:room-*` 依赖

#### Step 4.2：扩展 autoDetect
**文件：** `packages/cli/src/utils/autoDetect.ts`

- `detectKotlinFramework(root)` — 调用 gradleDetect
- `detectKotlinDatabase(root)` — 调用 gradleDetect
- 修改主函数支持检测 Kotlin 项目（有 `build.gradle.kts` 或 `.kt` 文件时）

---

### Phase 5：跨层连线

#### Step 5.1：扩展 CrossLayerLinker
**文件：** `packages/analyzer/src/resolver/crossLayer.ts`

- 支持 `kotlin_route` 节点作为 API 端点
- TypeScript 前端的 `calls_api` 边可以连接到 Kotlin 后端的 `kotlin_route`
- `handles` 边连接 `kotlin_route` → `kotlin_function`
- `calls_service` 边连接 `kotlin_function` → `kotlin_class`（Spring @Service）
- `queries_db` 边连接 `kotlin_class` → `db_model`

---

### Phase 6：测试

#### Step 6.1：Kotlin fixture 文件
**目录：** `packages/analyzer/__tests__/fixtures/kotlin/`

- `spring-controller.kt` — Spring Boot Controller 示例
- `ktor-routing.kt` — Ktor routing DSL 示例
- `room-entity.kt` — Room @Entity + @Dao 示例
- `exposed-table.kt` — Exposed table 定义示例
- `kotlin-classes.kt` — 各种类/接口/object 示例

#### Step 6.2：解析器测试
**目录：** `packages/analyzer/__tests__/parsers/kotlin/`

每个解析器至少 3 个测试：
- `kotlinParser.test.ts` — 正常、异常、边界
- `springKotlinParser.test.ts`
- `ktorParser.test.ts`
- `roomParser.test.ts`
- `exposedParser.test.ts`

#### Step 6.3：Gradle 检测测试
**文件：** `packages/cli/__tests__/utils/gradleDetect.test.ts`

---

### Phase 7：文档更新

- `CLAUDE.md` — 技术栈表新增 Kotlin 相关条目
- `docs/README.md` — 新增 Kotlin 支持说明
- `README.md` — 功能列表新增 Kotlin 支持

---

## 关键文件清单

| 操作 | 文件路径 |
|------|----------|
| 修改 | `packages/shared/src/types/node.ts` |
| 修改 | `packages/shared/src/types/edge.ts` |
| 修改 | `packages/shared/src/types/graph.ts` |
| 修改 | `packages/analyzer/package.json` |
| 新建 | `packages/analyzer/src/parsers/kotlin/treeSitterInit.ts` |
| 新建 | `packages/analyzer/src/parsers/kotlin/kotlinWalker.ts` |
| 新建 | `packages/analyzer/src/parsers/kotlin/kotlinParser.ts` |
| 新建 | `packages/analyzer/src/parsers/kotlin/springKotlinParser.ts` |
| 新建 | `packages/analyzer/src/parsers/kotlin/ktorParser.ts` |
| 新建 | `packages/analyzer/src/parsers/kotlin/roomParser.ts` |
| 新建 | `packages/analyzer/src/parsers/kotlin/exposedParser.ts` |
| 新建 | `packages/analyzer/src/parsers/kotlin/index.ts` |
| 修改 | `packages/analyzer/src/parsers/index.ts` |
| 新建 | `packages/cli/src/utils/gradleDetect.ts` |
| 修改 | `packages/cli/src/utils/autoDetect.ts` |
| 修改 | `packages/analyzer/src/resolver/crossLayer.ts` |
| 修改 | `packages/ui/src/lib/nodeConfig.ts` |
| 修改 | `packages/ui/src/utils/cytoscapeConfig.ts` |
| 新建 | `packages/analyzer/__tests__/fixtures/kotlin/*.kt` |
| 新建 | `packages/analyzer/__tests__/parsers/kotlin/*.test.ts` |
| 修改 | `CLAUDE.md`、`README.md`、`docs/README.md` |

## 验证方式

1. **单元测试** — `pnpm test` 所有 Kotlin 解析器测试通过
2. **构建** — `pnpm build` 无 TypeScript 错误
3. **端到端** — 用 `demo/` 目录下的 Kotlin 示例项目运行 `npx omnivis serve`，在 UI 中看到 Kotlin 节点和连线
4. **跨层验证** — TypeScript 前端的 API 调用能正确连接到 Kotlin 后端路由
