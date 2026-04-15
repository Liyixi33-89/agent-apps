---
name: prd-to-backend-design
description: "将 PRD 转化为后端技术设计文档（be-*.md）。基于 PRD 中的功能需求和项目知识库（kb/）中的现有后端架构，设计数据库 Schema、API 接口、Service 业务逻辑、中间件等，输出可直接指导后端编码的技术设计文档。"
triggers:
  - 后端设计
  - 后端技术设计
  - backend design
  - 数据库设计
  - 接口设计
  - API 设计
  - be 设计文档
---

# PRD-TO-BACKEND-DESIGN — PRD 转后端技术设计文档

## 目标

将 PRD 中的产品需求转化为后端技术设计文档，覆盖数据库 Schema、API 接口、Service 业务逻辑、中间件配置等，让后端开发人员可以直接按文档编码。

**核心隐喻**：你是一个"后端架构师"——把产品经理的"做什么"翻译成后端开发的"怎么做"。每个设计决策都要有理由，每个接口都要有完整定义。

---

## 设计原则

1. **KB 驱动**：所有设计必须基于项目知识库中的现有架构，确保与现有代码风格、命名规范、分层架构一致
2. **增量设计**：明确标注哪些是新增、哪些是修改现有、哪些是复用，避免破坏现有功能
3. **完整定义**：每个 API 必须有完整的请求/响应定义，每个 Model 必须有完整的 Schema 定义
4. **可追溯**：每个设计点都标注 PRD 来源
5. **遵循现有模式**：新代码必须遵循项目现有的编码模式（路由注册方式、Service 调用方式、错误处理方式等）

---

## 适用技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| Web 框架 | Koa 3 | 路由、中间件 |
| ORM | Mongoose 8 | MongoDB Schema、Model |
| 语言 | TypeScript | 强类型 |
| 认证 | JWT + RBAC | jsonwebtoken + 自定义中间件 |
| 分层 | Route → Service → Model | 三层架构 |

---

## 输入

| 参数 | 必填 | 说明 |
|------|------|------|
| **PRD 文件** | ✅ | `version-doc/{版本号}/prd/prd.md` |
| **版本号** | ✅ | 如 `v1.0.1`，用于确定输入/输出目录 |
| **功能范围** | 否 | 指定只设计某些功能模块（默认全部） |

**版本号获取规则**：
1. 如果用户直接指定了版本号 → 使用用户指定的
2. 如果文件路径中包含版本号 → 从路径提取
3. 如果以上未提供 → **向用户询问版本号**，不可跳过

## 输出

**输出位置**：`version-doc/{版本号}/design/`

| 文件 | 说明 |
|------|------|
| `be-{feature}.md` | 每个功能模块一个后端设计文档 |

如果功能模块较少（≤2 个），可以合并为一个 `be-design.md`。

---

## 编排流程

### 第 0 步：检查前置条件

1. 检查 `version-doc/{版本号}/prd/prd.md` 是否存在
   - 不存在 → 提示用户先执行 `prd-brd-to-prd` Skill
2. 检查 KB 是否存在
   - `kb/server/server/` 不存在 → 提示用户先执行 `doc-code-to-kb`，但仍可继续（标注"⚠️ 未参考 KB"）

### 第 1 步：读取 PRD 并提取后端相关需求

读取 `version-doc/{版本号}/prd/prd.md`，提取：
- 所有功能模块及其接口约定
- 数据模型约定
- 非功能需求（性能、安全）
- 需求优先级

### 第 2 步：深度查阅项目知识库

**必须读取以下 KB 文件**（按需）：

| KB 文件 | 目的 |
|---------|------|
| `kb/server/server/00_project_map.md` | 了解项目整体架构、目录结构、模块关系 |
| `kb/server/server/01_index_api.md` | 了解现有 API 路由，避免路径冲突，复用命名规范 |
| `kb/server/server/02_index_model.md` | 了解现有 Model Schema，确认字段命名规范、关联方式 |
| `kb/server/server/03_index_service.md` | 了解现有 Service 分层，确认调用模式 |
| `kb/server/server/04_index_config.md` | 了解中间件、认证方式、环境变量 |

**如果需要更详细的信息**，进一步读取第三层详情文件：
- `kb/server/server/api/{routeName}.md` — 了解类似路由的实现模式
- `kb/server/server/services/{serviceName}.md` — 了解类似 Service 的实现模式

**从 KB 中提取的关键信息**：
- 路由注册方式（`router.get/post/put/delete`）
- 中间件使用方式（`requireAuth`、`requireAdmin`）
- 错误处理模式（`ctx.body = { success: false, error: ... }`）
- 分页模式（`page`、`limit` 参数）
- 响应格式（`{ success: true, data: ... }`）
- Model 定义方式（Mongoose Schema 语法）
- Service 导出方式（函数导出 vs 类导出）

### 第 3 步：设计数据模型

对 PRD 中涉及的每个数据模型：

#### 3.1 新增 Model

```markdown
### {ModelName} Model（新增）

> 来源：PRD 功能模块 {N}

**文件位置**：`server/src/models/{ModelName}.ts`

**Schema 定义**：

| 字段 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|------|------|------|--------|------|------|
| name | String | ✅ | — | — | 名称 |
| userId | ObjectId | ✅ | — | ✅ | 关联 User，ref: 'User' |
| status | String | ✅ | 'active' | ✅ | 枚举: active/inactive |
| createdAt | Date | — | Date.now | — | 自动生成 |
| updatedAt | Date | — | Date.now | — | 自动更新 |

**索引设计**：

| 索引 | 字段 | 类型 | 说明 |
|------|------|------|------|
| idx_userId | { userId: 1 } | 普通索引 | 按用户查询 |
| idx_status | { status: 1, createdAt: -1 } | 复合索引 | 按状态+时间排序 |

**关联关系**：
- `userId` → User Model（N:1）
```

#### 3.2 修改现有 Model

```markdown
### {ModelName} Model（修改现有）

> 来源：PRD 功能模块 {N}
> 现有定义：kb/server/server/02_index_model.md

**新增字段**：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| tags | [String] | 否 | [] | 标签数组 |

**新增索引**：

| 索引 | 字段 | 说明 |
|------|------|------|
| idx_tags | { tags: 1 } | 多键索引，支持标签筛选 |

**数据迁移**：
- 现有数据的 tags 字段默认为空数组 `[]`
- 无需停机迁移，Mongoose 会自动处理默认值
```

### 第 4 步：设计 API 接口

对 PRD 中涉及的每个 API 接口：

```markdown
### {HTTP_METHOD} {路径}

> 来源：PRD 功能模块 {N}
> 状态：新增 / 修改现有

**文件位置**：`server/src/routes/{routeFile}.ts`
**中间件**：`requireAuth` / `requireAdmin` / 无

**请求参数**：

| 参数 | 位置 | 类型 | 必填 | 校验规则 | 说明 |
|------|------|------|------|---------|------|
| page | query | number | 否 | ≥1 | 页码，默认 1 |
| limit | query | number | 否 | 1-100 | 每页数量，默认 20 |
| tags | query | string | 否 | 逗号分隔 | 标签筛选 |

**请求 Body**（POST/PUT）：

```typescript
interface CreateXxxRequest {
  name: string;        // 必填，1-100 字符
  description?: string; // 可选，最多 500 字符
  tags?: string[];     // 可选，最多 10 个
}
```

**响应 Body**：

```typescript
// 成功
{
  success: true,
  data: {
    // 具体字段
  }
}

// 失败
{
  success: false,
  error: string  // 错误信息
}
```

**业务逻辑**：
1. 校验请求参数
2. 调用 {ServiceName}.{methodName}()
3. 返回结果

**错误处理**：

| 错误码 | 条件 | 响应 |
|--------|------|------|
| 400 | 参数校验失败 | `{ success: false, error: '参数错误: ...' }` |
| 401 | 未认证 | `{ success: false, error: '请先登录' }` |
| 404 | 资源不存在 | `{ success: false, error: '未找到...' }` |
```

### 第 5 步：设计 Service 层

对需要新增/修改的 Service：

```markdown
### {ServiceName}（新增/修改现有）

> 来源：PRD 功能模块 {N}

**文件位置**：`server/src/services/{serviceName}.ts`

**依赖**：

| 依赖 | 类型 | 用途 |
|------|------|------|
| {ModelName} | Model | 数据库操作 |
| {OtherService} | Service | 调用其他服务 |

**导出函数**：

#### {functionName}(params: Type): Promise<ReturnType>

**入参**：
- param1: Type1 — 说明
- param2: Type2 — 说明

**逻辑步骤**：
1. 参数校验
2. 查询/操作数据库
3. 处理业务逻辑
4. 返回结果

**错误处理**：
- 条件 A → throw new Error('...')
- 条件 B → throw new Error('...')
```

### 第 6 步：设计中间件/配置变更（如需要）

如果需求涉及新的中间件或配置变更：

```markdown
### 中间件/配置变更

**新增中间件**：
- {中间件名}：{用途}

**环境变量变更**：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| {VAR_NAME} | {说明} | {默认值} |

**路由注册变更**：
- 在 `server/src/index.ts` 中新增路由挂载：`app.use(xxxRouter.routes())`
```

### 第 7 步：生成设计文档

读取 `{SKILL_DIR}/references/be-design-template.md`，按模板生成设计文档。

写入 `version-doc/{版本号}/design/be-{feature}.md`。

### 第 8 步：自检

检查设计文档的完整性：
- [ ] "文件变更清单"章节已填写完整，覆盖所有涉及的文件
- [ ] 每个 PRD 中的接口约定都有对应的 API 设计
- [ ] 每个 PRD 中的数据模型约定都有对应的 Schema 设计
- [ ] 所有新增 API 都有完整的请求/响应定义
- [ ] 所有修改现有的部分都标注了具体变更内容
- [ ] 错误处理覆盖了常见场景
- [ ] 索引设计覆盖了查询场景

### 第 9 步：输出摘要

```
## 后端技术设计完成

- PRD 来源：version-doc/{版本号}/prd/prd.md
- 设计文件：{列出所有生成的 be-*.md 文件}

变更摘要：
- 新增 Model：{N} 个
- 修改 Model：{N} 个
- 新增 API：{N} 个
- 修改 API：{N} 个
- 新增 Service：{N} 个
- 修改 Service：{N} 个

建议下一步：
1. 使用 `prd-to-frontend-design` 生成前端技术设计文档
2. 使用 `gen-backend-code` 按设计文档生成后端代码
```

---

## 约束

### 设计约束

1. **遵循现有分层**：Route → Service → Model，不允许 Route 直接操作 Model（除非是极简的 CRUD）
2. **遵循现有命名**：
   - 路由文件：`camelCase.ts`（如 `agents.ts`）
   - Model 文件：`PascalCase.ts`（如 `Agent.ts`）
   - Service 文件：`camelCase.ts`（如 `agentService.ts`）
3. **遵循现有响应格式**：`{ success: boolean, data?: any, error?: string }`
4. **遵循现有认证方式**：使用 `requireAuth` / `requireAdmin` 中间件
5. **TypeScript 类型完整**：所有请求/响应都要有 TypeScript 接口定义

### 内容约束

1. **不超出 PRD 范围**：只设计 PRD 中明确要求的功能
2. **标注 PRD 来源**：每个设计点都标注 `来源：PRD 功能模块 {N}`
3. **标注变更状态**：每个 Model/API/Service 都标注 `新增` / `修改现有` / `复用`
4. **标注 KB 参考**：设计中参考了哪些 KB 文件

### 边界条件处理

| 场景 | 处理方式 |
|------|---------|
| PRD 不存在 | 提示用户先生成 PRD |
| KB 不存在 | 标注"⚠️ 未参考 KB"，按通用 Koa+Mongoose 模式设计 |
| PRD 接口约定与现有 API 冲突 | 在设计文档中标注冲突，给出解决方案 |
| 需要数据迁移 | 在设计文档中单独列出迁移方案 |
| 涉及第三方服务集成 | 在设计文档中列出集成方案和配置要求 |
