# favorite 路由

**文件**: server/src/routes/favorite.ts
**挂载前缀**: /api/favorites
**版本**: v1.2.0 新增

## API 列表

### POST /api/favorites

**中间件**: requireAuth
**说明**: 收藏 Agent

**请求参数**:

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| agentId | body | string | ✅ | Agent ID |

**响应 Body**:

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 是否成功 |
| data.favoriteId | string | 收藏记录 ID |
| data.agentId | string | Agent ID |
| data.createdAt | string | 收藏时间 |

**业务逻辑**:
1. 校验 agentId 参数
2. 验证 Agent 存在
3. 创建 Favorite 记录
4. 原子递增 Agent.favoriteCount
5. 返回收藏记录

**错误处理**: 409 已收藏（唯一索引冲突）、404 Agent 不存在

**调用链**: Route → Favorite.create() + Agent.findByIdAndUpdate() → MongoDB

---

### DELETE /api/favorites/:agentId

**中间件**: requireAuth
**说明**: 取消收藏

**业务逻辑**:
1. 删除 Favorite 记录
2. 原子递减 Agent.favoriteCount
3. 修正可能的负数

**调用链**: Route → Favorite.findOneAndDelete() + Agent.findByIdAndUpdate() → MongoDB

---

### GET /api/favorites

**中间件**: requireAuth
**说明**: 获取我的收藏列表

**请求参数**:

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| page | query | number | 否 | 页码，默认 1 |
| limit | query | number | 否 | 每页条数，默认 20 |

**业务逻辑**:
1. 查询当前用户的 Favorite 记录（按 createdAt 倒序）
2. populate agentId 关联 Agent 基本信息
3. 返回分页结果

**调用链**: Route → Favorite.find().populate('agentId') → MongoDB

---

### GET /api/favorites/check

**中间件**: requireAuth
**说明**: 批量检查收藏状态

**请求参数**:

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| agentIds | query | string | ✅ | 逗号分隔的 Agent ID 列表 |

**业务逻辑**:
1. 查询当前用户对指定 Agent 的收藏记录
2. 返回 `{ [agentId]: boolean }` 映射

**调用链**: Route → Favorite.find() → MongoDB
