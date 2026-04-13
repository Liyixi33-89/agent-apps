# Mongoose Model 索引规范

## 生成目标

- `02_index_model.md` — Model 总览索引

## 分析流程

1. 扫描 `server/src/models/` 目录下所有 `.ts` 文件
2. 对每个 Model 文件：
   - 读取文件内容，提取 Schema 定义中的所有字段
   - 提取字段类型、required、default、ref（关联）、enum、unique、index 等约束
   - 提取 virtual 字段、methods、statics、pre/post hooks
   - 提取 TypeScript interface/type 定义
   - 识别与其他 Model 的关联关系（ref）

## 索引文件格式（02_index_model.md）

```markdown
# Mongoose Model 索引

## Model 总览

| # | Model 名 | 集合名 | 文件 | 字段数 | 说明 |
|---|---------|--------|------|--------|------|
| 1 | Agent | agents | models/Agent.ts | 12 | Agent 智能体 |
| 2 | Chat | chats | models/Chat.ts | 8 | 聊天会话 |

## Model 详情

### Agent

**文件**: server/src/models/Agent.ts
**集合**: agents

**Schema 字段**:

| 字段 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|------|------|------|--------|------|------|
| name | String | ✅ | — | — | Agent 名称 |
| description | String | — | '' | — | 描述 |
| userId | ObjectId | ✅ | — | ref: User | 所属用户 |
| status | String | — | 'active' | enum | 状态 |

**关联关系**:

| 字段 | 关联 Model | 关系类型 | 说明 |
|------|-----------|---------|------|
| userId | User | N:1 | 所属用户 |

**Hooks / Methods**:
- pre('save'): ...
- statics.findByUser(userId): ...

**TypeScript 接口**:
```typescript
interface IAgent {
  name: string;
  description: string;
  // ...
}
```
```
