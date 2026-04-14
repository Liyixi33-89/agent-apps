---
name: api-doc-gen
description: "基于项目知识库（kb/）中的 API 索引和路由源码，自动生成 OpenAPI 3.0 规范的 API 文档。支持输出 YAML/JSON 格式，可直接导入 Swagger UI 或 Postman。"
triggers:
  - API 文档
  - Swagger
  - OpenAPI
  - 接口文档
  - API doc
  - 生成接口文档
---

# API-Doc-Gen — API 文档生成

## 目标

基于项目知识库和后端源码，自动生成符合 OpenAPI 3.0 规范的 API 文档，可直接导入 Swagger UI 或 Postman 使用。

**核心隐喻**：你是一个"技术文档工程师"——把代码中隐含的接口契约显式化为标准文档。准确、完整、可机器解析。

---

## 设计原则

1. **KB 优先**：优先从知识库索引中提取 API 信息，不足时再读源码
2. **OpenAPI 3.0 标准**：严格遵循 OpenAPI 3.0 规范，确保工具兼容性
3. **类型完整**：所有请求参数和响应体都有完整的 Schema 定义
4. **示例丰富**：每个端点都有请求/响应示例
5. **分组清晰**：按业务模块分组（tags），便于浏览

---

## 输入

| 参数 | 必填 | 说明 |
|------|------|------|
| **输出格式** | 否 | `yaml` / `json`，默认 `yaml` |
| **范围** | 否 | 指定只生成某些模块的文档（如"只生成 Agent 相关 API"），默认全部 |
| **版本号** | 否 | API 文档版本号，默认从 package.json 读取 |

## 输出

| 文件 | 说明 |
|------|------|
| `server/docs/openapi.yaml` | OpenAPI 3.0 文档（YAML 格式） |
| `server/docs/openapi.json` | OpenAPI 3.0 文档（JSON 格式，可选） |

---

## 编排流程

### 第 0 步：检查前置条件

1. 检查 KB 是否存在（`kb/server/server/01_index_api.md`）
   - 存在 → 从 KB 提取 API 信息
   - 不存在 → 直接扫描源码
2. 检查 `server/docs/` 目录是否存在
   - 不存在 → 创建

### 第 1 步：收集 API 信息

#### 1.1 从 KB 索引提取

读取 `kb/server/server/01_index_api.md`，提取所有 API 端点：
- HTTP 方法
- 路径
- 中间件（认证要求）
- 简要说明

#### 1.2 从 KB 详情补充

对每个路由文件，读取 `kb/server/server/api/{routeName}.md`，提取：
- 请求参数（query/params/body）
- 响应结构
- 错误响应
- 业务逻辑说明

#### 1.3 从 Model KB 提取 Schema

读取 `kb/server/server/02_index_model.md`，提取数据模型定义，用于生成 Schema。

#### 1.4 源码补充（KB 不足时）

如果 KB 信息不完整，直接读取源码文件补充：
- `server/src/routes/*.ts` — 路由定义
- `server/src/models/*.ts` — TypeScript 接口定义

### 第 2 步：生成 OpenAPI 文档

```yaml
openapi: 3.0.3
info:
  title: Agency Agents API
  description: Agency Agents AI 开发平台 API 文档
  version: "{version}"
  contact:
    name: Agency Agents Team

servers:
  - url: http://localhost:3000
    description: 开发环境
  - url: https://api.agency-agents.com
    description: 生产环境

tags:
  - name: Auth
    description: 认证相关
  - name: Agents
    description: Agent 管理
  - name: Skills
    description: Skill 管理
  # ... 按业务模块分组

paths:
  /api/{resource}:
    get:
      tags:
        - {Tag}
      summary: {简要说明}
      description: {详细说明}
      security:
        - bearerAuth: []
      parameters:
        - name: {paramName}
          in: query/path
          required: true/false
          schema:
            type: string
          description: {说明}
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    $ref: '#/components/schemas/{SchemaName}'
              example:
                success: true
                data: {示例数据}
        '401':
          description: 未认证
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: 服务器错误

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    ErrorResponse:
      type: object
      properties:
        success:
          type: boolean
          example: false
        error:
          type: string
          example: "错误信息"

    {ModelName}:
      type: object
      properties:
        _id:
          type: string
          description: MongoDB ObjectId
        {field}:
          type: {type}
          description: {说明}
      required:
        - {requiredField}
```

### 第 3 步：添加请求/响应示例

对每个端点，生成有意义的示例数据：

```yaml
example:
  success: true
  data:
    _id: "507f1f77bcf86cd799439011"
    name: "智能客服助手"
    description: "基于 GPT-4 的智能客服 Agent"
    status: "active"
    createdAt: "2024-01-15T08:30:00Z"
```

**示例数据规则**：
- 使用有意义的中文数据（不用 "test"、"aaa"）
- 日期使用 ISO 8601 格式
- ObjectId 使用合法格式
- 枚举值使用实际的枚举选项

### 第 4 步：自检

- [ ] 所有 API 端点都已覆盖
- [ ] 每个端点都有请求参数和响应 Schema
- [ ] 每个端点都有至少一个示例
- [ ] Schema 定义与 Model 一致
- [ ] 认证要求标注正确
- [ ] YAML/JSON 格式合法（可被 Swagger UI 解析）

### 第 5 步：输出摘要

```
## API 文档生成完成

- 输出文件：server/docs/openapi.yaml
- API 端点数：{N} 个
- Schema 数：{N} 个

| 模块 | 端点数 |
|------|--------|
| Auth | {N} |
| Agents | {N} |
| Skills | {N} |

使用方式：
1. Swagger UI：将 openapi.yaml 导入 https://editor.swagger.io/
2. Postman：Import → File → 选择 openapi.yaml
3. 本地预览：`npx swagger-ui-express` 或 `npx redoc-cli serve server/docs/openapi.yaml`

建议下一步：
1. 审阅 API 文档，确认准确性
2. 将文档集成到项目的开发服务器（如 /api-docs 路由）
```

---

## 约束

### 文档约束

1. **不编造 API**：只记录实际存在的 API 端点
2. **Schema 与代码一致**：字段类型、必填性必须与 Model 定义一致
3. **示例数据合法**：示例数据必须符合 Schema 定义
4. **OpenAPI 3.0 合规**：输出必须通过 OpenAPI 校验器验证

### 边界条件处理

| 场景 | 处理方式 |
|------|---------|
| KB 不存在 | 直接扫描源码生成 |
| 某些 API 缺少类型定义 | 从源码推断，标注 `⚠️ 类型推断` |
| 内部 API（不对外暴露） | 标注 `x-internal: true` |
| WebSocket 端点 | 使用 AsyncAPI 扩展或单独说明 |
