# 项目宪法 — Agency Agents Platform

> 本文件是项目的"宪法"，所有 AI Skill 在执行前必须加载此文件。
> 它定义了项目的架构决策、编码约定、技术栈锁定和反模式清单。
> 借鉴自 BMAD-METHOD 的 `project-context.md` 理念。

---

## 1. 架构决策记录（ADR）

### ADR-001: Monorepo 结构

- **决策**：使用 npm workspaces 管理 `server` / `web` / `admin` 三个子项目
- **原因**：共享类型定义、统一版本管理、一条命令启动全栈
- **影响**：所有子项目共享根 `node_modules`，`package.json` 在 `apps/` 根目录
- **约束**：子项目之间不直接 import，通过 HTTP API 通信

### ADR-002: 后端分层架构

- **决策**：`Route → Service → Model` 三层架构
- **原因**：职责分离 — Route 只做参数解析和响应格式化，Service 处理业务逻辑，Model 定义数据结构
- **约束**：
  - Route **不直接操作** Model（必须通过 Service）
  - Service **不直接设置** `ctx.body`（只返回数据）
  - Model 只定义 Schema 和静态方法，不包含业务逻辑
- **例外**：简单的 CRUD 路由（如 `GET /agents`）允许在 Route 中直接查询 Model

### ADR-003: 前端状态管理

- **决策**：Zustand 单 Store + `persist` 中间件 + `useShallow` 选择器
- **原因**：轻量、无 Provider 嵌套、支持 selector 避免不必要渲染
- **约束**：
  - Token **不存 Store**，存 `localStorage`（web 端 key: `token`，admin 端 key: `admin_token`）
  - `persist` 只持久化少量偏好字段（`lang`、`activeProvider`、`modelType`）
  - 多字段选择使用 `useAppStoreShallow` 而非直接解构

### ADR-004: API 通信模式

- **决策**：REST API + SSE 流式（长任务）
- **原因**：REST 覆盖 CRUD，SSE 覆盖 LLM 流式输出和 Pipeline 进度
- **约束**：
  - 普通请求用 `axios` 实例（自动附加 token、统一错误处理）
  - SSE 流式请求用原生 `fetch`（axios 不支持 ReadableStream）
  - SSE 事件格式：`data: { type, ...payload }\n`

### ADR-005: 认证与权限

- **决策**：JWT + RBAC + 可选多租户
- **原因**：JWT 无状态、RBAC 灵活、多租户为企业场景预留
- **约束**：
  - Token 通过 `Authorization: Bearer <token>` 传递
  - 中间件链：`requireAuth` → `requirePermission(resource, action)` → handler
  - `super_admin` 角色拥有所有权限，无需逐一检查
  - 管理端 API 前缀 `/api/admin`，需要 `requireAdmin` 中间件

---

## 2. 全局编码约定

### 2.1 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 文件名（后端 Route） | camelCase | `agentMarket.ts`, `vibeAppRuntime.ts` |
| 文件名（后端 Model） | PascalCase | `Agent.ts`, `KnowledgeBase.ts` |
| 文件名（后端 Service） | camelCase | `llmService.ts`, `mcpService.ts` |
| 文件名（前端页面） | PascalCase + Page 后缀 | `ChatPage.tsx`, `AgentMarketPage.tsx` |
| 文件名（前端组件） | PascalCase | `FavoriteButton.tsx`, `AdminLayout.tsx` |
| 接口名（后端） | I + PascalCase | `IAgent`, `ISection`, `ILocalizedText` |
| 接口名（前端） | PascalCase（无 I 前缀） | `Agent`, `ChatSession`, `Skill` |
| API 函数名 | 动词前缀 + 名词 | `fetchAgents`, `createSkill`, `deleteAgent` |
| 事件处理函数 | handle + 动作 | `handleClick`, `handleSend`, `handleNewSession` |
| Store setter | set + 字段名 | `setLang`, `setAgents`, `setActiveProvider` |
| 常量 | UPPER_SNAKE_CASE | `AGENTS_JSON`, `UPLOADS_DIR` |

### 2.2 API 函数命名动词表

| 动词 | 语义 | HTTP 方法 |
|------|------|----------|
| `fetch` | 获取数据（列表或详情） | GET |
| `create` | 创建资源 | POST |
| `update` | 更新资源 | PUT / PATCH |
| `delete` | 删除资源 | DELETE |
| `search` | 搜索（带查询参数） | POST（语义搜索）/ GET（关键词） |
| `execute` | 执行操作（Skill/Pipeline/Agent） | POST |
| `toggle` | 切换状态（启用/禁用） | POST |
| `deploy` / `undeploy` | 部署/卸载 | POST / DELETE |
| `trigger` | 触发一次性操作 | POST |

### 2.3 错误处理约定

**后端**：
```typescript
// ✅ 标准模式：Route handler 中 try-catch
router.get('/resource', async (ctx) => {
  try {
    const data = await someService.getData();
    ctx.body = { success: true, data };
  } catch (err: unknown) {
    ctx.status = 500;
    ctx.body = { success: false, message: (err as Error).message };
  }
});

// ✅ 全局兜底：index.ts 中的全局错误中间件会捕获未处理的异常
```

**前端**：
```typescript
// ✅ 标准模式：API 调用 try-catch + message.error()
const handleLoad = async () => {
  try {
    setLoading(true);
    const data = await fetchAgents();
    setAgents(data);
  } catch {
    message.error('加载失败');
  } finally {
    setLoading(false);
  }
};

// ✅ 响应拦截器已统一处理 401/403/404/500 错误提示
```

### 2.4 响应格式约定

所有后端 API 必须返回统一的 envelope 格式：

```typescript
// 成功
ctx.body = { success: true, data: result };

// 成功（带分页）
ctx.body = {
  success: true,
  data: items,
  pagination: { page, limit, total, pages: Math.ceil(total / limit) }
};

// 失败
ctx.status = 400; // 或 401/403/404/500
ctx.body = { success: false, message: '具体错误信息' };
```

---

## 3. 技术栈锁定

| 层级 | 技术 | 版本 | 禁止替代 |
|------|------|------|---------|
| 后端框架 | Koa | 3.x | ❌ Express / Fastify |
| ORM | Mongoose | 8.x | ❌ Prisma / TypeORM |
| 前端框架 | React | 19.x | ❌ Vue / Svelte |
| UI 库 | Antd | 6.x | ❌ MUI / Chakra |
| 样式 | TailwindCSS | 3.x | ❌ CSS Modules / Styled-Components |
| 状态管理 | Zustand | 5.x | ❌ Redux / MobX / Jotai |
| HTTP 客户端 | axios | 1.x | ❌ ky / got（SSE 场景除外，用原生 fetch） |
| 路由 | react-router-dom | 7.x | ❌ TanStack Router |
| 代码编辑器 | @monaco-editor/react | 4.x | ❌ CodeMirror |
| 图标 | lucide-react | 0.x | ❌ react-icons / heroicons |
| 构建工具 | Vite | 6.x | ❌ Webpack / Turbopack |
| 后端运行 | tsx | — | ❌ ts-node / nodemon |
| 数据库 | MongoDB | 7.x+ | ❌ PostgreSQL / MySQL |

---

## 4. 目录结构约定

```
apps/
├── package.json              # Monorepo 根配置（npm workspaces）
├── .env                      # 环境变量（不提交 Git）
├── server/src/
│   ├── index.ts              # 入口：Koa 实例 + 中间件 + 路由挂载 + 启动
│   ├── config/env.ts         # 环境变量集中管理（唯一读取 process.env 的地方）
│   ├── db/mongo.ts           # MongoDB 连接
│   ├── middleware/auth.ts    # 认证/权限/限流/多租户 中间件
│   ├── models/               # Mongoose Schema（PascalCase 文件名）
│   ├── routes/               # Koa Router（camelCase 文件名）
│   ├── services/             # 业务逻辑层（camelCase 文件名）
│   └── lib/                  # 工具函数和辅助模块
├── web/src/                  # 用户前端
│   ├── App.tsx               # 根组件 + 路由定义
│   ├── api/index.ts          # API 请求封装（唯一的 axios 实例）
│   ├── components/           # 公共组件
│   ├── pages/                # 页面组件（PascalCase + Page 后缀）
│   ├── store/index.ts        # Zustand 全局状态（唯一的 Store）
│   └── types/index.ts        # TypeScript 类型定义（唯一的类型文件）
├── admin/src/                # 管理后台（结构同 web）
├── kb/                       # 项目知识库（本文件所在目录）
└── skills/                   # AI Skill 定义
```

---

## 5. 多语言（i18n）约定

- 所有面向用户的文本使用 `LocalizedText` 结构：`{ zh: string; en: string }`
- 后端 Model 中使用 `localizedTextSchema`（来自 `models/shared.ts`）
- 前端通过 `useLang()` Hook 获取当前语言，按 `name[lang]` 取值
- 代码注释使用中文

---

## 6. 环境变量约定

- **唯一读取点**：`server/src/config/env.ts` 是唯一读取 `process.env` 的文件
- **其他文件**：通过 `import { env } from '../config/env.js'` 获取配置
- **前端**：通过 `import.meta.env.VITE_*` 获取（Vite 约定）
- **敏感信息**：生产环境必须通过环境变量配置，开发环境使用安全的随机默认值
- **.env 文件搜索顺序**：`apps/.env` → `apps/.env.local` → 根目录 `.env` → `server/.env`

---

## 7. LLM Provider 约定

- 支持 5 个 Provider：`ollama` | `openai` | `claude` | `gemini` | `deepseek`
- 每个 Provider 有 `textModel` 和 `visionModel` 两个模型配置
- 路由策略：`manual`（手动指定）| `auto`（自动选择）| `fallback`（失败降级）
- Provider 切换通过 `env.activeProvider` 全局配置，前端通过 Store 的 `activeProvider` 字段

---

## 8. 文件大小与复杂度约定

| 指标 | 阈值 | 处理方式 |
|------|------|---------|
| 单文件行数 | > 500 行 | 应拆分为多个模块 |
| 单函数行数 | > 80 行 | 应拆分为子函数 |
| 路由文件端点数 | > 20 个 | 应拆分为子路由文件 |
| API 文件函数数 | > 50 个 | 应按功能域分区（用注释分隔） |
| 组件 Props 数 | > 10 个 | 应考虑拆分组件或使用组合模式 |
