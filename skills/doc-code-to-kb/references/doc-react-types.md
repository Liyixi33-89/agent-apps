# TypeScript 类型定义索引规范

## 生成目标

- `05_index_types.md` — 类型定义索引

## 分析流程

1. 扫描 `src/types/` 目录下所有 `.ts` 文件
2. 对每个类型文件：
   - 读取文件内容，提取所有 interface / type / enum 定义
   - 提取每个类型的字段及类型
   - 识别类型之间的继承/组合关系
   - 标注哪些类型被哪些页面/组件使用

## 索引文件格式（05_index_types.md）

```markdown
# TypeScript 类型定义索引

## 类型总览

| # | 类型名 | 种类 | 文件 | 字段数 | 说明 |
|---|--------|------|------|--------|------|
| 1 | Agent | interface | types/index.ts | 10 | Agent 智能体 |
| 2 | Chat | interface | types/index.ts | 6 | 聊天会话 |
| 3 | Message | interface | types/index.ts | 8 | 聊天消息 |

## 类型详情

### Agent

**文件**: src/types/index.ts
**种类**: interface

| 字段 | 类型 | 可选 | 说明 |
|------|------|------|------|
| _id | string | — | ID |
| name | string | — | 名称 |
| description | string | — | 描述 |
| systemPrompt | string | — | 系统提示词 |
| model | string | — | 使用的模型 |
| tools | string[] | ✅ | 工具列表 |

**被使用于**:
- pages/AgentsPage.tsx
- pages/ChatPage.tsx
- api/index.ts
```
