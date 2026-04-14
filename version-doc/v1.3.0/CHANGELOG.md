# Changelog — v1.3.0

## Agent 评分评价功能

**发布日期**：2026-04-14
**类型**：Feature

### 新增功能

#### 后端
- **AgentReview Model** — 新增评价数据模型，支持 1-5 星评分和 500 字文字评价
- **Agent ratingStats 字段** — Agent Model 新增评分统计缓存（平均分、评价数、各星级分布）
- **评价 CRUD API** — 4 个新端点：
  - `GET /api/agents/:slug/reviews` — 获取评价列表 + 统计信息（公开）
  - `POST /api/agents/:slug/reviews` — 提交/更新评价（需认证，upsert）
  - `GET /api/agents/:slug/reviews/mine` — 获取当前用户的评价（需认证）
  - `DELETE /api/agents/:slug/reviews` — 删除评价（需认证）
- **reviewService** — 评价业务逻辑层，包含统计自动重算（MongoDB 聚合管道）
- **评分排序** — `GET /api/agents` 新增 `sort=rating` 参数支持

#### 前端
- **ReviewForm 组件** — 评价提交表单（评分星星 + 文字输入 + 提交/更新/删除）
- **ReviewStats 组件** — 评分统计展示（平均分 + 星星 + 各星级分布条形图）
- **ReviewList 组件** — 评价列表展示（分页 + 空状态 + 加载骨架屏）
- **AgentDetailPage 集成** — 详情页底部新增"用户评价"区域
- **AgentsPage 评分显示** — Agent 卡片显示 ⭐ 评分 + 评价数
- **AgentsPage 评分排序** — 排序下拉框新增"按评分排序"选项

### 修改的文件

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| server/src/models/AgentReview.ts | 新增 | 评价数据模型 |
| server/src/models/Agent.ts | 修改 | 新增 ratingStats 字段和索引 |
| server/src/services/reviewService.ts | 新增 | 评价业务逻辑 |
| server/src/routes/review.ts | 新增 | 评价路由（4 端点） |
| server/src/routes/agents.ts | 修改 | 挂载 reviewRouter + sort=rating |
| web/src/types/index.ts | 修改 | 新增 AgentReview、ReviewStatsData、ReviewListResponse 类型 |
| web/src/api/index.ts | 修改 | 新增 4 个评价 API 函数 + fetchAgents 增加 sort 参数 |
| web/src/components/ReviewStats.tsx | 新增 | 评分统计组件 |
| web/src/components/ReviewForm.tsx | 新增 | 评价提交表单组件 |
| web/src/components/ReviewList.tsx | 新增 | 评价列表组件 |
| web/src/pages/AgentDetailPage.tsx | 修改 | 集成评价组件 |
| web/src/pages/AgentsPage.tsx | 修改 | 卡片评分显示 + 排序 |
| server/src/__tests__/reviewService.test.ts | 新增 | 单元测试（10 个用例） |

### 数据库变更

- **新增集合**：`agentreviews`
  - 索引：`{ agentSlug: 1, userId: 1 }` (unique)
  - 索引：`{ agentSlug: 1, createdAt: -1 }`
- **修改集合**：`agents`
  - 新增字段：`ratingStats.avgRating`、`ratingStats.totalReviews`、`ratingStats.distribution`
  - 新增索引：`{ 'ratingStats.avgRating': -1 }`

### Quality Gate

- Code Review：⭐⭐⭐⭐ 良好（第 1 轮通过）
- 测试用例：10 个（覆盖 submitReview、deleteReview、getReviews、getMyReview、recalculateRatingStats）
