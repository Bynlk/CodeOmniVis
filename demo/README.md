# CodeOmniVis Demo

这个 `demo/` 目录是一份专门为 CodeOmniVis 准备的“小而完整”的全栈样例，用来验证图谱、数据流和跨层连线是否按预期工作。

它不是一个要独立部署的产品，而是一个便于肉眼检查分析结果的样本仓库。

## Demo 里有什么

### 页面

- `app/page.tsx`
- `app/booking/page.tsx`
- `app/booking/[id]/page.tsx`
- `app/profile/page.tsx`

### API

- `app/api/booking/route.ts`
- `app/api/user/route.ts`

### React 组件

- `Hero`
- `Navigation`
- `Footer`
- `BookingList`
- `BookingDetail`
- `SearchBar`
- `UserProfile`

### tRPC Router

- `server/routers/booking.ts`
- `server/routers/user.ts`

### Prisma 模型

- `User`
- `Profile`
- `Post`
- `Comment`
- `Tag`
- `Booking`

Schema 文件位于 `demo/schema.prisma`。

## 如何运行

从仓库根目录执行：

```bash
pnpm install
pnpm build
node packages/cli/bin/codeomnivis.js serve --project ./demo --no-open
```

然后打开：

```text
http://localhost:4321
```

## 建议重点检查的内容

### 1. 页面到组件树

检查这些页面是否能展开到对应组件：

- `/`
- `/booking`
- `/booking/[id]`
- `/profile`

### 2. API 节点

图里应该能看到：

- `/api/booking`
- `/api/user`

### 3. 数据模型

图里应该能看到 `User`、`Booking`、`Post` 等 Prisma 模型及其关系边。

### 4. 数据流面板

选中 `User` 或 `Booking` 之类的模型后，数据流面板应该能展示：

- 相关 API 路由
- 相关消费组件

### 5. 完整跨层链路

REST 示例应精确展示以下链路，且 GET/POST 不应互相串线：

```text
BookingList → /api/booking → GET → listBookings → Booking
/api/booking → POST → createBooking → Booking
UserProfile → /api/user → GET → listUsers → User
```

tRPC 示例应精确展示：

```text
BookingDetail → booking.getById → getById resolver → Booking
```

2026-07-13 的连续两次 CLI 验证结果一致：47 个节点、59 条边，其中
`calls_api` 3 条、`handles` 11 条、`calls_service` 3 条、`queries_db` 11 条；
无重复 ID、悬空边、缺失 confidence 或 router 容器伪 resolver 边。当前 6 个
`unguarded_route` 来自 3 个未鉴权 REST handler 和 3 个显式 `publicProcedure`，
是 demo 刻意保留的质量提示，不是解析失败。`check` 另报告 7 个没有 demo 前端调用者的 tRPC procedure。

## 额外验证

如果你想拿 JSON 结果做离线对比，可以切到 `demo/` 目录再执行：

```bash
cd demo
node ../packages/cli/bin/codeomnivis.js analyze -o codeomnivis-graph.json
```

这会在 `demo/` 目录生成一份图谱 JSON，可用于比对结构是否稳定。
