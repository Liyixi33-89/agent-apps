
# KB + Skills：让 AI 像资深工程师一样理解你的项目

> 一套声明式的 AI 开发工作流体系，用「项目知识库」赋予 AI 项目记忆，用「23 个 Skill」编排从需求到上线的全生命周期，用「Quality Gates」确保每一行代码都经过审查。

---

## 引言：AI 编程的核心矛盾

2025 年，AI 编程助手已经能写出语法正确、逻辑通顺的代码。但一个尴尬的现实是——**AI 不认识你的项目**。

它不知道你的后端用 Koa 而不是 Express，不知道你的 API 响应必须包裹在 `{ success: true, data: ... }` 的信封格式里，不知道你的 Token 存在 `localStorage` 而不是 Zustand Store 中，不知道你的路由文件用 camelCase 而 Model 文件用 PascalCase。

每次开启新对话，AI 都是一张白纸。你不得不反复告诉它："我们用的是 Mongoose 不是 Prisma"、"请用 requireAuth 中间件"、"响应格式要统一"……

**KB + Skills 体系要解决的，就是这个核心矛盾：让 AI 拥有持久的项目认知，像一个在你团队工作了三年的资深工程师一样理解你的项目。**

---

## 第一部分：KB — AI 的项目认知缓存

### 知识库不是文档，而是 AI 的"项目记忆"

传统的项目文档是写给人看的——README、API 文档、架构图。它们的目标是"让人理解项目"。

KB（Knowledge Base）的目标完全不同：**让 AI 在 3 秒内定位到项目中的任何路由、Model、Service、组件、页面，而无需逐文件搜索。**

这个区别决定了 KB 的设计哲学：

> **签名精确 > 覆盖全量 > 逻辑详尽**

AI 不需要散文式的架构描述，它需要的是结构化的索引表、精确的函数签名、明确的调用链。

### 五层索引体系：从宪法到细节

KB 采用五层递进式架构，每一层服务于不同的消费场景：

```
第零层  项目宪法          → "这个项目的规矩是什么？"
第一层  项目地图          → "这个项目有什么模块？我要找的功能在哪？"
第二层  符号索引          → "这个模块有哪些 API / Model / Service？"
第二.五层  架构模式 + 反模式  → "代码应该怎么写？什么写法是被禁止的？"
第三层  全量详情          → "这个 Service 的完整逻辑是什么？入参出参？"
```

#### 第零层：项目宪法 — 所有 AI 行为的基准线

借鉴 BMAD-METHOD 的 `project-context.md` 理念，项目宪法是全局唯一的文件，**所有 Skill 在执行前都必须加载它**。

它不是"有什么"的清单，而是"怎么做"的规范：

- **架构决策记录（ADR）**：为什么选 Koa 而不是 Express？为什么用 Zustand 而不是 Redux？每个决策都有原因和约束。
- **全局编码约定**：文件命名、变量命名、错误处理模式、响应格式——所有 AI 生成的代码都必须遵循。
- **技术栈锁定**：明确列出每个层级的技术选型和**禁止替代**的技术，防止 AI 自作主张引入新依赖。

项目宪法的价值在于：**即使 LLM 的上下文窗口扩展到无限大，架构决策的显式化永远有价值。** 它不是"缓存"，而是"决策"。

#### 第二.五层：架构模式 + 反模式 — ✅ GOOD / ❌ BAD

借鉴 awesome-cursorrules 和 MDC 格式的理念，每个模块都有自己的架构模式文件和反模式文件。

架构模式不是抽象的原则，而是**从实际代码中提取的、带有正反面代码示例的具体规范**：

```typescript
// Pattern-S001: API 响应格式
// ✅ GOOD — 统一的信封格式
ctx.body = { success: true, data: result };

// ❌ BAD — 裸返回，缺少 success 字段
ctx.body = result;
```

反模式则明确告诉 AI "不要这样做"，并提供检测方法：

```
AP-S001: 禁止在 Route 中直接操作 Model
原因：违反分层架构，业务逻辑应在 Service 层
检测：routes/*.ts 中 import 了 models/*
```

**这一层是 Code Review 的基准线**——`code-review` Skill 会逐项检查新代码是否遵循架构模式、是否违反反模式。没有这一层，代码审查就没有标准。

#### 第一层：项目地图 — 模块全景与导航入口

项目地图是每个子项目（server / web / admin）的"目录索引"，回答的是"这个项目有什么模块？我要找的功能在哪？"。

它包含三类关键信息：

- **技术栈概览**：框架版本、核心依赖、构建工具
- **目录结构树**：每个目录的职责说明，让 AI 知道"路由文件在 `routes/`，Model 在 `models/`，Service 在 `services/`"
- **模块关系图**：哪些模块之间有依赖关系，改一个模块可能影响哪些其他模块

```markdown
# 后端项目地图 — server

## 技术栈
| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | Koa | 3.x |
| ORM | Mongoose | 8.x |
| 认证 | JWT | — |

## 目录结构
server/src/
├── routes/       # API 路由层（参数解析 + 响应格式化）
├── services/     # 业务逻辑层（核心业务处理）
├── models/       # 数据模型层（Mongoose Schema）
├── middleware/    # 中间件（认证、错误处理、日志）
├── config/       # 配置文件
└── scripts/      # 工具脚本（迁移、种子数据）
```

项目地图的价值在于：**AI 在接到任务时，第一步就是读项目地图，快速建立"这个项目长什么样"的全局认知**，而不是盲目地逐文件搜索。

#### 第二层：符号索引 — 精确到函数级别的查找表

符号索引是 KB 中最"实用"的一层——它是一张张结构化的表格，列出了每个模块的所有 API 端点、Model 字段、Service 函数、页面组件、Store 状态。

**后端 API 索引示例**：

```markdown
# 后端 API 索引
| # | 方法 | 路径 | 中间件 | 说明 | 详情文件 |
|---|------|------|--------|------|----------|
| 1 | GET | /api/agents | requireAuth | 获取 Agent 列表 | api/agents.md |
| 2 | POST | /api/agents | requireAdmin | 创建 Agent | api/agents.md |
| 3 | GET | /api/agents/:slug | requireAuth | 获取 Agent 详情 | api/agents.md |
| 4 | POST | /api/favorites/toggle | requireAuth | 切换收藏状态 | api/favorites.md |
| 5 | GET | /api/reviews/:slug | — | 获取评价列表 | api/reviews.md |
```

**前端页面索引示例**：

```markdown
# 前端页面索引
| # | 页面 | 路由 | 核心组件 | 说明 |
|---|------|------|---------|------|
| 1 | ChatPage | /chat/:slug | MessageList, InputArea | AI 对话页 |
| 2 | AgentsPage | /agents | AgentCard, TagSelector | Agent 列表页 |
| 3 | AgentDetailPage | /agent/:slug | FavoriteButton, ReviewForm | Agent 详情页 |
```

**Model 索引示例**：

```markdown
# Model 索引
| # | Model | 集合名 | 核心字段 | 索引 |
|---|-------|--------|---------|------|
| 1 | Agent | agents | name, slug, description, ratingStats | slug(unique) |
| 2 | Favorite | favorites | userId, agentId | userId+agentId(unique) |
| 3 | Review | reviews | userId, agentSlug, rating, content | agentSlug+createdAt |
```

符号索引的设计原则是：**一行一个符号，每个符号都有精确的签名和定位信息**。AI 通过索引表可以在 O(1) 时间内找到任何 API、Model 或组件，而不需要遍历源码文件。

#### 第三层：全量详情 — 每个文件的完整画像

第三层是 KB 中最"重"的一层——每个路由文件、Service 文件、页面组件都有一个独立的详情文件，记录了完整的函数签名、参数类型、返回值、调用链和业务逻辑。

**API 详情文件示例**：

```markdown
# agents 路由详情
**文件**: server/src/routes/agents.ts
**注册路径**: /api/agents

## 端点列表

### GET /api/agents
- **中间件**: requireAuth
- **查询参数**: { page, limit, search, tags, sort }
- **响应**: { success: true, data: { agents: IAgent[], total: number } }
- **调用链**: route → agentService.getAgents() → Agent.find()

### POST /api/agents
- **中间件**: requireAdmin
- **请求体**: Partial<IAgent>
- **响应**: { success: true, data: IAgent }
- **调用链**: route → agentService.createAgent() → Agent.create()
```

**Service 详情文件示例**：

```markdown
# reviewService 详情
**文件**: server/src/services/reviewService.ts

## 导出函数

### createReview(userId, agentSlug, data)
- **参数**: userId: string, agentSlug: string, data: { rating: 1-5, content: string }
- **返回**: IReview
- **逻辑**: 创建评价 → 调用 recalculateRatingStats 更新统计
- **副作用**: 更新 Agent.ratingStats 冗余字段

### recalculateRatingStats(agentSlug)
- **参数**: agentSlug: string
- **返回**: void
- **逻辑**: MongoDB 聚合管道 → 计算平均分和各星级分布 → 更新 Agent 文档
```

第三层的维护策略是**按需生成**：初始构建时全量生成，后续只在 `doc-code-to-kb` 检测到文件变更时增量更新对应的详情文件。对于未变更的文件，详情文件保持不变。

### KB 的目录结构：从抽象到具体

五层索引体系在文件系统中的实际组织方式：

```
kb/
├── 00_project_constitution.md          ← 第零层：项目宪法（全局唯一）
├── progress.md                         ← KB 构建进度追踪
│
├── server/server/                      ← 后端知识库
│   ├── 00_project_map.md               ← 第一层：项目地图
│   ├── 01_index_api.md                 ← 第二层：API 索引
│   ├── 02_index_model.md               ← 第二层：Model 索引
│   ├── 03_index_service.md             ← 第二层：Service 索引
│   ├── 04_index_middleware.md           ← 第二层：中间件索引
│   ├── 06_architecture_patterns.md     ← 第二.五层：架构模式
│   ├── 07_anti_patterns.md             ← 第二.五层：反模式
│   ├── api/                            ← 第三层：API 详情
│   │   ├── agents.md
│   │   ├── favorites.md
│   │   └── reviews.md
│   └── services/                       ← 第三层：Service 详情
│       ├── agentService.md
│       ├── reviewService.md
│       └── llmService.md
│
└── frontend/@agency/                   ← 前端知识库
    ├── web/                            ← Web 端
    │   ├── 00_project_map.md
    │   ├── 01_index_page.md
    │   ├── 02_index_component.md
    │   ├── 03_index_api.md
    │   ├── 04_index_store.md
    │   ├── 06_architecture_patterns.md
    │   ├── 07_anti_patterns.md
    │   └── pages/                      ← 第三层：页面详情
    │       ├── chat-page.md
    │       └── agents-page.md
    └── admin/                          ← Admin 端（结构同 web）
```

### 三个消费场景的依赖层级

KB 的五层不是平等的，不同场景对不同层的依赖程度不同：

| 场景 | 最依赖 | 次依赖 | 关注点 |
|------|--------|--------|--------|
| 解答用户提问 | 第一层 + 第二层 | 第三层 | 索引表的搜索友好性 |
| AI 编码参考 | 第零层 + 第二.五层 + 第三层 | 第二层 | 架构模式遵循、函数签名精确 |
| 方案设计参考 | 第零层 + 第一层 + 第二层 | 第三层 | 架构决策、模块关系 |
| Code Review | 第零层 + 第二.五层 | 第三层 | 架构模式合规、反模式检测 |

这意味着：**项目宪法和架构模式是 KB 中 ROI 最高的部分**，它们服务于最多的消费场景，且维护成本最低（一次生成，长期受益）。

### Token 经济学：为什么 KB 比直接读源码更高效

没有 KB 时，AI 每次 Code Review 需要读 5-10 个源码文件（约 5000 行）来理解项目模式。有了 KB，只需读项目宪法 + 架构模式（约 500 行），**节省 90% 的上下文 Token**。

在 LLM 按 Token 计费的时代，这是实打实的成本节省。更重要的是，KB 确保了**跨会话的一致性**——每次对话加载同一份项目宪法，AI 的行为就是一致的。

---

## 第二部分：Skills — 23 个声明式的 AI 工作角色

### Skill 不是代码，而是"角色剧本"

每个 Skill 以 `SKILL.md` 声明式定义——它不包含任何命令式代码，而是用自然语言描述：

- **你是谁**（核心隐喻）
- **你要做什么**（编排流程）
- **你的标准是什么**（自检清单）
- **你不能做什么**（约束条件）
- **遇到意外怎么办**（边界条件处理）

AI Agent 在运行时根据 SKILL.md 的指令动态执行。这使得 Skill 易于阅读、修改和版本管理——**任何人都可以通过编辑 Markdown 文件来调整 AI 的行为**。

### 七层洋葱模型：从编排到治理

23 个 Skill 按生命周期阶段分为七层，采用"洋葱模型"——编排层在最外层统一调度，业务 Skill 按生命周期排列在中间，治理层在最底层兜底：

```
🎯 编排层    pipeline-orchestrator（总指挥）
📋 需求阶段  brd-normalize → prd-brd-to-prd → story-split
🎨 设计阶段  prd-to-ui-spec / prd-to-backend-design / prd-to-frontend-design / gen-demo-html
⛔ 门禁层    design-review（Gate 1）
🔧 编码阶段  db-migration / gen-backend-code / gen-frontend-code
✅ 质量阶段  code-review（Gate 2）/ gen-test-code
📚 知识阶段  doc-code-to-kb / kb-qa
📦 发布阶段  changelog-gen / deploy-check / sprint-report / api-doc-gen
🐛 维护阶段  bug-fix / refactor
🔍 治理层    tech-debt-tracker
```

**每一层只依赖下一层的输出，不跨层调用。** 这确保了 Skill 之间的依赖关系清晰、可预测。

### 核心隐喻：每个 Skill 都有自己的"人格"

每个 Skill 都有一个核心隐喻，定义了它的行为风格：

| Skill | 核心隐喻 | 行为风格 |
|-------|---------|---------|
| `pipeline-orchestrator` | CI/CD Pipeline | 有状态、有门禁、可恢复的工作流引擎 |
| `prd-brd-to-prd` | 产品经理 | 把"要什么"翻译成"做什么" |
| `code-review` | 资深 Tech Lead | 既严格又务实，不吹毛求疵 |
| `design-review` | 架构评审委员会秘书 | 不做决策，但把信息整理得清清楚楚 |
| `doc-code-to-kb` | 知识工程师 | 3 秒定位任何符号 |
| `kb-qa` | 项目百科全书 | 先查索引，再查详情，最后查源码 |
| `tech-debt-tracker` | 技术债务审计员 | 定期盘点，确保没有问题被遗忘 |
| `deploy-check` | 飞行前检查员 | 宁可延迟发布，也不能带着问题上线 |

这些隐喻不是装饰，而是**行为约束**。当 `code-review` 被定义为"资深 Tech Lead"时，它就不会纠结缩进风格（那是 ESLint 的事），而是关注安全性、架构合规和逻辑正确性。

### 23 个 Skill 完整清单

| # | Skill | 核心隐喻 | 阶段 | 输入 | 输出 |
|---|-------|---------|------|------|------|
| 1 | `pipeline-orchestrator` | CI/CD Pipeline | 🎯 编排 | 任务类型 + 描述 | pipeline-status.md |
| 2 | `brd-normalize` | 业务分析师 | 📋 需求 | 原始需求 | 标准化 BRD |
| 3 | `prd-brd-to-prd` | 产品经理 | 📋 需求 | BRD | PRD（含验收标准） |
| 4 | `story-split` | Scrum Master | 📋 需求 | PRD | Story 文件（含工时估算） |
| 5 | `prd-to-ui-spec` | UX 设计师 | 🎨 设计 | PRD | UI 设计规范 |
| 6 | `gen-demo-html` | 原型设计师 | 🎨 设计 | UI Spec | 可交互 HTML 原型 |
| 7 | `prd-to-backend-design` | 后端架构师 | 🎨 设计 | PRD + KB | 后端技术设计文档 |
| 8 | `prd-to-frontend-design` | 前端架构师 | 🎨 设计 | PRD + KB | 前端技术设计文档 |
| 9 | `design-review` | 评审委员会秘书 | ⛔ 门禁 | 设计文档 | 变更清单摘要 |
| 10 | `db-migration` | DBA | 🔧 编码 | 后端设计 | 迁移脚本 |
| 11 | `gen-backend-code` | 后端工程师 | 🔧 编码 | 后端设计 + KB | 后端源码 |
| 12 | `gen-frontend-code` | 前端工程师 | 🔧 编码 | 前端设计 + KB | 前端源码 |
| 13 | `code-review` | 资深 Tech Lead | ✅ 质量 | 源码 + KB | Review 报告 |
| 14 | `gen-test-code` | QA 架构师 | ✅ 质量 | 源码 + PRD | 测试用例 |
| 15 | `doc-code-to-kb` | 知识工程师 | 📚 知识 | 源码 + 设计文档 | KB 增量更新 |
| 16 | `kb-qa` | 项目百科全书 | 📚 知识 | 用户问题 + KB | 结构化回答 |
| 17 | `changelog-gen` | 技术写作者 | 📦 发布 | Story + Review | CHANGELOG.md |
| 18 | `api-doc-gen` | 文档工程师 | 📦 发布 | 路由文件 + KB | API 文档 |
| 19 | `deploy-check` | 飞行前检查员 | 📦 发布 | 项目文件 | 部署就绪报告 |
| 20 | `sprint-report` | 数据分析师 | 📦 发布 | Pipeline 记录 | Sprint 回顾报告 |
| 21 | `bug-fix` | 排障工程师 | 🐛 维护 | Bug 报告 + KB | 修复代码 |
| 22 | `refactor` | 代码整形师 | 🐛 维护 | 目标模块 + KB | 重构代码 |
| 23 | `tech-debt-tracker` | 技术债务审计员 | 🔍 治理 | Review 报告 | 债务看板 |

### Skill 之间的数据流转

每个 Skill 的输出是下一个 Skill 的输入，形成一条完整的数据流水线：

```
原始需求 ──→ BRD ──→ PRD ──→ Stories ──→ 设计文档 ──→ 变更清单
                                                        ↓
                                              ⛔ 人工审批
                                                        ↓
                                              迁移脚本 + 源码
                                                        ↓
                                              ⛔ Code Review
                                                        ↓
                                              测试用例 + KB 更新 + CHANGELOG
```

**关键设计**：每个 Skill 只关心自己的输入和输出，不关心上下游的实现细节。这使得 Skill 可以独立替换、独立测试、独立演进。

---

## 第三部分：Review-First — 先审后写的核心理念

### 从"AI 直接写代码"到"AI 先出方案，人审批后再写"

这是整个体系最重要的设计决策，也是经历了实际项目验证后的核心教训。

早期版本的 Pipeline 是这样的：

```
BRD → PRD → Design → Code → Review → Test → KB
                      ↑ 没有门禁，AI 一口气写完
```

问题很快暴露：设计文档中的 API 路径写错了，AI 忠实地把错误实现成了代码；数据库 Schema 设计不合理，等到 Code Review 发现时修改成本已经很高。

**Code Review 变成了"事后诸葛亮"——代码已经写完了，发现架构问题时为时已晚。**

借鉴 AWS Kiro 的 Spec-Driven Development 和 BMAD-METHOD 的 Planning/Development 分离理念，我们引入了 **Review-First 模式**：

```
┌─ Phase 1: 规划阶段 ──────────────────────────────────────┐
│ BRD → PRD → Story Split → UI Spec → [BE Design ∥ FE Design] │
└──────────────────────────────────────────────────────────────┘
                              ↓
                 ⛔ Gate 1: 设计评审（design-review）
                 人工审批：✅ 确认 / ✏️ 修改 / ❌ 打回
                              ↓
┌─ Phase 2: 编码阶段 ──────────────────────────────────────┐
│ DB Migration → [BE Code ∥ FE Code]                         │
└──────────────────────────────────────────────────────────────┘
                              ↓
                 ⛔ Gate 2: 代码审查（code-review）
                              ↓
┌─ Phase 3: 交付阶段 ──────────────────────────────────────┐
│ Test Gen → KB Update → Changelog                           │
└──────────────────────────────────────────────────────────────┘
```

**核心理念：AI 不是起点，而是终点；设计评审才是编码的起点。**

### 设计评审：让人工审批有据可依

`design-review` Skill 不做设计决策，它做的是**信息整理**——把所有设计文档中的变更汇总为一份结构化的"变更清单摘要"：

- **后端变更清单**：新增/修改了哪些 Model、API、Service，每个文件改了什么
- **前端变更清单**：新增/修改了哪些页面、组件、API 函数、类型定义
- **影响范围分析**：改这个文件会影响哪些其他文件（基于 KB 中的引用关系）
- **关键设计决策点**：标注所有需要人工判断的设计决策（如"Tag 是用户级还是全局级？"）

人工审批者不需要通读整个设计文档，只需看这份摘要就能做出决策。

### `--auto` 模式：保留快速通道

Review-First 是默认模式，但保留了 `--auto` 参数允许跳过 Gate 1（设计评审）。适用于：

- 单人快速迭代
- 紧急修复（Hotfix 工作流自动启用 `--auto`）
- 对设计方案已有充分信心的场景

**Gate 2（代码审查）不可跳过**——这是最后的质量防线。

---

## 第四部分：Quality Gates — 不可跳过的质量门禁

### 三道门禁，层层把关

整个 Pipeline 中有三道 Quality Gate，每一道都有明确的通过标准和失败处理：

#### Gate 1：PRD 质量门禁（内置于 prd-brd-to-prd）

PRD 生成后自动执行 10 项检查，确保 PRD 包含：交互流程、异常场景、验收标准、接口约定、数据模型约定、非功能需求等。

**教训来源**：v1.2.0 的 PRD 只有 54 行，缺少关键章节，导致后续设计和编码都缺乏依据。v1.3.0 的 PRD 有 346 行，质量显著提升。这个门禁就是为了防止 PRD 质量回退。

#### Gate 2：设计评审门禁（design-review）

规划阶段完成后，人工审批设计方案。修改后确认的闭环最多 3 轮。

#### Gate 3：代码审查门禁（code-review）

代码生成后，AI 自动审查 + 反馈闭环。审查覆盖 12 个维度：类型安全、错误处理、安全性、逻辑正确性、性能、命名规范、代码重复、KB 一致性、PRD 非功能需求覆盖、架构模式合规、反模式检测、可读性。

**反馈闭环**借鉴 ChatDev 的对话质证机制：

```
Review → 发现 🔴 问题 → 自动修复 → Re-review → 通过？
                                                ├── 是 → 继续
                                                └── 否 → 再修复 → 第 3 轮 Re-review
                                                          └── 仍未通过 → 暂停，人工介入
```

最多 3 轮，超过 3 轮暂停等待人工介入。**这不是"可以做 Code Review"，而是"每次变更必须通过 Code Review"。**

---

## 第五部分：知识闭环 — 代码反哺知识库

### doc-code-to-kb：从代码中提取知识

每次 Pipeline 完成后，`doc-code-to-kb` Skill 会将新增/修改的代码反哺到知识库：

- 新增的 Model → 更新 `02_index_model.md`
- 新增的 API 端点 → 更新 `01_index_api.md` + 新建详情文件
- 新增的前端组件 → 更新 `02_index_component.md`
- 修改的架构模式 → 更新 `06_architecture_patterns.md`

**这一步不可跳过**——在 `pipeline-orchestrator` 中被标记为强制步骤。因为 KB 不更新 = KB 过期 = KB 误导 AI = 生成错误代码。**过期的 KB 比没有 KB 更危险。**

### doc-code-to-kb 的具体工作流程

`doc-code-to-kb` 不是简单地"把代码复制到 KB"，而是一个三步提取流程：

```
第 1 步：变更检测
  读取本次 Pipeline 的设计文档和生成的代码文件
  对比 KB 中的现有索引，找出新增/修改/删除的符号

第 2 步：符号提取
  对每个变更的文件，提取：
  - 后端：路由端点签名、Model Schema 字段、Service 函数签名
  - 前端：页面组件 Props、API 封装函数、Store 状态定义
  - 通用：导入依赖关系、导出符号列表

第 3 步：模式提取（第二.五层更新）
  分析新代码是否引入了新的架构模式
  检查是否有违反现有反模式的代码（如果有，标注 ⚠️）
  更新架构模式文件中的代码示例
```

**增量更新 vs 全量重建**：初始构建时执行全量扫描（遍历所有源码文件），后续版本只做增量更新（只处理本次 Pipeline 涉及的文件）。增量更新的时间从全量的 2-3 小时缩短到 2-5 分钟。

### tech-debt-tracker：防止债务累积

Code Review 中的 🟡 建议修复项不会被遗忘。`tech-debt-tracker` Skill 会：

1. 扫描所有版本的 Review 报告，提取未修复的 🟡 问题
2. 生成技术债务看板，按优先级排序
3. 在新版本 Pipeline 启动前自动检查遗留债务
4. 债务存在超过 2 个版本自动升级优先级

**教训来源**：v1.2.0 产生了 4 个 🟡 问题，全部标记"下个 Sprint 修复"，但 v1.3.0 并没有修复它们。这个 Skill 就是为了防止债务无限累积。

---

## 第六部分：设计哲学总结

### 六个核心原则

1. **声明式优于命令式**
   Skill 用 Markdown 定义，不用代码。任何人都可以通过编辑文本来调整 AI 的行为。

2. **先审后写（Review-First）**
   设计文档是编码的"合同"，人工审批后才能进入编码阶段。AI 不是起点，而是终点。

3. **Quality Gates 不可跳过**
   代码审查是最后的质量防线，即使 `--auto` 模式也不能跳过 Gate 2。

4. **知识库是 AI 的项目记忆**
   KB 不是文档，而是 AI 的认知缓存。它的核心价值不在于"索引"（这会被 LLM 进化淘汰），而在于"架构决策的显式化"（这永远有价值）。

5. **反馈闭环而非单向流转**
   Review 发现问题 → 自动修复 → Re-review，最多 3 轮。借鉴 ChatDev 的对话质证，不是单向输出报告。

6. **断点恢复而非从头开始**
   Pipeline 中断后可从上次完成的步骤继续。每个步骤完成后立即持久化状态。

### 断点恢复机制：永不丢失进度

断点恢复是 `pipeline-orchestrator` 的核心能力之一。在 AI 编程场景中，一个 Feature Pipeline 可能需要 2-3 小时，中途可能因为会话超时、网络中断或用户主动暂停而中断。

**恢复机制的工作原理**：

1. **状态持久化**：每个步骤完成后，立即将状态写入 `pipeline-status.md` 文件
2. **恢复检测**：Pipeline 启动时，先检查是否存在状态文件
3. **智能跳过**：已完成的步骤标记为 `✅ 完成`，直接跳过；从最后一个 `⏳ 待执行` 或 `❌ 失败` 的步骤继续
4. **产出物检测**：即使状态文件丢失，也会检查各 Skill 的输出文件是否已存在，避免重复生成

```markdown
## Pipeline 状态文件示例

| # | 阶段 | Skill | 状态 | 完成时间 |
|---|------|-------|------|----------|
| 1 | 需求分析 | brd-normalize | ✅ 完成 | 10:05 |
| 2 | PRD 生成 | prd-brd-to-prd | ✅ 完成 | 10:15 |
| 3 | 故事拆分 | story-split | ✅ 完成 | 10:25 |
| 4 | 后端设计 | prd-to-backend-design | ✅ 完成 | 10:40 |
| 5 | 前端设计 | prd-to-frontend-design | ✅ 完成 | 10:40 |
| 6 | ⛔ 设计评审 | design-review | ✅ 通过 | 11:00 |
| 7 | 后端编码 | gen-backend-code | ❌ 失败 | 11:20 |
| 8 | 前端编码 | gen-frontend-code | ⏳ 待执行 | — |
```

当用户说"继续开发"时，Pipeline 读取状态文件，从第 7 步（后端编码，失败）重新开始，跳过前 6 个已完成的步骤。

### 团队协作模式：从单人到多人

KB + Skills 体系天然支持团队协作，因为**所有中间产出物都是 Markdown 文件**，可以通过 Git 进行版本管理和协作：

| 协作场景 | 实现方式 |
|---------|----------|
| **设计评审** | Gate 1 生成的变更清单摘要可以作为 PR 的 Description，团队成员在 PR 中评审 |
| **并行开发** | 后端设计和前端设计可以由不同的人（或不同的 AI 会话）并行执行 |
| **知识共享** | KB 是团队共享的知识库，新成员读 KB 比读源码快 10 倍 |
| **Skill 定制** | 不同团队可以 fork Skill 并定制自己的编码规范和审查标准 |
| **异步执行** | Pipeline 支持 `-y` 模式后台运行，遇到不确定的决策自行决策并记录理由 |

**关键设计**：Pipeline 的每个阶段都有明确的输入和输出文件，这意味着不同的人可以负责不同的阶段——产品经理审批 PRD，架构师审批设计文档，开发者审批代码。

### 借鉴的外部框架

| 框架 | 借鉴了什么 |
|------|-----------|
| **BMAD-METHOD** | 21 个 Agent 角色定义 → 23 个 Skill 角色分工；`project-context.md` → 项目宪法；Planning/Development 分离 → Review-First 模式 |
| **awesome-cursorrules / MDC** | 30+ 技术栈规则模板 → 架构模式 + 反模式；Auto Attached 触发 → Pipeline 的上下文感知规则 |
| **ChatDev** | 多 Agent 对话质证 → Code Review 的反馈闭环（Review → Fix → Re-review） |
| **Zencoder** | Quality Gates 理念 → 三道不可跳过的质量门禁 |
| **Kiro (AWS)** | Spec-Driven Development → Review-First 三阶段模型（Requirement → Design → Task） |

---

## 结语：让 AI 成为团队的一员，而不是一个工具

KB + Skills 体系的终极目标不是"让 AI 写更多代码"，而是**让 AI 像一个理解项目上下文、遵守团队规范、接受代码审查的工程师一样工作**。

它不会绕过 API 封装直接用 `fetch`（因为反模式清单禁止了这样做），不会忘记给 API 加认证中间件（因为 Code Review 会检查），不会生成与现有代码风格不一致的代码（因为项目宪法定义了命名约定），不会在设计有问题时直接写代码（因为 Gate 1 要求人工审批）。

**它不是一个无状态的代码生成器，而是一个有记忆、有规范、有审查的团队成员。**

---

*本文基于 Agency Agents Platform 项目的 `kb/` 和 `skills/` 目录编写。*
*KB：五层索引体系，100+ 知识文件，覆盖 3 个模块（server / web / admin）。*
*Skills：23 个声明式 Skill，覆盖从需求到上线的全生命周期。*
*最后更新：2026-04-15*
