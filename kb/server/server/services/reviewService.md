# reviewService

**文件**: server/src/services/reviewService.ts
**复杂度**: 复杂
**版本**: v1.3.0 新增

## 职责

处理 Agent 评价的业务逻辑，包括提交、删除、查询和统计计算。

## 依赖

| 依赖 | 类型 | 用途 |
|------|------|------|
| AgentReview | Model | 评价数据 CRUD |
| Agent | Model | 更新 ratingStats 统计缓存 |

## 导出函数详情

### submitReview(agentSlug: string, userId: string, username: string, rating: number, content?: string): Promise\<IAgentReview\>

**入参**:
- agentSlug: string — Agent 的 slug 标识
- userId: string — 用户 ID
- username: string — 用户名（冗余存储）
- rating: number — 评分 1-5
- content: string — 评价内容（可选）

**出参**: IAgentReview — 创建/更新后的评价文档

**完整逻辑**:
1. findOneAndUpdate({ agentSlug, userId }, { ...data }, { upsert: true, new: true })
2. 调用 recalculateRatingStats(agentSlug) 更新统计
3. 返回评价文档

---

### deleteReview(agentSlug: string, userId: string): Promise\<void\>

**完整逻辑**:
1. findOneAndDelete({ agentSlug, userId })
2. 调用 recalculateRatingStats(agentSlug) 更新统计

---

### getReviews(agentSlug: string, page?: number, limit?: number): Promise\<{ stats, reviews, total }\>

**完整逻辑**:
1. 从 Agent 文档读取 ratingStats 作为 stats
2. 查询 AgentReview 集合（按 createdAt 倒序，分页）
3. 返回 { stats, reviews, total }

---

### getMyReview(agentSlug: string, userId: string): Promise\<IAgentReview | null\>

**完整逻辑**:
1. findOne({ agentSlug, userId }).lean()
2. 返回评价或 null

---

### recalculateRatingStats(agentSlug: string): Promise\<void\>

**完整逻辑**:
1. 使用 MongoDB 聚合管道计算 avgRating、totalReviews、distribution
2. 更新 Agent.ratingStats 字段
3. 无评价时重置为默认值 { avgRating: 0, totalReviews: 0, distribution: [0,0,0,0,0] }

## 调用关系

```
review.ts (Route)
  → reviewService.submitReview()
    → AgentReview.findOneAndUpdate()
    → recalculateRatingStats()
      → AgentReview.aggregate()
      → Agent.findOneAndUpdate()
```
