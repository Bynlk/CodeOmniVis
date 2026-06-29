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

## 额外验证

如果你想拿 JSON 结果做离线对比，可以切到 `demo/` 目录再执行：

```bash
cd demo
node ../packages/cli/bin/codeomnivis.js analyze -o codeomnivis-graph.json
```

这会在 `demo/` 目录生成一份图谱 JSON，可用于比对结构是否稳定。
