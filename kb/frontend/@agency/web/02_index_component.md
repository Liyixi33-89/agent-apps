# 公共组件索引

## 组件总览

| # | 组件名 | 文件 | Props 数 |
|---|--------|------|---------|
| 1 | ContextUsageIndicator | src\components\ContextUsageIndicator.tsx | 4 |
| 2 | Layout | src\components\Layout.tsx | 1 |
| 3 | MessageRating | src\components\MessageRating.tsx | 5 |
| 4 | SkillVisualEditor | src\components\SkillVisualEditor.tsx | 1 |

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

