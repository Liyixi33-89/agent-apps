# Service 层索引规范

## 生成目标

- `03_index_service.md` — Service 总览索引
- `services/{ServiceName}.md` — 每个 Service 一个详情文件

## 分析流程

1. 扫描 `server/src/services/` 目录下所有 `.ts` 文件
2. 对每个 Service 文件：
   - 读取文件内容，提取所有 export 的函数/类/对象
   - 提取函数签名（参数类型、返回类型）
   - 识别依赖的 Model、其他 Service、外部库
   - 分析核心业务逻辑流程
   - 识别错误处理模式

## 总览文件格式（03_index_service.md）

```markdown
# Service 索引

## Service 总览

| # | Service 名 | 文件 | 导出函数数 | 依赖 Model | 说明 |
|---|-----------|------|-----------|-----------|------|
| 1 | llmService | services/llmService.ts | 5 | Agent, Chat | LLM 调用服务 |
| 2 | mcpService | services/mcpService.ts | 8 | McpServer | MCP 工具管理 |

## Service 摘要

### llmService

**文件**: server/src/services/llmService.ts
**职责**: 封装 LLM API 调用，支持多 Provider

**导出函数**:

| 函数 | 入参 | 出参 | 说明 |
|------|------|------|------|
| callLLM(options) | CallOptions | Promise<LLMResponse> | 调用 LLM |
| streamChat(options) | StreamOptions | AsyncGenerator | 流式对话 |

**依赖**:

| 依赖 | 类型 | 用途 |
|------|------|------|
| openai | 外部库 | OpenAI SDK |
| Agent | Model | 获取 Agent 配置 |
```

## 详情文件格式（services/{ServiceName}.md）

```markdown
# {ServiceName}

**文件**: server/src/services/{filename}.ts
**复杂度**: 复杂/简单

## 职责
一句话描述该 Service 的核心职责。

## 依赖

| 依赖 | 类型 | 用途 |
|------|------|------|
| Agent | Model | 查询 Agent 配置 |
| openai | 外部库 | LLM API 调用 |

## 导出函数详情

### functionName(param1: Type1, param2: Type2): ReturnType

**入参**:
- param1: Type1 — 说明
- param2: Type2 — 说明

**出参**: ReturnType — 说明

**完整逻辑**:
1. 步骤一
2. 步骤二
3. 步骤三

**错误处理**:
| 错误 | 条件 | 处理方式 |
|------|------|---------|
| NotFoundError | 资源不存在 | throw 404 |

## 调用关系
Route.handler() → Service.fn() → Model.find() → MongoDB
```
