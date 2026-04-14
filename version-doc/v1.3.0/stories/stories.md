# Story 拆分 — v1.3.0 Agent 收藏功能

**来源 PRD**：`version-doc/v1.3.0/prd/prd.md`
**拆分日期**：2026-04-14

---

## Epic：Agent 收藏功能

### Story 1.1：Favorite Model + 收藏 API

**优先级**：P0 | **估算**：0.5d | **依赖**：无

**描述**：创建 Favorite 数据模型，实现收藏/取消收藏/查询收藏列表的后端 API。

**验收标准**：AC-001 ~ AC-007（后端部分）

**实现要点**：
1. 新建 `server/src/models/Favorite.ts`，定义 `(userId, agentId)` 联合唯一索引
2. 新建 `server/src/routes/favorite.ts`，实现 POST/DELETE/GET 三个端点
3. 在 Agent Model 中新增 `favoriteCount` 字段
4. 收藏时 `favoriteCount++`，取消时 `favoriteCount--`

---

### Story 1.2：收藏按钮 UI 组件

**优先级**：P0 | **估算**：0.5d | **依赖**：Story 1.1

**描述**：创建可复用的 FavoriteButton 组件，在 Agent 卡片和详情页中使用。

**验收标准**：AC-001 ~ AC-007（前端部分）

**实现要点**：
1. 新建 `web/src/components/FavoriteButton.tsx`
2. 空心星标 ☆ / 实心星标 ★ 切换
3. 调用收藏 API，乐观更新 UI
4. 未登录时显示 Toast 提示
5. 在 AgentsPage 的 Agent 卡片和 AgentDetailPage 中集成

---

### Story 1.3：我的收藏 Tab

**优先级**：P0 | **估算**：0.5d | **依赖**：Story 1.1, 1.2

**描述**：在 AgentsPage 新增"收藏"Tab，展示用户收藏的 Agent 列表。

**验收标准**：AC-008 ~ AC-013

**实现要点**：
1. 修改 `web/src/pages/AgentsPage.tsx`，新增 Tab
2. 调用 `GET /api/favorites` 获取收藏列表
3. 复用现有 Agent 卡片组件
4. 空状态引导设计
5. Tab 角标显示收藏数量

---

### Story 1.4：收藏数展示

**优先级**：P1 | **估算**：0.5d | **依赖**：Story 1.1

**描述**：在 Agent 卡片和详情页显示收藏数。

**验收标准**：AC-014 ~ AC-018

**实现要点**：
1. Agent 卡片中星标旁显示收藏数
2. 数字格式化：< 1000 精确显示，≥ 1000 显示 "1.2k"
3. 收藏/取消收藏时本地乐观更新收藏数

---

## 实施顺序

```
Story 1.1（后端 API）
    ↓
Story 1.2（收藏按钮）──→ Story 1.3（收藏 Tab）
    ↓
Story 1.4（收藏数展示）
```

## 工时汇总

| Story | 估算 |
|-------|------|
| 1.1 Favorite Model + API | 0.5d |
| 1.2 收藏按钮 UI | 0.5d |
| 1.3 我的收藏 Tab | 0.5d |
| 1.4 收藏数展示 | 0.5d |
| **合计** | **2d** |
