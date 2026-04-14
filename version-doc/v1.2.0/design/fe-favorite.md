# 前端技术设计 — Agent 收藏功能

**版本**：v1.3.0
**日期**：2026-04-14
**来源 PRD**：`version-doc/v1.3.0/prd/prd.md`

---

## 1. 新增文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `web/src/components/FavoriteButton.tsx` | 组件 | 收藏按钮组件 |
| `web/src/api/favorite.ts` | API | 收藏相关 API 封装 |

## 2. 修改文件

| 文件 | 修改内容 |
|------|---------|
| `web/src/pages/AgentsPage.tsx` | 新增"收藏"Tab + 收藏列表 |
| `web/src/pages/AgentDetailPage.tsx` | 集成 FavoriteButton |
| `web/src/types/index.ts` | 新增 Favorite 相关类型 |
| `web/src/api/index.ts` | 导出 favorite API |

---

## 3. 组件设计

### 3.1 FavoriteButton

```typescript
interface FavoriteButtonProps {
  agentId: string;
  initialFavorited?: boolean;
  initialCount?: number;
  showCount?: boolean;       // 是否显示收藏数
  showText?: boolean;        // 是否显示文字（"已收藏"/"收藏"）
  size?: 'small' | 'default'; // 卡片用 small，详情页用 default
  onToggle?: (favorited: boolean) => void;
}
```

**状态管理**：
- 使用组件内部 state 管理 `isFavorited` 和 `count`
- 乐观更新：点击后立即更新 UI，API 失败时回滚
- 防抖：300ms 内重复点击忽略

**登录检查**：
- 从全局 store 获取登录状态
- 未登录时 `message.info('请先登录后再收藏')`

### 3.2 收藏数格式化工具函数

```typescript
// web/src/utils/formatCount.ts
const formatFavoriteCount = (count: number): string => {
  if (count <= 0) return '';
  if (count < 1000) return String(count);
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  return `${Math.floor(count / 1000)}k`;
};
```

---

## 4. API 封装

```typescript
// web/src/api/favorite.ts
export const favoriteApi = {
  add: (agentId: string) => request.post('/api/favorites', { agentId }),
  remove: (agentId: string) => request.delete(`/api/favorites/${agentId}`),
  list: (params?: { page?: number; limit?: number }) => request.get('/api/favorites', { params }),
  check: (agentIds: string[]) => request.get('/api/favorites/check', { params: { agentIds: agentIds.join(',') } }),
};
```

---

## 5. 页面修改

### 5.1 AgentsPage 修改

```
现有结构：
<Tabs>
  <TabPane tab="全部" key="all">
    <AgentGrid agents={agents} />
  </TabPane>
</Tabs>

修改后：
<Tabs>
  <TabPane tab="全部" key="all">
    <AgentGrid agents={agents} />
  </TabPane>
  <TabPane tab={`⭐ 收藏 (${favoriteCount})`} key="favorites">  ← 新增
    {favorites.length > 0 ? (
      <AgentGrid agents={favorites} />
    ) : (
      <Empty description="还没有收藏的 Agent，去市场看看吧" />
    )}
  </TabPane>
</Tabs>
```

### 5.2 AgentDetailPage 修改

在 Agent 标题区域添加 FavoriteButton：

```tsx
<div className="flex items-center gap-4">
  <h1>{agent.name}</h1>
  <FavoriteButton
    agentId={agent._id}
    initialFavorited={isFavorited}
    initialCount={agent.favoriteCount}
    showCount
    showText
    size="default"
  />
</div>
```

---

## 6. 类型定义

```typescript
// web/src/types/index.ts 新增
export interface IFavoriteItem {
  favoriteId: string;
  agent: IAgent;
  createdAt: string;
}

export interface IFavoriteListResponse {
  items: IFavoriteItem[];
  total: number;
  page: number;
  limit: number;
}
```

---

## 7. 批量收藏状态检查

在 AgentsPage 加载 Agent 列表后，调用 `favoriteApi.check(agentIds)` 批量获取收藏状态，避免每个卡片单独请求。
