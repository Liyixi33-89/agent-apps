# 架构模式 — 后端 (Server)

> 本文件记录后端代码中实际使用的架构模式，每个模式都有 ✅ GOOD / ❌ BAD 代码示例。
> 借鉴自 awesome-cursorrules 的 MDC 格式。

---

## Pattern-S001: 路由注册模式

后端使用 `@koa/router`，主路由前缀 `/api`，子路由通过 `router.use()` 挂载。

✅ **GOOD**：
```typescript
// routes/agents.ts — 主路由
import Router from '@koa/router';
export const agentsRouter = new Router({ prefix: '/api' });

// 直接定义的端点
agentsRouter.get('/health', async (ctx) => { ... });

// 挂载子路由
import { chatRouter } from './chat.js';
agentsRouter.use(chatRouter.routes(), chatRouter.allowedMethods());
```

```typescript
// routes/chat.ts — 子路由（无需重复 /api 前缀）
import Router from '@koa/router';
export const chatRouter = new Router();

chatRouter.post('/chat/session', async (ctx) => { ... });
chatRouter.get('/chat/sessions', async (ctx) => { ... });
```

❌ **BAD**：
```typescript
// 子路由重复定义前缀
export const chatRouter = new Router({ prefix: '/api' }); // ❌ 会变成 /api/api/chat

// 在 index.ts 中直接定义路由
app.use(async (ctx) => {
  if (ctx.path === '/api/health') { ... } // ❌ 不使用 Router
});
```

---

## Pattern-S002: 响应格式

所有 API 端点必须返回统一的 `{ success, data/message }` envelope 格式。

✅ **GOOD**：
```typescript
// 成功 — 返回数据
ctx.body = { success: true, data: agents };

// 成功 — 带分页
ctx.body = {
  success: true,
  data: agents,
  pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
};

// 失败 — 设置状态码 + 错误信息
ctx.status = 404;
ctx.body = { success: false, message: 'Agent not found' };
```

❌ **BAD**：
```typescript
ctx.body = agents;                          // ❌ 缺少 success 字段
ctx.body = { error: true, msg: '...' };     // ❌ 格式不统一
ctx.body = { code: 200, result: agents };   // ❌ 不是约定格式
```

---

## Pattern-S003: 认证中间件链

需要认证的端点通过中间件链保护：`requireAuth` → `requirePermission` → handler。

✅ **GOOD**：
```typescript
// 需要登录
router.get('/chat/sessions', requireAuth, async (ctx) => { ... });

// 需要特定权限
router.post('/agents', requireAuth, requirePermission('agent', 'create'), async (ctx) => { ... });

// 需要管理员（admin 路由）
router.get('/admin/dashboard', requireAdmin, async (ctx) => { ... });
```

❌ **BAD**：
```typescript
// 手动解析 token
router.get('/chat/sessions', async (ctx) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '');
  const decoded = jwt.verify(token, secret); // ❌ 应使用 requireAuth 中间件
  ...
});
```

---

## Pattern-S004: Model 定义模式

使用 Mongoose Schema，接口以 `I` 前缀命名，Schema 与 Model 在同一文件导出。

✅ **GOOD**：
```typescript
// models/Agent.ts
import mongoose, { Document, Schema } from 'mongoose';
import { localizedTextSchema, type ILocalizedText } from './shared.js';

// 1. 接口定义（I 前缀）
export interface IAgent extends Document {
  slug: string;
  name: ILocalizedText;
  // ...
}

// 2. 子 Schema（_id: false）
const sectionSchema = new Schema<ISection>({ ... }, { _id: false });

// 3. 主 Schema（timestamps: true）
const agentSchema = new Schema<IAgent>({ ... }, { timestamps: true });

// 4. 索引定义
agentSchema.index({ slug: 1 }, { unique: true });
agentSchema.index({ 'name.zh': 'text', 'name.en': 'text' });

// 5. 导出 Model（防重复注册）
export const Agent = mongoose.models.Agent || mongoose.model<IAgent>('Agent', agentSchema);
```

❌ **BAD**：
```typescript
// 不使用 TypeScript 接口
const agentSchema = new Schema({ name: String }); // ❌ 无类型约束

// 不防重复注册
export const Agent = mongoose.model('Agent', agentSchema); // ❌ 热重载时会报错

// 接口不加 I 前缀
export interface Agent extends Document { ... } // ❌ 与前端类型冲突
```

---

## Pattern-S005: 多语言文本（LocalizedText）

所有面向用户的文本字段使用 `localizedTextSchema`（来自 `models/shared.ts`）。

✅ **GOOD**：
```typescript
import { localizedTextSchema, type ILocalizedText } from './shared.js';

export interface ICategory extends Document {
  name: ILocalizedText;        // { zh: string; en: string }
  description: ILocalizedText;
}

const categorySchema = new Schema<ICategory>({
  name: localizedTextSchema,
  description: localizedTextSchema,
});
```

❌ **BAD**：
```typescript
// 直接用 String
name: { type: String }; // ❌ 不支持多语言

// 手动定义结构
name: { zh: { type: String }, en: { type: String } }; // ❌ 应复用 localizedTextSchema
```

---

## Pattern-S006: 环境变量读取

所有环境变量通过 `config/env.ts` 集中管理，其他文件通过 `env` 对象访问。

✅ **GOOD**：
```typescript
// config/env.ts — 唯一读取 process.env 的地方
export const env = {
  port: Number(process.env.PORT || 4000),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agency_agents',
  // ...
};

// 其他文件 — 通过 env 对象访问
import { env } from '../config/env.js';
const server = app.listen(env.port);
```

❌ **BAD**：
```typescript
// 在路由文件中直接读取 process.env
const port = process.env.PORT; // ❌ 应通过 env 对象

// 硬编码配置值
const mongoUri = 'mongodb://localhost:27017/mydb'; // ❌ 应使用环境变量
```

---

## Pattern-S007: SSE 流式响应

长任务（LLM 生成、Pipeline 执行）使用 SSE（Server-Sent Events）流式返回。

✅ **GOOD**：
```typescript
// 后端 — 设置 SSE 响应头
ctx.set('Content-Type', 'text/event-stream');
ctx.set('Cache-Control', 'no-cache');
ctx.set('Connection', 'keep-alive');

// 发送事件
const send = (event: object) => {
  ctx.res.write(`data: ${JSON.stringify(event)}\n\n`);
};

send({ type: 'start', message: '开始处理...' });
send({ type: 'step', step: 1, title: '分析需求' });
send({ type: 'done', success: true, result: '...' });
ctx.res.end();
```

❌ **BAD**：
```typescript
// 用 WebSocket 替代 SSE
const ws = new WebSocket(...); // ❌ 项目约定用 SSE

// 不设置 SSE 响应头
ctx.body = { type: 'stream', data: '...' }; // ❌ 不是 SSE 格式
```

---

## Pattern-S008: 全局错误处理

`index.ts` 中注册全局错误中间件，生产环境隐藏内部错误信息。

✅ **GOOD**：
```typescript
// index.ts — 全局错误中间件（在路由注册之前）
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    ctx.status = err.status || 500;
    ctx.body = {
      success: false,
      message: isProduction && ctx.status === 500
        ? 'Internal server error'
        : (err.message || 'Internal server error'),
    };
    ctx.app.emit('error', error, ctx);
  }
});
```

❌ **BAD**：
```typescript
// 每个路由都写完整的错误处理
router.get('/agents', async (ctx) => {
  try { ... } catch (err) {
    console.log(err); // ❌ 只 console.log，不设置响应
  }
});
```

---

## Pattern-S009: 导入路径约定

后端使用 ESM（`.js` 后缀），TypeScript 编译后保持 `.js` 扩展名。

✅ **GOOD**：
```typescript
import { Agent } from '../models/Agent.js';
import { env } from '../config/env.js';
import { chatRouter } from './chat.js';
```

❌ **BAD**：
```typescript
import { Agent } from '../models/Agent';     // ❌ 缺少 .js 后缀
import { Agent } from '../models/Agent.ts';  // ❌ 不用 .ts 后缀
const Agent = require('../models/Agent');     // ❌ 不用 CommonJS
```
