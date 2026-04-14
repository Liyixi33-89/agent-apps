# 前端技术设计：Agent 评分评价

> 版本：v1.3.0
> PRD 来源：version-doc/v1.3.0/prd/prd.md
> 后端设计：version-doc/v1.3.0/design/be-agent-review.md
> 生成日期：2026-04-14
> 目标应用：web
> 技术栈：React 19 + Antd 6 + TailwindCSS + Zustand 5 + TypeScript

---

## 一、设计概述

**功能摘要**：在 Agent 详情页增加评分评价功能（提交 + 展示），在列表页增加评分显示和排序。

**涉及 PRD 模块**：功能模块 1, 2, 3

**变更范围**：

| 类型 | 新增 | 修改 | 复用 | 说明 |
|------|------|------|------|------|
| 页面 | 0 | 2 | 0 | AgentDetailPage, AgentsPage |
| 组件 | 3 | 0 | 3 | ReviewForm, ReviewStats, ReviewList |
| API 函数 | 4 | 1 | 0 | 4 个新增 + fetchAgents 修改 |
| Store | — | 无 | — | 无 Store 变更 |
| 类型定义 | 3 | 1 | 0 | AgentReview, ReviewStats, ReviewListResponse, Agent 修改 |
| 路由 | 0 | 0 | — | 无路由变更 |

---

## 二、路由设计

本次无新增路由。修改的是现有页面内容。

---

## 三、页面设计

### 3.1 AgentDetailPage（修改现有）

> 来源：PRD 功能模块 1, 2
> 文件：web/src/pages/AgentDetailPage.tsx

**新增区域布局**：

```
┌─────────────────────────────────────┐
│ 现有 Agent 详情内容                   │
├─────────────────────────────────────┤
│ 📊 评分统计区域（ReviewStats）         │
│  ├─ 左：大号平均分 + 星星 + 人数       │
│  └─ 右：各星级分布条形图              │
├─────────────────────────────────────┤
│ ✏️ 评价提交区域（ReviewForm）          │
│  ├─ 星星评分选择                      │
│  ├─ 文字评价输入框                    │
│  └─ 提交按钮                         │
├─────────────────────────────────────┤
│ 📝 评价列表（ReviewList）             │
│  ├─ 评价卡片 × N                     │
│  └─ 分页器                           │
└─────────────────────────────────────┘
```

**新增本地状态**：

| 状态 | 类型 | 初始值 | 说明 |
|------|------|--------|------|
| refreshKey | number | 0 | 评价提交后递增，触发列表刷新 |

**新增事件处理**：

| 函数名 | 触发元素 | 逻辑 |
|--------|---------|------|
| handleReviewSubmitted | ReviewForm.onSubmitSuccess | refreshKey++ 触发列表刷新 |

### 3.2 AgentsPage（修改现有）

> 来源：PRD 功能模块 3
> 文件：web/src/pages/AgentsPage.tsx

**修改内容**：
1. Agent 卡片新增评分显示区域
2. 排序下拉框新增"按评分排序"选项

**新增本地状态**：

| 状态 | 类型 | 初始值 | 说明 |
|------|------|--------|------|
| sortBy | string | '' | 排序方式，新增 'rating' 选项 |

---

## 四、组件设计

### 4.1 ReviewForm（新增）

> 来源：PRD 功能模块 1
> 文件：web/src/components/ReviewForm.tsx

**Props 接口**：

```typescript
interface ReviewFormProps {
  agentSlug: string;
  onSubmitSuccess: () => void;
}
```

**内部状态**：

| 状态 | 类型 | 初始值 | 说明 |
|------|------|--------|------|
| rating | number | 0 | 当前选择的评分 |
| content | string | '' | 评价内容 |
| loading | boolean | false | 提交中 |
| myReview | AgentReview \| null | null | 已有评价 |

**使用的 Antd 组件**：Rate, Input.TextArea, Button, message, Popconfirm

**渲染逻辑**：
- 未登录 → 显示"请先登录后评价"提示
- 已登录无评价 → 显示空表单
- 已登录有评价 → 预填已有数据 + 显示"更新评价"和"删除"按钮

### 4.2 ReviewStats（新增）

> 来源：PRD 功能模块 2
> 文件：web/src/components/ReviewStats.tsx

**Props 接口**：

```typescript
interface ReviewStatsProps {
  stats: {
    avgRating: number;
    totalReviews: number;
    distribution: number[];
  };
}
```

**使用的 Antd 组件**：Rate（disabled, allowHalf）, Progress

**渲染逻辑**：
- 左侧：大号数字（avgRating.toFixed(1)）+ Rate 组件 + "N 人评价"
- 右侧：5 行 Progress（5 星 → 1 星），每行显示百分比

### 4.3 ReviewList（新增）

> 来源：PRD 功能模块 2
> 文件：web/src/components/ReviewList.tsx

**Props 接口**：

```typescript
interface ReviewListProps {
  agentSlug: string;
  refreshKey: number;
}
```

**内部状态**：

| 状态 | 类型 | 初始值 | 说明 |
|------|------|--------|------|
| reviews | AgentReview[] | [] | 评价列表 |
| stats | ReviewStatsData \| null | null | 统计信息 |
| loading | boolean | false | 加载中 |
| page | number | 1 | 当前页码 |
| total | number | 0 | 总数 |

**使用的 Antd 组件**：List, Pagination, Rate（disabled）, Empty, Skeleton

---

## 五、API 封装设计

### 文件：web/src/api/index.ts

**新增函数**：

```typescript
// 获取评价列表 + 统计
export const fetchReviews = async (slug: string, params?: { page?: number; limit?: number }) => {
  const { data } = await api.get<ReviewListResponse>(`/agents/${slug}/reviews`, { params });
  return data;
};

// 提交/更新评价
export const submitReview = async (slug: string, body: { rating: number; content?: string }) => {
  const { data } = await api.post(`/agents/${slug}/reviews`, body);
  return data.data;
};

// 获取我的评价
export const fetchMyReview = async (slug: string) => {
  const { data } = await api.get(`/agents/${slug}/reviews/mine`);
  return data.data as AgentReview | null;
};

// 删除评价
export const deleteReview = async (slug: string) => {
  await api.delete(`/agents/${slug}/reviews`);
};
```

**修改函数**：

```typescript
// fetchAgents 增加 sort 参数
export const fetchAgents = async (params?: {
  category?: string;
  search?: string;
  modelType?: string;
  sort?: string;  // 新增
  page?: number;
  limit?: number;
}) => { ... };
```

---

## 六、Store 设计

本次无 Store 变更。评价数据通过组件本地状态管理，不需要全局状态。

---

## 七、类型定义设计

### 文件：web/src/types/index.ts

**新增类型**：

```typescript
// Agent 评价
export interface AgentReview {
  _id: string;
  agentSlug: string;
  userId: string;
  username: string;
  rating: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// 评分统计
export interface ReviewStatsData {
  avgRating: number;
  totalReviews: number;
  distribution: number[];
}

// 评价列表响应
export interface ReviewListResponse {
  success: boolean;
  data: {
    stats: ReviewStatsData;
    reviews: AgentReview[];
  };
  pagination: { page: number; limit: number; total: number; pages: number };
}
```

**修改类型**：

```typescript
// 在现有 Agent 接口中新增
export interface Agent {
  // ... 现有字段保持不变
  ratingStats?: {
    avgRating: number;
    totalReviews: number;
    distribution: number[];
  };
}
```

---

## 八、KB 参考

| 参考内容 | KB 文件 | 说明 |
|---------|---------|------|
| API 封装模式 | kb/frontend/@agency/web/06_architecture_patterns.md | Pattern-F001 API 封装 |
| Store 使用模式 | kb/frontend/@agency/web/06_architecture_patterns.md | Pattern-F004 确认无需 Store |
| 类型定义模式 | kb/frontend/@agency/web/06_architecture_patterns.md | Pattern-F006 类型集中定义 |
| 页面组件结构 | kb/frontend/@agency/web/06_architecture_patterns.md | Pattern-F005 页面结构 |
| 现有 AgentDetailPage | kb/frontend/@agency/web/01_index_page.md | 确认页面已有结构 |

---

## 九、实施建议

### 实施顺序

1. 新增类型定义（types/index.ts）
2. 新增 API 函数（api/index.ts）
3. 开发 ReviewForm 组件
4. 开发 ReviewStats 组件
5. 开发 ReviewList 组件
6. 修改 AgentDetailPage（集成 3 个组件）
7. 修改 AgentsPage（卡片评分 + 排序）
8. 联调测试

### 测试要点

| 测试场景 | 预期结果 |
|---------|---------|
| 未登录查看详情页 | 看到评分统计和列表，评价表单显示登录提示 |
| 已登录首次评价 | 提交成功，列表刷新 |
| 已登录修改评价 | 表单预填，更新成功 |
| 已登录删除评价 | 确认后删除，表单恢复 |
| 列表页评分显示 | 卡片显示 ⭐ 4.2 (56) |
| 列表页按评分排序 | 高分 Agent 排在前面 |
