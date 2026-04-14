# Story 1.1: AgentReview Model + Agent ratingStats 扩展

> Epic: E1 — Agent 评分评价（后端）
> 来源: PRD 功能模块 1
> 优先级: P0
> 估算工时: 0.5 天
> 依赖: 无

## 背景

为支持用户对 Agent 进行评分评价，需要新建 `AgentReview` Model 存储评价数据，并在 `Agent` Model 中新增 `ratingStats` 字段缓存评分统计信息（避免每次查询都聚合计算）。

## 目标

完成后，数据库中有 `AgentReview` 集合可以存储用户评价，`Agent` 文档中有 `ratingStats` 字段可以直接读取评分统计。

## 实现范围

### 需要新增的文件

| 文件 | 类型 | 说明 |
|------|------|------|
| server/src/models/AgentReview.ts | Model | 评价数据模型 |

### 需要修改的文件

| 文件 | 修改内容 | 说明 |
|------|---------|------|
| server/src/models/Agent.ts | 新增 `ratingStats` 字段 | 缓存平均评分、评价总数、各星级分布 |

## 技术细节

### AgentReview Schema

```typescript
interface IAgentReview extends Document {
  agentSlug: string;
  userId: string;
  username: string;
  rating: number;       // 1-5
  content?: string;     // 限 500 字
  createdAt: Date;
  updatedAt: Date;
}

// 索引
{ agentSlug: 1, userId: 1 }  // 唯一索引
{ agentSlug: 1, createdAt: -1 }  // 查询索引
```

### Agent ratingStats 字段

```typescript
ratingStats: {
  avgRating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  distribution: { type: [Number], default: [0, 0, 0, 0, 0] }  // [1星, 2星, 3星, 4星, 5星]
}
```

## 验收标准

- [ ] `AgentReview` Model 可以正常创建、查询、更新、删除文档
- [ ] `agentSlug + userId` 唯一索引生效（同一用户不能重复评价）
- [ ] `rating` 字段有 min:1 max:5 校验
- [ ] `content` 字段有 maxlength:500 校验
- [ ] `Agent` Model 新增 `ratingStats` 字段，默认值正确

## 测试要点

- 创建评价文档，验证字段校验
- 尝试同一用户对同一 Agent 创建两条评价，验证唯一索引报错
- 验证 Agent 文档的 ratingStats 默认值

## 注意事项

- 遵循项目宪法 ADR-002：Model 只定义 Schema，不包含业务逻辑
- 接口命名遵循 `I` 前缀约定（`IAgentReview`）
- 导入路径使用 `.js` 后缀
- 使用 `mongoose.models.AgentReview || mongoose.model(...)` 防重复注册
