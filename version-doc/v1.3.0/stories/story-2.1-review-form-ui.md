# Story 2.1: 评价提交 UI

> Epic: E2 — Agent 评分评价（前端）
> 来源: PRD 功能模块 1
> 优先级: P0
> 估算工时: 1 天
> 依赖: Story 1.2

## 背景

后端评价 API 就绪后，在 Agent 详情页增加评价提交区域，让用户可以打分和写评价。

## 目标

完成后，已登录用户可以在 Agent 详情页提交/修改/删除评价。

## 实现范围

### 需要新增的文件

| 文件 | 类型 | 说明 |
|------|------|------|
| web/src/components/ReviewForm.tsx | Component | 评价提交表单组件 |

### 需要修改的文件

| 文件 | 修改内容 | 说明 |
|------|---------|------|
| web/src/pages/AgentDetailPage.tsx | 引入 ReviewForm 组件 | 在详情内容下方添加评价区域 |
| web/src/api/index.ts | 新增评价相关 API 函数 | submitReview, deleteReview, fetchMyReview |
| web/src/types/index.ts | 新增 AgentReview 类型定义 | interface AgentReview |

## 技术细节

### ReviewForm 组件

```typescript
interface ReviewFormProps {
  agentSlug: string;
  onSubmitSuccess: () => void;  // 提交成功后刷新评价列表
}

// 状态
const [rating, setRating] = useState(0);
const [content, setContent] = useState('');
const [loading, setLoading] = useState(false);
const [myReview, setMyReview] = useState<AgentReview | null>(null);

// 加载已有评价
useEffect(() => { fetchMyReview(agentSlug).then(setMyReview); }, [agentSlug]);

// 提交
const handleSubmit = async () => {
  if (rating === 0) { message.warning('请先选择评分'); return; }
  setLoading(true);
  try {
    await submitReview(agentSlug, { rating, content });
    message.success('评价提交成功');
    onSubmitSuccess();
  } catch { message.error('提交失败'); }
  finally { setLoading(false); }
};
```

### API 函数

```typescript
export const submitReview = async (slug: string, body: { rating: number; content?: string }) => {
  const { data } = await api.post(`/agents/${slug}/reviews`, body);
  return data.data;
};

export const deleteReview = async (slug: string) => {
  await api.delete(`/agents/${slug}/reviews`);
};

export const fetchMyReview = async (slug: string) => {
  const { data } = await api.get(`/agents/${slug}/reviews/mine`);
  return data.data;
};
```

## 验收标准

- [ ] 已登录用户看到评分星星 + 评价输入框 + 提交按钮
- [ ] 未登录用户看到"请先登录后评价"提示
- [ ] 选择评分后可以提交（评价内容可选）
- [ ] 未选择评分直接提交时提示"请先选择评分"
- [ ] 已有评价时，表单预填已有评分和内容
- [ ] 修改评价后点击"更新评价"成功
- [ ] 删除评价后表单恢复初始状态
- [ ] 提交中按钮显示 loading 状态

## 注意事项

- 使用 Antd `Rate` 组件（5 星）
- 使用 Antd `Input.TextArea`（maxLength=500, showCount）
- 遵循前端架构模式 Pattern-F001：API 函数放在 api/index.ts
- 遵循前端架构模式 Pattern-F006：类型定义放在 types/index.ts
- 事件处理函数使用 `handle` 前缀
