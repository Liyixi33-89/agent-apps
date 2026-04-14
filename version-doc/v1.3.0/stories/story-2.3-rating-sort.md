# Story 2.3: Agent 列表页评分排序

> Epic: E2 — Agent 评分评价（前端）
> 来源: PRD 功能模块 3
> 优先级: P1
> 估算工时: 1 天
> 依赖: Story 1.2

## 背景

在 Agent 列表页的每个卡片上显示平均评分，并支持按评分排序，帮助用户快速发现优质 Agent。

## 目标

完成后，Agent 列表页卡片显示评分，用户可以按评分排序。

## 实现范围

### 需要修改的文件

| 文件 | 修改内容 | 说明 |
|------|---------|------|
| web/src/pages/AgentsPage.tsx | 卡片新增评分显示 + 排序下拉框新增选项 | 前端展示 |
| web/src/api/index.ts | fetchAgents 增加 sort 参数 | API 调用 |

## 技术细节

### AgentsPage 修改

```typescript
// 排序下拉框新增选项
const sortOptions = [
  { label: '默认排序', value: '' },
  { label: '按评分排序', value: 'rating' },
];

// Agent 卡片新增评分显示
<div className="flex items-center gap-1 text-sm text-gray-500">
  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
  <span>{agent.ratingStats?.avgRating?.toFixed(1) || '暂无'}</span>
  {agent.ratingStats?.totalReviews > 0 && (
    <span>({agent.ratingStats.totalReviews})</span>
  )}
</div>
```

### API 修改

```typescript
export const fetchAgents = async (params?: {
  category?: string;
  search?: string;
  modelType?: string;
  sort?: string;  // 新增
  page?: number;
  limit?: number;
}) => {
  const { data } = await api.get('/agents', { params });
  return data;
};
```

## 验收标准

- [ ] Agent 卡片显示平均评分（⭐ 4.2）
- [ ] Agent 卡片显示评价数量（(56)）
- [ ] 无评分的 Agent 显示"暂无评分"
- [ ] 排序下拉框有"按评分排序"选项
- [ ] 选择"按评分排序"后列表按评分降序
- [ ] 无评分的 Agent 排在最后

## 注意事项

- 使用 lucide-react 的 `Star` 图标（项目约定图标库）
- 遵循 TailwindCSS 样式约定
- 评分数据来自 Agent 文档的 ratingStats 字段（后端已在 Story 1.1 中扩展）
