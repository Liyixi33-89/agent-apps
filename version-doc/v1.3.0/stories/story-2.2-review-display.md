# Story 2.2: 评分统计 + 评价列表展示

> Epic: E2 — Agent 评分评价（前端）
> 来源: PRD 功能模块 2
> 优先级: P1
> 估算工时: 1.5 天
> 依赖: Story 1.2

## 背景

在 Agent 详情页展示评分统计信息和评价列表，让用户了解其他人对 Agent 的评价。

## 目标

完成后，Agent 详情页显示平均评分、各星级分布、评价列表（分页）。

## 实现范围

### 需要新增的文件

| 文件 | 类型 | 说明 |
|------|------|------|
| web/src/components/ReviewStats.tsx | Component | 评分统计展示组件 |
| web/src/components/ReviewList.tsx | Component | 评价列表组件 |

### 需要修改的文件

| 文件 | 修改内容 | 说明 |
|------|---------|------|
| web/src/pages/AgentDetailPage.tsx | 引入 ReviewStats + ReviewList | 在评价区域展示统计和列表 |
| web/src/api/index.ts | 新增 fetchReviews API 函数 | 获取评价列表 + 统计 |
| web/src/types/index.ts | 新增 ReviewStats, ReviewListResponse 类型 | 类型定义 |

## 技术细节

### ReviewStats 组件

```typescript
interface ReviewStatsProps {
  stats: { avgRating: number; totalReviews: number; distribution: number[] };
}

// 左侧：大号平均分 + Rate 组件（disabled）+ "N 人评价"
// 右侧：5 行 Progress 条形图（5星→1星）
```

### ReviewList 组件

```typescript
interface ReviewListProps {
  agentSlug: string;
  refreshKey: number;  // 提交评价后递增触发刷新
}

// 使用 Antd List + Pagination
// 每条评价：Avatar + username + Rate(disabled) + content + 时间
// 空状态："暂无评价，成为第一个评价者吧！"
```

## 验收标准

- [ ] 显示平均评分（保留一位小数）
- [ ] 显示评分人数
- [ ] 显示各星级分布条形图
- [ ] 评价列表按时间倒序
- [ ] 评价列表支持分页（每页 10 条）
- [ ] 无评价时显示空状态
- [ ] 提交评价后列表自动刷新

## 注意事项

- 使用 Antd `Rate`（disabled, allowHalf）展示评分
- 使用 Antd `Progress` 展示分布
- 使用 Antd `List` + `Pagination` 展示列表
- 遵循 TailwindCSS 样式约定
