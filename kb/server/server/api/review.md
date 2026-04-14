# review 路由

**文件**: server/src/routes/review.ts
**挂载方式**: 子路由挂载到 agentsRouter（无独立前缀）
**版本**: v1.3.0 新增

## API 列表

### GET /api/agents/:slug/reviews

**中间件**: 无（公开接口）
**说明**: 获取评价列表 + 统计信息

**请求参数**:

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| slug | params | string | ✅ | Agent slug |
| page | query | number | 否 | 页码，默认 1 |
| limit | query | number | 否 | 每页条数，默认 10，最大 50 |

**响应 Body**:

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 是否成功 |
| data.stats.avgRating | number | 平均评分 |
| data.stats.totalReviews | number | 评价总数 |
| data.stats.distribution | number[] | 各星级数量 [1星,2星,3星,4星,5星] |
| data.reviews | AgentReview[] | 评价列表 |
| pagination | object | 分页信息 |

**业务逻辑**:
1. 从 Agent 文档读取 ratingStats 作为 stats
2. 查询 AgentReview 集合，按 createdAt 倒序，分页
3. 返回 stats + reviews + pagination

**调用链**: Route → reviewService.getReviews() → Agent.findOne() + AgentReview.find() → MongoDB

---

### POST /api/agents/:slug/reviews

**中间件**: requireAuth
**说明**: 提交/更新评价（upsert）

**请求参数**:

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| slug | params | string | ✅ | Agent slug |
| rating | body | number | ✅ | 评分 1-5 整数 |
| content | body | string | 否 | 评价内容，限 500 字 |

**业务逻辑**:
1. 校验 rating 范围（1-5 整数）
2. 校验 content 长度（≤500）
3. 校验 Agent 是否存在
4. upsert AgentReview
5. 重新计算 Agent.ratingStats
6. 返回评价

**错误处理**: 400 评分无效、404 Agent 不存在

**调用链**: Route → reviewService.submitReview() → AgentReview.findOneAndUpdate() + recalculateRatingStats() → MongoDB

---

### GET /api/agents/:slug/reviews/mine

**中间件**: requireAuth
**说明**: 获取当前用户对该 Agent 的评价

**调用链**: Route → reviewService.getMyReview() → AgentReview.findOne() → MongoDB

---

### DELETE /api/agents/:slug/reviews

**中间件**: requireAuth
**说明**: 删除当前用户的评价

**调用链**: Route → reviewService.deleteReview() → AgentReview.findOneAndDelete() + recalculateRatingStats() → MongoDB
