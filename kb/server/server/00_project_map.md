# Agency Agents Platform — 项目全景

## 项目概述

| 属性 | 值 |
|------|-----|
| 项目名 | agency-agents-platform |
| 版本 | 2.0.0 |
| 类型 | Monorepo (npm workspaces) |
| 包管理 | npm |
| 子项目 | server / web / admin |

## 技术栈

| 子项目 | 框架 | 语言 | UI | 状态管理 | 构建工具 |
|--------|------|------|-----|---------|---------|
| server | Koa 3 | TypeScript | — | — | tsx / tsc |
| web | React 19 | TypeScript | Antd 6 + TailwindCSS | Zustand 5 | Vite 6 |
| admin | React 19 | TypeScript | Antd 6 + TailwindCSS | Zustand 5 | Vite 6 |

## 核心依赖

### Server

| 依赖 | 版本 | 用途 |
|------|------|------|
| koa | ^3.1.2 | Web 框架 |
| mongoose | ^8.12.1 | MongoDB ODM |
| openai | ^4.77.0 | LLM API SDK |
| jsonwebtoken | ^9.0.2 | JWT 认证 |
| bcryptjs | ^2.4.3 | 密码加密 |
| axios | ^1.7.9 | HTTP 客户端 |
| esbuild | ^0.28.0 | 代码编译 |
| mammoth | ^1.12.0 | Word 文档解析 |
| pdf-parse | ^2.4.5 | PDF 解析 |
| xlsx | ^0.18.5 | Excel 解析 |

### Web / Admin

| 依赖 | 版本 | 用途 |
|------|------|------|
| react | ^19.0.0 | UI 框架 |
| antd | ^6.3.4 | UI 组件库 |
| zustand | ^5.0.3 | 状态管理 |
| react-router-dom | ^7.1.5 | 路由 |
| axios | ^1.7.9 | HTTP 客户端 |
| @monaco-editor/react | ^4.7.0 | 代码编辑器 |
| lucide-react | ^0.469.0 | 图标库 |

## 目录结构

```
apps/
├── package.json              # Monorepo 根配置
├── .env                      # 环境变量
├── server/                   # 后端服务 (Koa + TypeScript)
│   └── src/
│       ├── index.ts          # 入口：Koa 实例、中间件注册、路由挂载、启动逻辑
│       ├── config/           # 配置（env.ts, defaultPrompts.ts, mcpTemplates.ts）
│       ├── db/               # 数据库连接（mongo.ts）
│       ├── middleware/       # 中间件（auth.ts: JWT/RBAC/限流/多租户）
│       ├── models/           # Mongoose 模型（16 个）
│       ├── routes/           # Koa 路由（18 个路由文件，155+ API 端点）
│       ├── services/         # 业务逻辑层（14 个 Service）
│       └── scripts/          # 脚本工具（seed, export, importAgents）
├── web/                      # 用户前端 (React + TypeScript)
│   └── src/
│       ├── App.tsx           # 根组件 + 路由定义
│       ├── api/index.ts      # API 请求封装（全量）
│       ├── components/       # 公共组件（4 个）
│       ├── pages/            # 页面组件（18 个顶层 + vibe-coding 子模块）
│       ├── store/index.ts    # Zustand 全局状态
│       └── types/index.ts    # TypeScript 类型定义
└── admin/                    # 管理后台 (React + TypeScript)
    └── src/
        ├── App.tsx           # 根组件 + 路由定义
        ├── api/index.ts      # API 请求封装（全量）
        ├── components/       # 公共组件（1 个：AdminLayout）
        ├── pages/            # 页面组件（16 个）
        └── store/index.ts    # Zustand 全局状态

```

## 模块关系

```
web (用户端:5173) ──HTTP──→ server (后端:4000) ←──HTTP── admin (管理端:5174)
                                  │
                                  ├── MongoDB (mongoose)
                                  ├── LLM APIs (OpenAI/Claude/Gemini/DeepSeek/Ollama)
                                  └── MCP Servers (动态工具)
```

## 路由挂载总览

| 路由模块 | 路由文件 | 端点数 | 说明 |
|---------|---------|--------|------|
| agentsRouter | routes/agents.ts | 7 | Agent CRUD + 聊天 |
| adminRouter | routes/admin.ts | 36 | 管理后台全量 API |
| extensionsRouter | routes/extensions.ts | 31 | 扩展功能（chat/mcp/skill/upload/vibe/pipeline 等） |
| knowledgeGraphRouter | routes/knowledgeGraph.ts | 2 | 知识图谱 |
| agentMarketRouter | routes/agentMarket.ts | 5 | Agent 市场 |

> 注：extensions 路由内部聚合了 chat、mcp、skill、upload、vibe、pipeline、oauth、compile、knowledge、market 等子路由。
