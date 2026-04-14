# 反模式清单 — 后端 (Server)

> 本文件列出后端开发中**禁止**的做法，每条都有检测方法。
> 借鉴自 BMAD-METHOD 的 Anti-Patterns 理念。

---

## AP-S001: 禁止在 Route 中直接操作复杂业务逻辑

**原因**：违反分层架构，Route 应只做参数解析和响应格式化
**检测**：`routes/*.ts` 中出现超过 20 行的业务逻辑代码
**例外**：简单的 CRUD 查询（如 `Agent.find(query).lean()`）允许在 Route 中

❌ **BAD**：
```typescript
// routes/agents.ts
router.post('/agents', async (ctx) => {
  const data = ctx.request.body;
  // 50 行的数据验证、转换、关联查询...
  const agent = new Agent(data);
  await agent.save();
  // 触发知识库生成、发送通知...
  ctx.body = { success: true, data: agent };
});
```

✅ **GOOD**：
```typescript
router.post('/agents', async (ctx) => {
  const result = await agentService.createAgent(ctx.request.body);
  ctx.body = { success: true, data: result };
});
```

---

## AP-S002: 禁止在非 config/env.ts 文件中读取 process.env

**原因**：环境变量应集中管理，散落在各处会导致配置混乱
**检测**：`process.env.` 出现在 `config/env.ts` 以外的文件中

❌ **BAD**：
```typescript
// routes/chat.ts
const apiKey = process.env.OPENAI_API_KEY; // ❌
```

✅ **GOOD**：
```typescript
import { env } from '../config/env.js';
const apiKey = env.openaiApiKey; // ✅
```

---

## AP-S003: 禁止空 catch 块

**原因**：吞掉错误会导致问题难以排查
**检测**：`catch (e) {}` 或 `catch { }` 且无注释说明

❌ **BAD**：
```typescript
try {
  await someOperation();
} catch {} // ❌ 错误被吞掉
```

✅ **GOOD**：
```typescript
try {
  await someOperation();
} catch (err) {
  console.error('操作失败:', err);
  // 或者重新抛出
  throw err;
}
```

---

## AP-S004: 禁止使用 CommonJS 语法

**原因**：项目使用 ESM 模块系统
**检测**：出现 `require(` 或 `module.exports`

❌ **BAD**：
```typescript
const Router = require('@koa/router');
module.exports = { agentsRouter };
```

✅ **GOOD**：
```typescript
import Router from '@koa/router';
export { agentsRouter };
```

---

## AP-S005: 禁止硬编码数据库连接字符串

**原因**：连接字符串应通过环境变量配置
**检测**：代码中出现 `mongodb://` 字面量（`config/env.ts` 中的默认值除外）

---

## AP-S006: 禁止在 Model 文件中包含业务逻辑

**原因**：Model 只定义 Schema、索引和静态方法，业务逻辑在 Service 层
**检测**：`models/*.ts` 中出现 HTTP 请求、LLM 调用等业务代码

---

## AP-S007: 禁止不设置 HTTP 状态码就返回错误

**原因**：客户端依赖状态码判断请求是否成功
**检测**：`ctx.body = { success: false, ... }` 但未设置 `ctx.status`

❌ **BAD**：
```typescript
ctx.body = { success: false, message: 'Not found' }; // ❌ 状态码仍是 200
```

✅ **GOOD**：
```typescript
ctx.status = 404;
ctx.body = { success: false, message: 'Not found' };
```

---

## AP-S008: 禁止在路由中使用 `console.log` 替代错误处理

**原因**：`console.log` 不会设置错误响应，客户端会收到空响应或 200
**检测**：catch 块中只有 `console.log` 而没有设置 `ctx.status` 和 `ctx.body`

---

## AP-S009: 禁止导入路径缺少 .js 后缀

**原因**：ESM 模块要求完整的文件扩展名
**检测**：`import ... from '...'` 中路径不以 `.js` 结尾（第三方包除外）

❌ **BAD**：
```typescript
import { Agent } from '../models/Agent';
```

✅ **GOOD**：
```typescript
import { Agent } from '../models/Agent.js';
```
