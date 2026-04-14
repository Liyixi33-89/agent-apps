# 后端技术设计 — Agent 收藏功能

**版本**：v1.3.0
**日期**：2026-04-14
**来源 PRD**：`version-doc/v1.3.0/prd/prd.md`

---

## 1. 数据模型

### 1.1 Favorite Model（新增）

**文件**：`server/src/models/Favorite.ts`

```typescript
interface IFavorite extends Document {
  userId: mongoose.Types.ObjectId;
  agentId: mongoose.Types.ObjectId;
  createdAt: Date;
}
```

**索引**：
- `{ userId: 1, agentId: 1 }` — 联合唯一索引
- `{ userId: 1, createdAt: -1 }` — 查询用户收藏列表（按时间倒序）
- `{ agentId: 1 }` — 统计 Agent 收藏数

### 1.2 Agent Model（扩展）

在现有 `Agent` Schema 中新增字段：

```typescript
favoriteCount: { type: Number, default: 0, min: 0 }
```

---

## 2. API 设计

### 2.1 POST /api/favorites — 收藏 Agent

**认证**：需要登录

**请求体**：
```json
{ "agentId": "string" }
```

**响应**：
```json
{ "success": true, "data": { "favoriteId": "string", "agentId": "string", "createdAt": "ISO8601" } }
```

**业务逻辑**：
1. 验证 agentId 对应的 Agent 存在
2. 检查是否已收藏（联合唯一索引会自动防重）
3. 创建 Favorite 记录
4. Agent.favoriteCount += 1（使用 `$inc` 原子操作）
5. 返回收藏记录

**错误处理**：
- Agent 不存在 → 404
- 已收藏 → 409 Conflict
- 未登录 → 401

### 2.2 DELETE /api/favorites/:agentId — 取消收藏

**认证**：需要登录

**响应**：
```json
{ "success": true }
```

**业务逻辑**：
1. 查找并删除 Favorite 记录（userId + agentId）
2. Agent.favoriteCount -= 1（使用 `$inc: { favoriteCount: -1 }`，配合 `$max: 0` 防止负数）
3. 返回成功

**错误处理**：
- 未收藏 → 404
- 未登录 → 401

### 2.3 GET /api/favorites — 获取我的收藏列表

**认证**：需要登录

**查询参数**：
- `page`：页码，默认 1
- `limit`：每页数量，默认 20

**响应**：
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "favoriteId": "string",
        "agent": { "slug": "...", "name": {...}, "description": {...}, "emoji": "...", "tags": [...], "favoriteCount": 42 },
        "createdAt": "ISO8601"
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20
  }
}
```

**业务逻辑**：
1. 查询当前用户的 Favorite 记录，按 createdAt 倒序
2. populate Agent 基本信息
3. 分页返回

### 2.4 GET /api/favorites/check — 批量检查收藏状态

**认证**：需要登录

**查询参数**：
- `agentIds`：逗号分隔的 Agent ID 列表

**响应**：
```json
{
  "success": true,
  "data": { "agentId1": true, "agentId2": false }
}
```

**业务逻辑**：
1. 查询当前用户对指定 Agent 列表的收藏状态
2. 返回 agentId → boolean 映射

---

## 3. 路由注册

**文件**：`server/src/routes/favorite.ts`

在 `server/src/index.ts` 中注册：
```typescript
import favoriteRoutes from './routes/favorite.js';
router.use('/favorites', favoriteRoutes.routes());
```

---

## 4. 中间件

- 所有写操作（POST/DELETE）使用 `requireAuth` 中间件
- GET /api/favorites 使用 `requireAuth` 中间件
- GET /api/favorites/check 使用 `requireAuth` 中间件

---

## 5. 性能考虑

- `favoriteCount` 作为冗余字段存储在 Agent 上，避免每次查询都 count
- 使用 MongoDB `$inc` 原子操作更新计数，保证并发安全
- 收藏列表查询使用 `{ userId: 1, createdAt: -1 }` 复合索引
