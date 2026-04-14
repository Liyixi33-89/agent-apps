# 公共组件索引

## 组件总览

| # | 组件名 | 文件 | Props 数 |
|---|--------|------|---------|
| 1 | ContextUsageIndicator | src\components\ContextUsageIndicator.tsx | 4 |
| 2 | Layout | src\components\Layout.tsx | 1 |
| 3 | MessageRating | src\components\MessageRating.tsx | 5 |
| 4 | SkillVisualEditor | src\components\SkillVisualEditor.tsx | 1 |
| 5 | FavoriteButton | src\components\FavoriteButton.tsx | 7 | v1.2.0 新增：收藏按钮 |
| 6 | ReviewForm | src\components\ReviewForm.tsx | 2 | v1.3.0 新增：评价提交表单 |
| 7 | ReviewStats | src\components\ReviewStats.tsx | 1 | v1.3.0 新增：评分统计展示 |
| 8 | ReviewList | src\components\ReviewList.tsx | 2 | v1.3.0 新增：评价列表 |

## 组件详情

### ContextUsageIndicator

**文件**: src\components\ContextUsageIndicator.tsx

**Props**:

| Prop | 类型 | 可选 |
|------|------|------|
| messages | ChatMessage[] | — |
| maxContextTokens | number | ✅ |
| compressionEnabled | boolean | ✅ |
| className | string | ✅ |

### Layout

**文件**: src\components\Layout.tsx

**Props**:

| Prop | 类型 | 可选 |
|------|------|------|
| children | React.ReactNode | — |

### MessageRating

**文件**: src\components\MessageRating.tsx

**Props**:

| Prop | 类型 | 可选 |
|------|------|------|
| agentSlug | string | — |
| chatId | string | ✅ |
| messageId | string | ✅ |
| userInput | string | — |
| agentOutput | string | — |

### SkillVisualEditor

**文件**: src\components\SkillVisualEditor.tsx

**Props**:

| Prop | 类型 | 可选 |
|------|------|------|
| onAdd | (type: SkillStepType) => void | — |

### FavoriteButton

**文件**: src\components\FavoriteButton.tsx
**版本**: v1.2.0 新增

**Props**:

| Prop | 类型 | 可选 |
|------|------|------|
| agentId | string | — |
| initialFavorited | boolean | — |
| initialCount | number | — |
| showCount | boolean | ✅ |
| showText | boolean | ✅ |
| size | 'small' \| 'default' | ✅ |
| onToggle | (favorited: boolean) => void | ✅ |

### ReviewForm

**文件**: src\components\ReviewForm.tsx
**版本**: v1.3.0 新增

**Props**:

| Prop | 类型 | 可选 |
|------|------|------|
| agentSlug | string | — |
| onSubmitSuccess | () => void | — |

### ReviewStats

**文件**: src\components\ReviewStats.tsx
**版本**: v1.3.0 新增

**Props**:

| Prop | 类型 | 可选 |
|------|------|------|
| stats | ReviewStatsData | — |

### ReviewList

**文件**: src\components\ReviewList.tsx
**版本**: v1.3.0 新增

**Props**:

| Prop | 类型 | 可选 |
|------|------|------|
| agentSlug | string | — |
| refreshKey | number | — |

