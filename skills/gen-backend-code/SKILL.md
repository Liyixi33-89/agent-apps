---
name: gen-backend-code
description: "读取后端技术设计文档（be-*.md），生成/修改后端代码。基于设计文档中的 Model、API、Service 定义，结合项目知识库（kb/）中的现有代码模式，生成符合项目规范的 TypeScript 后端代码。"
triggers:
  - 生成后端代码
  - 后端编码
  - backend code
  - 生成 API
  - 生成 Model
  - 生成 Service
  - 后端开发
---

# Gen-Backend-Code — 后端代码生成

## 目标

读取后端技术设计文档（`be-*.md`），自动生成/修改 Koa + Mongoose + TypeScript 后端代码。生成的代码必须符合项目现有的编码规范和分层架构，可以直接运行。

**核心隐喻**：你是一个"后端开发工程师"——严格按照技术设计文档编码，遵循项目现有的代码风格和模式。不自由发挥，不偷工减料。

---

## 设计原则

1. **设计文档为纲**：严格按照 `be-*.md` 中的定义编码，不自行添加或省略功能
2. **KB 为参考**：参考知识库中的现有代码模式，确保新代码与现有代码风格一致
3. **增量修改**：修改现有文件时，只改设计文档中要求的部分，不动其他代码
4. **类型完整**：所有函数参数、返回值都有 TypeScript 类型
5. **错误处理完整**：按设计文档中的错误处理表实现所有错误场景

---

## 适用技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| Web 框架 | Koa | 3.x |
| ORM | Mongoose | 8.x |
| 语言 | TypeScript | 5.x |
| 认证 | JWT | jsonwebtoken |
| 运行时 | Node.js | 20+ |

---

## 输入

| 参数 | 必填 | 说明 |
|------|------|------|
| **设计文档** | ✅ | `version-doc/{版本号}/design/be-*.md` 文件路径 |
| **版本号** | ✅ | 如 `v1.0.1`，用于定位设计文档 |
| **生成范围** | 否 | 指定只生成某些部分（如"只生成 Model"），默认全部 |

## 输出

直接修改 `server/src/` 下的源码文件：

| 输出类型 | 文件位置 | 说明 |
|---------|---------|------|
| Model | `server/src/models/{ModelName}.ts` | Mongoose Schema + Model |
| Route | `server/src/routes/{routeName}.ts` | Koa 路由 + 处理函数 |
| Service | `server/src/services/{serviceName}.ts` | 业务逻辑层 |
| 入口注册 | `server/src/index.ts` | 路由挂载（如新增路由文件） |

---

## 编排流程

### 第 0 步：检查前置条件

1. 检查设计文档是否存在
   - 不存在 → 提示用户先执行 `prd-to-backend-design` Skill
2. 读取设计文档，提取变更清单

### 第 1 步：读取设计文档

完整读取 `version-doc/{版本号}/design/be-*.md`，提取：
- 所有需要新增/修改的 Model
- 所有需要新增/修改的 API 接口
- 所有需要新增/修改的 Service
- 中间件/配置变更
- 路由注册变更
- 实施顺序建议

### 第 2 步：查阅 KB 获取代码模式

读取 KB 中的现有代码，提取编码模式：

**Model 模式**（从 `kb/server/server/02_index_model.md` + 源码）：
- Schema 定义语法
- timestamps 配置
- 索引定义方式
- 虚拟字段定义方式
- Model 导出方式

**Route 模式**（从 `kb/server/server/01_index_api.md` + 源码）：
- 路由注册语法（`router.get/post/put/delete`）
- 中间件使用方式
- 请求参数获取方式（`ctx.params`、`ctx.query`、`ctx.request.body`）
- 响应格式（`ctx.body = { success, data/error }`）
- 错误处理方式

**Service 模式**（从 `kb/server/server/03_index_service.md` + 源码）：
- 函数导出方式
- 依赖导入方式
- 错误抛出方式

**⚠️ 重要**：必须读取至少一个同类型的现有源码文件作为参考模板。例如：
- 生成新 Model → 先读取一个现有 Model 文件（如 `server/src/models/Agent.ts`）
- 生成新 Route → 先读取一个现有 Route 文件（如 `server/src/routes/agents.ts`）
- 生成新 Service → 先读取一个现有 Service 文件（如 `server/src/services/agentService.ts`）

### 第 3 步：按顺序生成代码

**严格按照设计文档中的"实施顺序"执行**，通常为：

#### 3.1 生成/修改 Model

**新增 Model**：

```typescript
// server/src/models/{ModelName}.ts
import mongoose, { Schema, Document } from 'mongoose';

// TypeScript 接口
export interface I{ModelName} extends Document {
  field1: string;
  field2: number;
  // ... 按设计文档定义所有字段
}

// Mongoose Schema
const {modelName}Schema = new Schema<I{ModelName}>(
  {
    field1: { type: String, required: true },
    field2: { type: Number, default: 0 },
    // ... 按设计文档定义所有字段
  },
  { timestamps: true }
);

// 索引（按设计文档定义）
{modelName}Schema.index({ field1: 1 });

// 导出 Model
export default mongoose.model<I{ModelName}>('{ModelName}', {modelName}Schema);
```

**修改现有 Model**：
1. 读取现有 Model 文件
2. 在 interface 中添加新字段
3. 在 Schema 中添加新字段定义
4. 添加新索引（如需要）

#### 3.2 生成/修改 Service

**新增 Service**：

```typescript
// server/src/services/{serviceName}.ts
import {ModelName} from '../models/{ModelName}';
// ... 其他导入

// 按设计文档定义的每个导出函数
export const {functionName} = async (params: {ParamType}): Promise<{ReturnType}> => {
  // 按设计文档中的"逻辑步骤"实现
  // 1. 参数校验
  // 2. 数据库操作
  // 3. 业务逻辑
  // 4. 返回结果
};
```

**修改现有 Service**：
1. 读取现有 Service 文件
2. 添加新的导入（如需要）
3. 添加新的导出函数
4. 修改现有函数（如需要）

#### 3.3 生成/修改 Route

**新增路由文件**：

```typescript
// server/src/routes/{routeName}.ts
import Router from '@koa/router';
import { requireAuth } from '../middleware/auth';
import * as {serviceName} from '../services/{serviceName}';
// ... 其他导入

const router = new Router({ prefix: '/api/{prefix}' });

// GET /api/{prefix} — {说明}
router.get('/', requireAuth, async (ctx) => {
  try {
    // 按设计文档中的"业务逻辑"实现
    const result = await {serviceName}.{method}(params);
    ctx.body = { success: true, data: result };
  } catch (error: any) {
    ctx.status = 500;
    ctx.body = { success: false, error: error.message };
  }
});

// ... 按设计文档定义所有端点

export default router;
```

**修改现有路由文件**：
1. 读取现有路由文件
2. 添加新的导入（如需要）
3. 添加新的路由处理函数
4. 修改现有路由处理函数（如需要）

#### 3.4 注册路由（如新增路由文件）

在 `server/src/index.ts` 中：
1. 添加导入语句
2. 添加路由挂载（`app.use(xxxRouter.routes())`）

### 第 4 步：自检

对每个生成/修改的文件：
- [ ] TypeScript 类型完整，无 `any`（除非设计文档明确允许）
- [ ] 导入语句完整，无遗漏
- [ ] 错误处理覆盖设计文档中列出的所有场景
- [ ] 响应格式与现有代码一致（`{ success, data/error }`）
- [ ] 新增文件已在入口文件中注册

### 第 5 步：输出摘要

```
## 后端代码生成完成

- 设计文档：version-doc/{版本号}/design/be-{feature}.md

生成/修改的文件：

| # | 文件 | 操作 | 说明 |
|---|------|------|------|
| 1 | server/src/models/{Model}.ts | 新增/修改 | {说明} |
| 2 | server/src/services/{service}.ts | 新增/修改 | {说明} |
| 3 | server/src/routes/{route}.ts | 新增/修改 | {说明} |
| 4 | server/src/index.ts | 修改 | 注册新路由 |

建议下一步：
1. 运行 `npm run dev` 验证代码是否正常启动
2. 使用 Postman/curl 测试新增 API
3. 执行 `doc-code-to-kb` 更新知识库
```

---

## 约束

### 编码约束

1. **严格按设计文档**：不自行添加设计文档中未定义的 API、字段、函数
2. **不破坏现有代码**：修改现有文件时，只改设计文档要求的部分
3. **完整的错误处理**：每个 API 端点都必须有 try-catch
4. **完整的类型定义**：不使用 `any`（除非现有代码中已有此模式）
5. **遵循现有代码风格**：缩进、命名、注释风格与现有代码一致

### 生成顺序约束

1. **Model 先于 Service**：Service 依赖 Model
2. **Service 先于 Route**：Route 调用 Service
3. **Route 先于入口注册**：先有路由文件才能注册
4. **每个文件生成后立即写入**：不要等全部完成再写

### 边界条件处理

| 场景 | 处理方式 |
|------|---------|
| 设计文档不存在 | 提示用户先生成设计文档 |
| 现有文件与设计文档冲突 | 标注冲突，询问用户如何处理 |
| 设计文档中的类型在项目中不存在 | 在对应文件中新增类型定义 |
| 设计文档引用了不存在的 Service/Model | 先生成被依赖的文件 |
| 修改现有文件导致其他文件报错 | 检查并修复关联文件 |

---

## 代码模板参考

### Model 模板

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface I{ModelName} extends Document {
  // 字段定义
}

const {modelName}Schema = new Schema<I{ModelName}>(
  {
    // Schema 定义
  },
  { timestamps: true }
);

// 索引
{modelName}Schema.index({ /* 索引字段 */ });

export default mongoose.model<I{ModelName}>('{ModelName}', {modelName}Schema);
```

### Service 模板

```typescript
import {ModelName} from '../models/{ModelName}';

export const {functionName} = async (/* params */): Promise</* ReturnType */> => {
  // 业务逻辑
};
```

### Route 模板

```typescript
import Router from '@koa/router';
import { requireAuth } from '../middleware/auth';

const router = new Router({ prefix: '/api/{prefix}' });

router.get('/', requireAuth, async (ctx) => {
  try {
    // 处理逻辑
    ctx.body = { success: true, data: result };
  } catch (error: any) {
    ctx.status = 500;
    ctx.body = { success: false, error: error.message };
  }
});

export default router;
```
