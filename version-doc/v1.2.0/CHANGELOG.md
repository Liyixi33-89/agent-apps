# CHANGELOG — v1.2.0

**发布日期**：2026-04-14

---

## ✨ Features（新功能）

### Agent 收藏功能

- **收藏/取消收藏**：用户可在 Agent 卡片和详情页点击星标收藏 Agent（FR-001）
- **我的收藏列表**：AgentsPage 新增"收藏"Tab，展示个人收藏的 Agent（FR-002）
- **收藏数统计**：Agent 卡片和详情页显示收藏总数，支持 1.2k 格式化（FR-003）

## 🏗️ 后端变更

### 新增

- `server/src/models/Favorite.ts` — Favorite 数据模型
- `server/src/routes/favorite.ts` — 收藏 API（4 个端点）

### 修改

- `server/src/models/Agent.ts` — 新增 `favoriteCount` 字段
- `server/src/index.ts` — 注册 favoriteRouter

### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/favorites` | 收藏 Agent |
| DELETE | `/api/favorites/:agentId` | 取消收藏 |
| GET | `/api/favorites` | 获取收藏列表 |
| GET | `/api/favorites/check` | 批量检查收藏状态 |

## 🎨 前端变更

### 新增

- `web/src/components/FavoriteButton.tsx` — 收藏按钮组件

### 修改

- `web/src/pages/AgentsPage.tsx` — 新增"收藏"Tab
- `web/src/pages/AgentDetailPage.tsx` — 集成 FavoriteButton

## 🗄️ 数据库变更

- 新增 `favorites` 集合（3 个索引）
- `agents` 集合新增 `favoriteCount` 字段
