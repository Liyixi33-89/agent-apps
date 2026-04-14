# 后端技术设计：Agent 评分评价

> 版本：v1.3.0
> PRD 来源：version-doc/v1.3.0/prd/prd.md
> 生成日期：2026-04-14
> 技术栈：Koa 3 + Mongoose 8 + TypeScript

---

## 一、设计概述

**功能摘要**：实现 Agent 评分评价的后端数据模型、API 接口和业务逻辑。

**涉及 PRD 模块**：功能模块 1, 2, 3

**变更范围**：

| 类型 | 新增 | 修改 | 说明 |
|------|------|------|------|
| Model | 1 | 1 | 新增 AgentReview，修改 Agent |
| API | 4 | 1 | 新增 4 个评价端点，修改 GET /agents |
| Service | 1 | 0 | 新增 reviewService |
| 中间件 | 0 | 0 | 复用 requireAuth |
| 配置 | 0 | 0 | 无 |

---

## 二、数据模型设计

### 2.1 AgentReview（新增）

> 来源：PRD 功能模块 1
> 文件：server/src/models/AgentReview.ts

**Schema 定义**：

| 字段 | 类型 | 必填 | 默认值 | 索引 | 校验 | 说明 |
|------|------|------|--------|------|------|------|
| agentSlug | String | ✅ | — | ✅ | trim | 关联的 Agent slug |
| userId | String | ✅ | — | ✅ | — | 评价用户 ID |
| username | String | ✅ | — | — | trim | 用户名（冗余） |
| rating | Number | ✅ | — | — | min:1, max:5 | 评分 1-5 |
| content | String | 否 | '' | — | maxlength:500 | 评价内容 |
| createdAt | Date | ✅ | Date.now | — | — | 创建时间 |
| updatedAt | Date | ✅ | Date.now | — | — | 更新时间 |

**索引设计**：

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| slug_user_unique | { agentSlug: 1, userId: 1 } | 唯一复合 | 一人一评 |
| slug_time | { agentSlug: 1, createdAt: -1 } | 普通复合 | 按时间倒序查询 |

**关联关系**：
- agentSlug → Agent.slug（N:1）
- userId → User._id（N:1）

### 2.2 Agent（修改现有）

> 文件：server/src/models/Agent.ts

**新增字段**：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| ratingStats.avgRating | Number | 否 | 0 | 平均评分 |
| ratingStats.totalReviews | Number | 否 | 0 | 评价总数 |
| ratingStats.distribution | [Number] | 否 | [0,0,0,0,0] | 各星级数量 |

**新增索引**：

| 索引名 | 字段 | 说明 |
|--------|------|------|
| rating_sort | { 'ratingStats.avgRating': -1 } | 按评分排序 |

---

## 三、API 接口设计

### 3.1 GET /api/agents/:slug/reviews

> 来源：PRD 功能模块 2
> 状态：新增
> 文件：server/src/routes/review.ts
> 中间件：无（公开接口）

**请求参数**：

| 参数 | 位置 | 类型 | 必填 | 校验规则 | 说明 |
|------|------|------|------|---------|------|
| slug | params | string | ✅ | — | Agent slug |
| page | query | number | 否 | min:1, 默认 1 | 页码 |
| limit | query | number | 否 | min:1 max:50, 默认 10 | 每页条数 |

**响应 Body**：

```typescript
interface ReviewListResponse {
  success: true;
  data: {
    stats: {
      avgRating: number;
      totalReviews: number;
      distribution: number[];  // [1星, 2星, 3星, 4星, 5星]
    };
    reviews: Array<{
      _id: string;
      userId: string;
      username: string;
      rating: number;
      content: string;
      createdAt: string;
      updatedAt: string;
    }>;
  };
  pagination: { page: number; limit: number; total: number; pages: number };
}
```

**业务逻辑**：
1. 从 Agent 文档读取 ratingStats 作为 stats
2. 查询 AgentReview 集合，按 createdAt 倒序，分页
3. 返回 stats + reviews + pagination

**调用链**：Route → Agent.findOne() + AgentReview.find() → MongoDB

### 3.2 POST /api/agents/:slug/reviews

> 来源：PRD 功能模块 1
> 状态：新增
> 文件：server/src/routes/review.ts
> 中间件：requireAuth

**请求参数**：

| 参数 | 位置 | 类型 | 必填 | 校验规则 | 说明 |
|------|------|------|------|---------|------|
| slug | params | string | ✅ | — | Agent slug |
| rating | body | number | ✅ | 整数, 1-5 | 评分 |
| content | body | string | 否 | maxlength:500 | 评价内容 |

**业务逻辑**：
1. 校验 rating 范围（1-5 整数）
2. 校验 Agent 是否存在
3. upsert AgentReview（findOneAndUpdate with upsert: true）
4. 调用 reviewService.recalculateRatingStats(agentSlug) 更新统计
5. 返回创建/更新的评价

**错误处理**：

| HTTP 状态码 | 条件 | 响应 body |
|------------|------|----------|
| 400 | rating 不在 1-5 范围 | `{ success: false, message: '评分必须在 1-5 之间' }` |
| 401 | 未登录 | `{ success: false, message: '未授权，请先登录' }` |
| 404 | Agent 不存在 | `{ success: false, message: 'Agent not found' }` |

**调用链**：Route → reviewService.submitReview() → AgentReview.findOneAndUpdate() + Agent.findOneAndUpdate() → MongoDB

### 3.3 GET /api/agents/:slug/reviews/mine

> 来源：PRD 功能模块 1
> 状态：新增
> 中间件：requireAuth

**业务逻辑**：
1. 根据 agentSlug + userId 查询 AgentReview
2. 找到 → 返回评价数据
3. 未找到 → 返回 `{ success: true, data: null }`

### 3.4 DELETE /api/agents/:slug/reviews

> 来源：PRD 功能模块 1
> 状态：新增
> 中间件：requireAuth

**业务逻辑**：
1. 根据 agentSlug + userId 删除 AgentReview
2. 调用 reviewService.recalculateRatingStats(agentSlug) 更新统计
3. 返回成功

### 3.5 GET /api/agents（修改现有）

> 来源：PRD 功能模块 3
> 状态：修改现有
> 文件：server/src/routes/agents.ts

**新增请求参数**：

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| sort | query | string | 否 | `rating` = 按评分降序 |

**修改逻辑**：
```typescript
// 在现有排序逻辑中增加
if (sort === 'rating') {
  sortQuery = { 'ratingStats.avgRating': -1, 'ratingStats.totalReviews': -1 };
}
```

---

## 四、Service 设计

### 4.1 reviewService（新增）

> 来源：PRD 功能模块 1, 2
> 文件：server/src/services/reviewService.ts

**职责**：处理评价的业务逻辑，包括提交、删除和统计计算。

**依赖**：

| 依赖 | 类型 | 用途 |
|------|------|------|
| AgentReview | Model | 评价数据 CRUD |
| Agent | Model | 更新 ratingStats |

**导出函数**：

#### submitReview(agentSlug, userId, username, rating, content?): Promise<IAgentReview>

**逻辑步骤**：
1. findOneAndUpdate({ agentSlug, userId }, { rating, content, username }, { upsert: true, new: true })
2. 调用 recalculateRatingStats(agentSlug)
3. 返回评价文档

#### deleteReview(agentSlug, userId): Promise<void>

**逻辑步骤**：
1. findOneAndDelete({ agentSlug, userId })
2. 调用 recalculateRatingStats(agentSlug)

#### recalculateRatingStats(agentSlug): Promise<void>

**逻辑步骤**：
1. 使用 MongoDB 聚合管道：
   ```javascript
   AgentReview.aggregate([
     { $match: { agentSlug } },
     { $group: {
       _id: null,
       avgRating: { $avg: '$rating' },
       totalReviews: { $sum: 1 },
       dist1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
       dist2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
       dist3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
       dist4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
       dist5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
     }}
   ])
   ```
2. 更新 Agent.ratingStats

---

## 五、中间件/配置变更

### 5.1 新增中间件

无

### 5.2 环境变量变更

无

### 5.3 路由注册变更

在 `server/src/routes/agents.ts` 中新增：
```typescript
import { reviewRouter } from './review.js';
agentsRouter.use(reviewRouter.routes(), reviewRouter.allowedMethods());
```

---

## 六、KB 参考

| 参考内容 | KB 文件 | 说明 |
|---------|---------|------|
| Agent Model 结构 | kb/server/server/02_index_model.md | 确认现有字段，规划 ratingStats |
| 路由注册模式 | kb/server/server/06_architecture_patterns.md | Pattern-S001 路由注册 |
| 认证中间件 | kb/server/server/06_architecture_patterns.md | Pattern-S003 认证中间件链 |
| 响应格式 | kb/server/server/06_architecture_patterns.md | Pattern-S002 响应格式 |

---

## 七、实施建议

### 实施顺序

1. 创建 AgentReview Model（models/AgentReview.ts）
2. 修改 Agent Model（新增 ratingStats 字段）
3. 创建 reviewService（services/reviewService.ts）
4. 创建 review 路由（routes/review.ts）
5. 修改 agents 路由（挂载子路由 + sort 参数）
6. 联调测试

### 测试要点

| 测试场景 | 预期结果 |
|---------|---------|
| 首次提交评价 | 创建 AgentReview，Agent.ratingStats 更新 |
| 重复提交评价 | 更新已有评价（upsert），统计更新 |
| 删除评价 | 删除 AgentReview，统计更新 |
| 多用户评价 | 平均分计算正确 |
| 按评分排序 | 高分 Agent 排在前面 |
| 未登录提交 | 返回 401 |
