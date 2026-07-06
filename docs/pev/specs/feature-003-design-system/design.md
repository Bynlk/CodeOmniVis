# 技术方案设计：feature-003-design-system

- **对应 spec**：./spec.md
- **版本**：v1

## 方案概述
把节点/边配色单一真源固化在 `src/lib/nodeConfig.ts`/`edgeConfig.ts`，tailwind.config 扩展语义 token 引用同一色值；新建 `components/Legend.tsx` 复用该配置渲染图例。

## 关键设计
- **token**：tailwind theme.extend 增加 node-page/node-component/... 等语义色；spacing/radius/fontSize 统一 scale。
- **Legend 组件**：读取 nodeConfig 生成条目（color swatch + emoji + i18n 名称），常驻画布一角，可折叠，折叠态记忆入 uiStore/localStorage。
- **单一真源**：Cytoscape stylesheet 与 Legend 都从 nodeConfig 取色，杜绝不一致。

## 遵守的技术铁律
- 禁止外部 CDN；禁止炫技动画。

## 风险与边界
- Legend 不得遮挡关键画布操作区（放在不与工具条冲突的角落，响应式下并入抽屉）。

## 任务拆解
- [ ] 固化 nodeConfig/edgeConfig 单一真源
- [ ] 扩展 tailwind token
- [ ] 建 Legend 组件并挂载
- [ ] 折叠态持久化
- [ ] 测试
