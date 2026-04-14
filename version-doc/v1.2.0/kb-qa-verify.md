# KB 问答验证 — v1.3.0

**验证日期**：2026-04-14

---

## 测试问题 1：收藏功能的 API 有哪些？

**查询 KB**：`kb/server/server/01_index_api.md`

**回答**：
收藏功能提供 4 个 API 端点：
1. `POST /api/favorites` — 收藏 Agent（需认证）
2. `DELETE /api/favorites/:agentId` — 取消收藏（需认证）
3. `GET /api/favorites` — 获取我的收藏列表（需认证，支持分页）
4. `GET /api/favorites/check` — 批量检查收藏状态（需认证）

**验证**：✅ KB 索引可正确回答

---

## 测试问题 2：Favorite 数据模型的索引有哪些？

**查询 KB**：`kb/server/server/02_index_model.md`

**回答**：
Favorite 模型有 3 个索引：
1. `{ userId: 1, agentId: 1 }` — 联合唯一索引，防止重复收藏
2. `{ userId: 1, createdAt: -1 }` — 查询用户收藏列表（按时间倒序）
3. `{ agentId: 1 }` — 统计 Agent 收藏数

**验证**：✅ KB 索引可正确回答

---

## 测试问题 3：FavoriteButton 组件支持哪些 Props？

**查询 KB**：`kb/frontend/@agency/web/02_index_component.md`

**回答**：
FavoriteButton 组件支持以下 Props：
- `agentId` — Agent ID（必填）
- `initialFavorited` — 初始收藏状态
- `initialCount` — 初始收藏数
- `showCount` — 是否显示收藏数
- `showText` — 是否显示文字
- `size` — 尺寸（small/default）
- `onToggle` — 切换回调

**验证**：✅ KB 索引可正确回答

---

## 验证结论

✅ KB 更新后可正确回答关于 v1.3.0 收藏功能的技术问题。
