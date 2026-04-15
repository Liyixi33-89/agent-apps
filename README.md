
# 🤖 Agency Agents Platform

> **AI Agent 全生命周期管理平台** — 从需求分析到代码生成、从知识管理到 Vibe Coding，一站式 AI 驱动的软件开发平台。

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)]()
[![React](https://img.shields.io/badge/React-19-61dafb.svg)]()
[![Koa](https://img.shields.io/badge/Koa-3.x-33333d.svg)]()
[![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47a248.svg)]()

---

## 📖 目录

- [项目简介](#-项目简介)
- [核心特性](#-核心特性)
- [技术架构](#-技术架构)
- [项目结构](#-项目结构)
- [快速开始](#-快速开始)
- [环境变量配置](#-环境变量配置)
- [功能模块详解](#-功能模块详解)
- [AI Skill 系统](#-ai-skill-系统)
- [知识库系统](#-知识库系统)
- [版本文档管理](#-版本文档管理)
- [相关文档](#-相关文档)

---

## 🎯 项目简介

Agency Agents Platform 是一个**全栈 AI Agent 管理平台**，内置 **180+ 专业 Agent**、**22 个 AI Skill**、**5 种 LLM Provider** 支持，提供从需求分析、UI 设计、代码生成到质量审查的完整 AI 驱动开发工作流。

### 平台定位

```
┌─────────────────────────────────────────────────────────────┐
│                  Agency Agents Platform                      │
│                                                             │
│  🧠 180+ AI Agents    ⚡ 22 AI Skills    📚 知识库系统      │
│  🎨 Vibe Coding       🔄 Pipeline 编排   🛡️ Quality Gates   │
│  🔌 MCP 协议支持      🤖 5 种 LLM        👥 多租户 RBAC     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## ✨ 核心特性

### 🧠 AI Agent 生态

- **180+ 专业 Agent**：覆盖学术、工程、产品、策略等 15 个分类
- **Agent 市场**：浏览、搜索、收藏、评价 Agent
- **Agent 规划模式**：ReAct 模式，自动拆解复杂任务为多步骤执行
- **多 Agent 协作**：多个 Agent 协同完成复杂任务

### ⚡ AI Skill 编排

- **22 个声明式 Skill**：从 BRD 标准化到技术债务追踪，覆盖软件开发全生命周期
- **Pipeline 编排器**：5 种工作流（Feature / Bug / Refactor / Hotfix / Planning）
- **Quality Gates**：PRD 质量门禁 + Code Review 门禁 + 技术债务门禁
- **断点恢复**：Pipeline 中断后可从上次进度继续

### 🎨 Vibe Coding

- **对话式编程**：自然语言描述需求，AI 实时生成代码
- **实时预览**：内置 React 实时编译预览（基于 esbuild WASM）
- **多文件编辑器**：Monaco Editor 支持多文件同时编辑
- **Pipeline 模式**：4 步 Pipeline（需求分析 → 设计 → 编码 → 质检）和 7 步全栈 Pipeline
- **模板市场**：发布和复用 Vibe 应用模板

### 🔌 多 LLM Provider 支持

| Provider | 特点 |
|----------|------|
| **Ollama** 🦙 | 本地部署，数据不出境，零成本 |
| **OpenAI** 🤖 | GPT 系列，能力强大 |
| **Claude** 🧠 | Anthropic 出品，推理能力优秀 |
| **Gemini** 💎 | Google 出品，多模态能力强 |
| **DeepSeek** 🔍 | 国产大模型，性价比高 |

支持 **手动切换**、**自动路由**、**失败降级** 三种模型路由策略。

### 🔧 MCP 协议支持

- 遵循 Anthropic MCP（Model Context Protocol）标准
- 支持 stdio 和 SSE 两种传输方式
- 即插即用的工具生态扩展

### 📚 知识库 & RAG

- **项目知识库**：自动扫描代码生成架构文档、API 索引、组件清单
- **向量检索**：基于 Embedding 的语义搜索
- **知识图谱**：可视化展示知识关联关系
- **RAG 问答**：基于知识库的智能问答

### 🛡️ 企业级特性

- **JWT + RBAC**：细粒度权限控制
- **多租户**：可选的多租户隔离
- **Token 配额**：全局/用户级 Token 用量管理
- **API 限流**：防止滥用
- **OAuth 集成**：第三方登录支持

---

## 🏗️ 技术架构

### 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        客户端层                                  │
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────┐           │
│  │   @agency/web        │    │   @agency/admin       │           │
│  │   用户前端            │    │   管理后台             │           │
│  │                      │    │                      │           │
│  │   React 19           │    │   React 19           │           │
│  │   Antd 6             │    │   Antd 6             │           │
│  │   TailwindCSS 3      │    │   TailwindCSS 3      │           │
│  │   Zustand 5          │    │   Zustand 5          │           │
│  │   Monaco Editor      │    │   Monaco Editor      │           │
│  │   Vite 6             │    │   Vite 6             │           │
│  └──────────┬───────────┘    └──────────┬───────────┘           │
│             │  REST + SSE               │  REST                 │
└─────────────┼───────────────────────────┼───────────────────────┘
              │                           │
              ▼                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        服务端层                                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    @agency/server                         │   │
│  │                                                          │   │
│  │   Koa 3 + TypeScript + tsx                               │   │
│  │                                                          │   │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │   │
│  │   │  Routes   │→│ Services │→│  Models (Mongoose)    │  │   │
│  │   └──────────┘  └──────────┘  └──────────────────────┘  │   │
│  │                                                          │   │
│  │   ┌──────────────────────────────────────────────────┐   │   │
│  │   │  核心服务                                         │   │   │
│  │   │  • llmService      — 统一 LLM 调用               │   │   │
│  │   │  • providerRegistry — 多 Provider 管理            │   │   │
│  │   │  • skillEngine     — Skill 执行引擎               │   │   │
│  │   │  • skillRouter     — Skill 智能路由               │   │   │
│  │   │  • mcpService      — MCP 协议客户端               │   │   │
│  │   │  • knowledgeService — RAG 知识检索                │   │   │
│  │   │  • embeddingService — 向量嵌入                    │   │   │
│  │   │  • memoryService   — Agent 记忆管理               │   │   │
│  │   │  • compileService  — esbuild 编译服务             │   │   │
│  │   └──────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐ ┌──────────┐ ┌──────────────┐
        │ MongoDB  │ │ LLM APIs │ │ MCP Servers  │
        │ 7.x     │ │ 5 种     │ │ stdio / SSE  │
        └──────────┘ └──────────┘ └──────────────┘
```

### 技术栈一览

| 层级 | 技术 | 版本 |
|------|------|------|
| **后端框架** | Koa | 3.x |
| **ORM** | Mongoose | 8.x |
| **数据库** | MongoDB | 7.x+ |
| **前端框架** | React | 19.x |
| **UI 库** | Ant Design | 6.x |
| **样式** | TailwindCSS | 3.x |
| **状态管理** | Zustand | 5.x |
| **代码编辑器** | Monaco Editor | 4.x |
| **构建工具** | Vite | 6.x |
| **语言** | TypeScript | 5.7 |
| **包管理** | npm workspaces | — |
| **LLM SDK** | openai | 4.x |

---

## 📁 项目结构

```
apps/                                # Monorepo 根目录
│
├── package.json                     # 工作区配置（npm workspaces）
├── .env.example                     # 环境变量模板
├── .gitignore                       # Git 忽略规则
│
├── server/                          # 🖥️ 后端服务 (@agency/server)
│   └── src/
│       ├── index.ts                 # Koa 入口 + 中间件 + 路由挂载
│       ├── config/                  # 配置（环境变量、默认 Prompt、MCP 模板）
│       ├── db/                      # MongoDB 连接
│       ├── middleware/              # 认证、权限、限流中间件
│       ├── models/                  # Mongoose Schema（17 个 Model）
│       │   ├── Agent.ts             #   Agent 定义
│       │   ├── Skill.ts             #   Skill 定义（含版本管理）
│       │   ├── Chat.ts              #   对话会话
│       │   ├── KnowledgeBase.ts     #   知识库
│       │   ├── McpServer.ts         #   MCP 服务配置
│       │   ├── SystemPrompt.ts      #   系统 Prompt 管理
│       │   ├── TokenUsage.ts        #   Token 用量统计
│       │   ├── Role.ts              #   RBAC 角色权限
│       │   └── ...                  #   Favorite, Review, Pipeline 等
│       ├── routes/                  # API 路由（20 个路由文件）
│       │   ├── chat.ts              #   对话（含 Tool Calling 循环）
│       │   ├── vibe.ts              #   Vibe Coding 流式对话
│       │   ├── vibePipeline.ts      #   4 步 Pipeline
│       │   ├── vibeFullStackPipeline.ts  # 7 步全栈 Pipeline
│       │   ├── vibeAppRuntime.ts    #   Vibe 应用运行时
│       │   ├── skill.ts             #   Skill CRUD + 执行
│       │   ├── mcp.ts              #   MCP 服务管理
│       │   ├── knowledge.ts         #   知识库 RAG
│       │   ├── admin.ts             #   管理后台 API
│       │   └── ...                  #   agents, favorite, review 等
│       ├── services/                # 业务逻辑层（15 个 Service）
│       │   ├── llmService.ts        #   统一 LLM 调用（普通/流式/工具）
│       │   ├── providerRegistry.ts  #   多 Provider 注册与路由
│       │   ├── skillEngine.ts       #   Skill 执行引擎
│       │   ├── skillRouter.ts       #   Skill 智能路由（关键词/正则/语义）
│       │   ├── mcpService.ts        #   MCP 协议客户端
│       │   ├── knowledgeService.ts  #   RAG 知识检索
│       │   ├── embeddingService.ts  #   向量嵌入
│       │   ├── memoryService.ts     #   Agent 记忆管理
│       │   └── ...                  #   compile, evaluation, review 等
│       ├── scripts/                 # 脚本（导入 Agent、种子数据、导出）
│       └── __tests__/               # 测试文件
│
├── web/                             # 🌐 用户前端 (@agency/web)
│   └── src/
│       ├── App.tsx                  # 根组件 + 路由定义
│       ├── api/index.ts             # API 请求封装（唯一 axios 实例）
│       ├── store/index.ts           # Zustand 全局状态
│       ├── types/index.ts           # TypeScript 类型定义
│       ├── components/              # 公共组件
│       │   ├── Layout.tsx           #   全局布局
│       │   ├── FavoriteButton.tsx   #   收藏按钮
│       │   ├── ReviewForm.tsx       #   评价表单
│       │   ├── ReviewList.tsx       #   评价列表
│       │   └── ...
│       └── pages/                   # 页面（20+ 页面）
│           ├── HomePage.tsx         #   首页
│           ├── AgentsPage.tsx       #   Agent 列表
│           ├── AgentDetailPage.tsx  #   Agent 详情
│           ├── AgentMarketPage.tsx  #   Agent 市场
│           ├── ChatPage.tsx         #   AI 对话
│           ├── VibeCodingPage.tsx   #   Vibe Coding 主页
│           ├── PipelinesPage.tsx    #   Pipeline 管理
│           ├── SkillOrchestratorPage.tsx  # Skill 编排器
│           ├── KnowledgePage.tsx    #   知识库
│           ├── KnowledgeGraphPage.tsx #  知识图谱
│           ├── ToolsPage.tsx        #   MCP 工具管理
│           └── ...
│
├── admin/                           # 🔧 管理后台 (@agency/admin)
│   └── src/
│       ├── App.tsx                  # 根组件 + 路由
│       ├── api/index.ts             # Admin API 封装
│       └── pages/                   # 管理页面（16 个）
│           ├── DashboardPage.tsx    #   仪表盘
│           ├── AgentsAdminPage.tsx  #   Agent 管理
│           ├── SkillsAdminPage.tsx  #   Skill 管理
│           ├── PromptsAdminPage.tsx #   Prompt 管理
│           ├── McpAdminPage.tsx     #   MCP 服务管理
│           ├── KnowledgeAdminPage.tsx #  知识库管理
│           ├── RbacAdminPage.tsx    #   角色权限管理
│           ├── TokenUsagePage.tsx   #   Token 用量
│           ├── ProviderMonitorPage.tsx # Provider 监控
│           └── ...
│
├── skills/                          # 🎯 AI Skill 定义（22 个）
│   ├── pipeline-orchestrator/       #   Pipeline 编排器
│   ├── brd-normalize/               #   BRD 标准化
│   ├── prd-brd-to-prd/              #   BRD → PRD
│   ├── story-split/                 #   Story 拆分
│   ├── prd-to-ui-spec/              #   UI 设计规范
│   ├── prd-to-backend-design/       #   后端技术设计
│   ├── prd-to-frontend-design/      #   前端技术设计
│   ├── gen-demo-html/               #   HTML Demo 生成
│   ├── db-migration/                #   数据库迁移
│   ├── gen-backend-code/            #   后端代码生成
│   ├── gen-frontend-code/           #   前端代码生成
│   ├── code-review/                 #   代码审查 ⛔
│   ├── gen-test-code/               #   测试用例生成
│   ├── bug-fix/                     #   Bug 修复
│   ├── refactor/                    #   代码重构
│   ├── doc-code-to-kb/              #   知识库更新
│   ├── kb-qa/                       #   知识库问答
│   ├── changelog-gen/               #   变更日志
│   ├── deploy-check/                #   部署检查
│   ├── sprint-report/               #   Sprint 报告
│   ├── api-doc-gen/                 #   API 文档生成
│   └── tech-debt-tracker/           #   技术债务追踪
│
├── kb/                              # 📚 项目知识库
│   ├── 00_project_constitution.md   #   项目宪法（架构决策 + 编码约定）
│   ├── progress.md                  #   KB 覆盖进度
│   ├── frontend/                    #   前端知识文档
│   │   └── @agency/web/             #     页面、组件、API、Store 文档
│   │   └── @agency/admin/           #     管理后台文档
│   └── server/                      #   后端知识文档
│       └── server/                  #     API、Model、Service 文档
│
├── version-doc/                     # 📦 版本文档
│   ├── v1.2.0/                      #   Agent 收藏功能
│   │   ├── brd/                     #     BRD 文档
│   │   ├── prd/                     #     PRD 文档
│   │   ├── stories/                 #     Story 拆分
│   │   ├── design/                  #     设计文档（UI/前端/后端）
│   │   ├── migrations/              #     数据库迁移
│   │   ├── review/                  #     Code Review 报告
│   │   ├── demo/                    #     可交互 Demo
│   │   └── CHANGELOG.md             #     变更日志
│   └── v1.3.0/                      #   Agent 评分评价功能
│       ├── brd/ prd/ stories/       #     需求文档
│       ├── design/                  #     设计文档
│       ├── review/                  #     Review 报告
│       └── CHANGELOG.md             #     变更日志
│
└── 📄 文档
    ├── AI-核心概念与架构解析.md       # 八大核心概念详解
    ├── Skills-架构全景图.md           # 22 个 Skill 架构文档
    └── README.md                    # 本文件
```

---

## 🚀 快速开始

### 前置要求

- **Node.js** >= 18.x
- **MongoDB** >= 7.x（本地或远程）
- **LLM Provider**（至少一个）：
  - [Ollama](https://ollama.ai)（推荐，本地免费）
  - 或 OpenAI / Claude / Gemini / DeepSeek API Key

### 1. 克隆项目

```bash
git clone <repository-url>
cd agency-agents/apps
```

### 2. 安装依赖

```bash
npm install
```

> 使用 npm workspaces，一条命令安装 `server`、`web`、`admin` 三个子项目的所有依赖。

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，至少配置以下内容：

```bash
# MongoDB 连接
MONGODB_URI=mongodb://127.0.0.1:27017/agency_agents

# 选择 LLM Provider
ACTIVE_PROVIDER=ollama

# 如果使用 Ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_TEXT_MODEL=qwen3:8b

# 如果使用 OpenAI
# ACTIVE_PROVIDER=openai
# OPENAI_API_KEY=your-api-key-here
```

### 4. 初始化数据

```bash
# 导入 180+ Agent 数据
npm run import:agents

# （可选）导入种子数据（默认 Prompt、MCP 模板等）
npm --workspace @agency/server run seed
```

### 5. 启动开发服务

```bash
# 一键启动全部服务（server + web + admin）
npm run dev
```

启动后访问：

| 服务 | 地址 | 说明 |
|------|------|------|
| **用户前端** | http://127.0.0.1:5173 | Agent 对话、Vibe Coding、知识库 |
| **管理后台** | http://127.0.0.1:5174 | Agent/Skill/Prompt/MCP 管理 |
| **API 服务** | http://127.0.0.1:4000 | RESTful API + SSE |

### 单独启动

```bash
npm run dev:server    # 仅启动后端
npm run dev:web       # 仅启动用户前端
npm run dev:admin     # 仅启动管理后台
```

### 构建生产版本

```bash
npm run build:web     # 构建用户前端
npm run build:admin   # 构建管理后台
npm run start:server  # 启动生产服务
```

---

## ⚙️ 环境变量配置

完整的环境变量说明请参考 `.env.example`，以下是关键配置分组：

| 分组 | 变量 | 说明 |
|------|------|------|
| **服务端** | `PORT` | API 端口（默认 4000） |
| | `MONGODB_URI` | MongoDB 连接字符串 |
| | `CLIENT_ORIGIN` | 前端地址（CORS） |
| | `ADMIN_ORIGIN` | 管理后台地址（CORS） |
| **认证** | `JWT_SECRET` | JWT 签名密钥 |
| | `JWT_EXPIRES_IN` | Token 过期时间（默认 7d） |
| **LLM** | `ACTIVE_PROVIDER` | 当前 Provider（ollama/openai/claude/gemini/deepseek） |
| | `MODEL_ROUTING_STRATEGY` | 路由策略（manual/auto/fallback） |
| **Ollama** | `OLLAMA_BASE_URL` | Ollama 服务地址 |
| | `OLLAMA_TEXT_MODEL` | 文本模型名 |
| | `OLLAMA_VISION_MODEL` | 视觉模型名 |
| **OpenAI** | `OPENAI_API_KEY` | API 密钥 |
| | `OPENAI_TEXT_MODEL` | 文本模型名 |
| **Pipeline** | `PIPELINE_TEMPERATURE` | 编程任务温度（推荐 0.3） |
| | `PIPELINE_MODEL_TIER` | 模型能力等级（auto/high/medium/low） |
| **RAG** | `EMBEDDING_PROVIDER` | 向量嵌入 Provider |
| | `EMBEDDING_MODEL` | 嵌入模型名 |
| | `EMBEDDING_DIMENSION` | 向量维度 |

---

## 🧩 功能模块详解

### 用户前端（@agency/web）

| 页面 | 功能 |
|------|------|
| **首页** | 平台概览、快速入口 |
| **Agent 列表** | 浏览 180+ Agent，按分类筛选 |
| **Agent 详情** | 查看 Agent 能力、工作流、评价 |
| **Agent 市场** | 发现和收藏 Agent |
| **AI 对话** | 与 Agent 对话，支持 Tool Calling |
| **Vibe Coding** | 对话式编程 + 实时预览 + Pipeline |
| **Pipeline 管理** | 查看 Pipeline 执行历史和状态 |
| **Skill 编排器** | 可视化 Skill 编排和执行 |
| **知识库** | 知识文档浏览和 RAG 问答 |
| **知识图谱** | 可视化知识关联（Sigma.js） |
| **MCP 工具** | 管理 MCP Server 和工具 |
| **Agent 记忆** | 查看 Agent 长期记忆 |
| **多 Agent 协作** | 多 Agent 协同任务 |
| **模板市场** | Vibe 应用模板浏览和使用 |
| **Provider 监控** | LLM Provider 状态监控 |

### 管理后台（@agency/admin）

| 页面 | 功能 |
|------|------|
| **仪表盘** | 系统概览、统计数据 |
| **Agent 管理** | Agent CRUD、批量导入 |
| **Skill 管理** | Skill 编辑、版本管理、执行监控 |
| **Prompt 管理** | System Prompt 在线编辑（无需重启） |
| **MCP 管理** | MCP Server 配置、工具发现 |
| **知识库管理** | 知识文档管理、向量索引 |
| **角色权限** | RBAC 角色和权限配置 |
| **Token 用量** | Token 消耗统计和配额管理 |
| **Provider 监控** | 多 Provider 健康检查和切换 |
| **对话管理** | 对话记录查看和管理 |
| **Pipeline 管理** | Pipeline 执行历史 |
| **Vibe 应用管理** | 用户发布的 Vibe 应用审核 |
| **模板管理** | Vibe 模板审核和管理 |
| **评价管理** | Agent 评价审核 |
| **系统设置** | 全局配置 |

---

## 🎯 AI Skill 系统

### 什么是 Skill？

Skill 是**声明式的 AI 能力单元**，每个 Skill 以 `SKILL.md` 文件定义，包含触发条件、输入输出、执行步骤和质量标准。由 `pipeline-orchestrator` 统一编排调度。

### 22 个 Skill 分层

```
🎯 编排层    pipeline-orchestrator
📋 需求阶段  brd-normalize → prd-brd-to-prd → story-split
🎨 设计阶段  prd-to-ui-spec ∥ prd-to-backend-design ∥ prd-to-frontend-design + gen-demo-html
🔧 编码阶段  db-migration → gen-backend-code ∥ gen-frontend-code
✅ 质量阶段  code-review ⛔ + gen-test-code
🐛 维护阶段  bug-fix + refactor
📚 知识阶段  doc-code-to-kb + kb-qa
📦 发布阶段  changelog-gen + deploy-check + sprint-report + api-doc-gen
🔍 治理层    tech-debt-tracker
```

### 5 种工作流

| 工作流 | 场景 | 步骤数 |
|--------|------|--------|
| 🚀 **Feature** | 新功能开发 | 13+ 步（全量 Pipeline） |
| 🐛 **Bug** | Bug 修复 | 4 步 |
| ♻️ **Refactor** | 代码重构 | 4 步 |
| 🔥 **Hotfix** | 紧急修复 | 3 步（跳过测试） |
| 📋 **Planning** | 仅做规划 | 6 步（不写代码） |

> 详细架构请参阅 [Skills-架构全景图.md](./Skills-架构全景图.md)

---

## 📚 知识库系统

### 知识库结构

```
kb/
├── 00_project_constitution.md    # 项目宪法（架构决策 + 编码约定）
├── progress.md                   # KB 覆盖进度追踪
├── frontend/                     # 前端知识
│   └── @agency/web/
│       ├── 00_project_map.md     # 项目地图
│       ├── 01_index_page.md      # 页面索引
│       ├── 02_index_component.md # 组件索引
│       ├── 03_index_api.md       # API 索引
│       ├── 04_index_store.md     # Store 索引
│       ├── 05_index_types.md     # 类型索引
│       ├── 06_architecture_patterns.md  # 架构模式
│       ├── 07_anti_patterns.md   # 反模式清单
│       └── pages/                # 各页面详细文档
└── server/                       # 后端知识
    └── server/
        ├── 00_project_map.md     # 项目地图
        ├── 01_index_api.md       # API 索引
        ├── 02_index_model.md     # Model 索引
        ├── 03_index_service.md   # Service 索引
        ├── 06_architecture_patterns.md  # 架构模式
        ├── 07_anti_patterns.md   # 反模式清单
        ├── api/                  # 各 API 详细文档
        └── services/             # 各 Service 详细文档
```

### 知识库的作用

1. **AI Skill 执行时参考**：代码生成 Skill 读取 KB 中的架构模式，确保新代码与现有代码风格一致
2. **Code Review 对比基准**：审查时对比 KB 中的规范，检测反模式
3. **RAG 问答**：用户可以基于知识库进行智能问答
4. **自动更新**：`doc-code-to-kb` Skill 在每次 Pipeline 完成后自动更新 KB

---

## 📦 版本文档管理

每个版本的完整开发过程都记录在 `version-doc/` 目录下：

```
version-doc/v1.3.0/
├── brd/brd_normalized.md          # 标准化 BRD
├── prd/prd.md                     # 产品需求文档
├── stories/                       # Story 拆分
│   ├── epic-overview.md
│   ├── story-1.1-*.md
│   └── story-2.1-*.md
├── design/                        # 设计文档
│   ├── ui-spec-*.md               # UI 设计规范
│   ├── be-*.md                    # 后端技术设计
│   └── fe-*.md                    # 前端技术设计
├── migrations/                    # 数据库迁移脚本
├── demo/index.html                # 可交互 Demo
├── review/                        # Code Review 报告
├── pipeline-status.md             # Pipeline 执行状态
└── CHANGELOG.md                   # 版本变更日志
```

---

## 📄 相关文档

| 文档 | 说明 |
|------|------|
| [AI-核心概念与架构解析.md](./AI-核心概念与架构解析.md) | LLM、Token、Context、Prompt、Tool、MCP、Agent、Skill 八大概念详解 |
| [Skills-架构全景图.md](./Skills-架构全景图.md) | 22 个 Skill 的分层架构、工作流、依赖关系、Quality Gates |
| [kb/00_project_constitution.md](./kb/00_project_constitution.md) | 项目宪法 — 架构决策、编码约定、技术栈锁定 |
| [.env.example](./.env.example) | 完整的环境变量配置模板 |

---

## 📜 常用命令

```bash
# 开发
npm run dev                    # 启动全部服务
npm run dev:server             # 仅启动后端
npm run dev:web                # 仅启动用户前端
npm run dev:admin              # 仅启动管理后台

# 构建
npm run build:web              # 构建用户前端
npm run build:admin            # 构建管理后台

# 数据
npm run import:agents          # 导入 Agent 数据
npm --workspace @agency/server run seed     # 导入种子数据
npm --workspace @agency/server run export   # 导出数据

# 检查
npm run type-check             # 全项目类型检查
```

---

## 📊 项目规模

| 指标 | 数量 |
|------|------|
| 子项目 | 3（server / web / admin） |
| 后端 Model | 17 个 |
| 后端 Route | 20 个 |
| 后端 Service | 15 个 |
| 前端页面（web） | 20+ 个 |
| 管理页面（admin） | 16 个 |
| AI Agent | 180+ 个 |
| AI Skill | 22 个 |
| KB 文档 | 50+ 个 |
| LLM Provider | 5 个 |

---

*Agency Agents Platform v2.0 — AI 驱动的全生命周期软件开发平台*
