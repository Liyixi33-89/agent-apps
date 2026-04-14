# KB 更新记录 — v1.3.0 Agent 收藏功能

**更新日期**：2026-04-14

---

## 新增索引条目

### 后端

#### `kb/server/server/01_index_api.md` — 新增条目

```markdown
### favorite.ts — 收藏 API

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/favorites` | 收藏 Agent | ✅ requireAuth |
| DELETE | `/api/favorites/:agentId` | 取消收藏 | ✅ requireAuth |
| GET | `/api/favorites` | 获取我的收藏列表 | ✅ requireAuth |
| GET | `/api/favorites/check` | 批量检查收藏状态 | ✅ requireAuth |
```

#### `kb/server/server/02_index_model.md` — 新增条目

```markdown
### Favorite — 用户收藏记录

| 字段 | 类型 | 说明 |
|------|------|------|
| userId | ObjectId (ref: User) | 用户 ID |
| agentId | ObjectId (ref: Agent) | Agent ID |
| createdAt | Date | 收藏时间（自动） |

**索引**：
- `{ userId, agentId }` 联合唯一
- `{ userId, createdAt: -1 }` 收藏列表查询
- `{ agentId }` 收藏数统计

### Agent — 扩展字段

| 字段 | 类型 | 说明 |
|------|------|------|
| favoriteCount | Number (default: 0, min: 0) | 收藏数（冗余） |
```

### 前端

#### `kb/frontend/@agency/web/02_index_component.md` — 新增条目

```markdown
### FavoriteButton — 收藏按钮组件

**文件**：`web/src/components/FavoriteButton.tsx`
**Props**：agentId, initialFavorited, initialCount, showCount, showText, size, onToggle
**功能**：收藏/取消收藏 Agent，乐观更新，防抖，未登录提示
```

---

## 验证

- [x] 后端 API 索引已更新
- [x] 后端 Model 索引已更新
- [x] 前端组件索引已更新
- [x] 新增文件均已记录
