# Story 1.2: 评价 CRUD API

> Epic: E1 — Agent 评分评价（后端）
> 来源: PRD 功能模块 1, 2, 3
> 优先级: P0
> 估算工时: 1.5 天
> 依赖: Story 1.1

## 背景

基于 Story 1.1 创建的 AgentReview Model，实现评价的增删改查 API，并在提交/修改/删除评价时自动更新 Agent 的 ratingStats 统计字段。

## 目标

完成后，前端可以通过 API 提交评价、获取评价列表、获取自己的评价、删除评价。

## 实现范围

### 需要新增的文件

| 文件 | 类型 | 说明 |
|------|------|------|
| server/src/routes/review.ts | Route | 评价路由（4 个端点） |
| server/src/services/reviewService.ts | Service | 评价业务逻辑 |

### 需要修改的文件

| 文件 | 修改内容 | 说明 |
|------|---------|------|
| server/src/routes/agents.ts | 挂载 reviewRouter 子路由 | `agentsRouter.use(reviewRouter.routes())` |
| server/src/routes/agents.ts | GET /agents 增加 sort=rating 支持 | 修改查询逻辑 |

## 技术细节

### API 端点

| 方法 | 路径 | 中间件 | 说明 |
|------|------|--------|------|
| GET | /api/agents/:slug/reviews | — | 获取评价列表 + 统计信息 |
| POST | /api/agents/:slug/reviews | requireAuth | 提交/更新评价（upsert） |
| GET | /api/agents/:slug/reviews/mine | requireAuth | 获取当前用户的评价 |
| DELETE | /api/agents/:slug/reviews | requireAuth | 删除当前用户的评价 |

### reviewService 核心逻辑

```typescript
// 提交评价（upsert）
async function submitReview(agentSlug, userId, username, rating, content?) {
  // 1. upsert AgentReview（findOneAndUpdate with upsert）
  // 2. 重新计算 Agent 的 ratingStats（聚合查询）
  // 3. 更新 Agent.ratingStats
}

// 删除评价
async function deleteReview(agentSlug, userId) {
  // 1. 删除 AgentReview
  // 2. 重新计算 Agent 的 ratingStats
  // 3. 更新 Agent.ratingStats
}

// 重新计算评分统计
async function recalculateRatingStats(agentSlug) {
  // 使用 MongoDB 聚合管道计算 avgRating, totalReviews, distribution
}
```

### GET /api/agents 修改

增加 `sort=rating` 查询参数支持：
```typescript
if (sort === 'rating') {
  query.sort({ 'ratingStats.avgRating': -1, 'ratingStats.totalReviews': -1 });
}
```

## 验收标准

- [ ] POST /api/agents/:slug/reviews — 首次提交创建评价
- [ ] POST /api/agents/:slug/reviews — 再次提交更新评价（upsert）
- [ ] GET /api/agents/:slug/reviews — 返回评价列表 + 统计信息 + 分页
- [ ] GET /api/agents/:slug/reviews/mine — 返回当前用户的评价
- [ ] DELETE /api/agents/:slug/reviews — 删除评价
- [ ] 提交/更新/删除评价后，Agent.ratingStats 自动更新
- [ ] GET /api/agents?sort=rating — 按评分排序
- [ ] 未登录用户调用需认证的接口返回 401

## 测试要点

- 提交评价后验证 Agent.ratingStats 正确更新
- 多用户评价后验证平均分计算正确
- 删除评价后验证统计信息正确更新
- 并发提交评价的竞态条件

## 注意事项

- 遵循项目宪法 ADR-002：Route 只做参数解析，业务逻辑在 Service 层
- 响应格式遵循 `{ success: true, data: ... }` 约定
- 认证使用 `requireAuth` 中间件（来自 middleware/auth.ts）
- 导入路径使用 `.js` 后缀
