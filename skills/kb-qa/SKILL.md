---
name: kb-qa
description: "读取项目知识库（kb/），快速解答用户关于项目的技术提问，或在产品/业务方进行方案设计时提供走查意见。优先从 KB 索引查找答案，不足时深入代码验证。"
triggers:
  - 知识库问答
  - 项目问题
  - 方案走查
  - 设计评审
  - 走查意见
  - review
---

# KB-QA — 项目知识库问答与方案走查

## 目标

基于项目知识库（`kb/` 目录），在 **10 秒内** 回答用户关于项目架构、API、数据模型、页面组件等技术问题，或对产品/业务方案提供走查意见。

**核心隐喻**：你是一个"项目百科全书 + 技术评审员"——先查索引，再查详情，最后查源码。三跳定位，精准回答。

---

## 设计原则

1. **KB 优先**：先从知识库索引中查找，找到即回答，不必每次都读源码
2. **逐层深入**：第一层（project_map）→ 第二层（index）→ 第三层（detail）→ 源码，按需逐层深入
3. **有据可查**：每个回答都标注信息来源（KB 文件路径或源码路径）
4. **坦诚不确定**：KB 中未覆盖的内容明确标注"⚠️ KB 未覆盖，以下基于源码分析"
5. **走查有结论**：方案走查必须给出明确的"通过/有风险/建议修改"结论】、po

---

## 两种运行模式

### 模式 A：技术问答（Q&A）

**触发条件**：用户提出关于项目的技术问题（如"某个 API 的参数是什么""某个 Service 的逻辑""某个页面调用了哪些接口"）

**输出**：结构化的技术回答 + 信息来源标注

### 模式 B：方案走查（Review）

**触发条件**：用户提供了一个方案/设计文档，要求走查/评审/review

**输出**：走查报告（兼容性分析 + 影响范围 + 风险点 + 结论）

---

## 知识库结构认知

执行前必须理解 KB 的三层索引体系：

```
kb/
├── server/server/                    # 后端知识库
│   ├── 00_project_map.md            # 第一层：项目全景（技术栈、目录结构、模块关系）
│   ├── 01_index_api.md              # 第二层：全量 API 路由索引（155+ 端点）
│   ├── 02_index_model.md            # 第二层：Mongoose Model 索引（16 个 Model）
│   ├── 03_index_service.md          # 第二层：Service 索引（14 个 Service）
│   ├── 04_index_config.md           # 第二层：中间件 + 配置索引
│   ├── api/{routeName}.md           # 第三层：每个路由文件的详情
│   └── services/{serviceName}.md    # 第三层：每个 Service 的详情
├── frontend/@agency/web/            # 用户前端知识库
│   ├── 00_project_map.md            # 第一层：前端项目全景
│   ├── 01_index_page.md             # 第二层：页面索引（路由表 + 功能摘要）
│   ├── 02_index_component.md        # 第二层：公共组件索引
│   ├── 03_index_api.md              # 第二层：前端 API 封装索引
│   ├── 04_index_store.md            # 第二层：Zustand Store 索引
│   ├── 05_index_types.md            # 第二层：TypeScript 类型定义索引
│   └── pages/{pageName}.md          # 第三层：每个页面的详情
└── frontend/@agency/admin/          # 管理后台知识库（结构同 web）
```

### 索引查找速查表

| 想找什么 | 先查哪个索引 | 再查哪个详情 |
|---------|------------|------------|
| 某个 API 的路径/参数 | `server/server/01_index_api.md` | `server/server/api/{route}.md` |
| 某个数据表/Model 的字段 | `server/server/02_index_model.md` | — |
| 某个 Service 的逻辑 | `server/server/03_index_service.md` | `server/server/services/{service}.md` |
| 中间件/配置/环境变量 | `server/server/04_index_config.md` | — |
| 某个前端页面的功能 | `frontend/.../01_index_page.md` | `frontend/.../pages/{page}.md` |
| 某个公共组件的 Props | `frontend/.../02_index_component.md` | — |
| 前端 API 函数列表 | `frontend/.../03_index_api.md` | — |
| 状态管理 Store | `frontend/.../04_index_store.md` | — |
| TypeScript 类型定义 | `frontend/.../05_index_types.md` | — |
| 项目整体架构/技术栈 | `server/server/00_project_map.md` | — |

---

## 编排流程（模式 A：技术问答）

### 第 1 步：理解问题，确定查找范围

分析用户问题，判断需要查找的知识域：

| 问题类型 | 知识域 | 首选索引 |
|---------|--------|---------|
| API/接口相关 | 后端路由 | `01_index_api.md` |
| 数据模型/字段 | 后端 Model | `02_index_model.md` |
| 业务逻辑/Service | 后端 Service | `03_index_service.md` |
| 认证/权限/配置 | 后端配置 | `04_index_config.md` |
| 页面功能/交互 | 前端页面 | `01_index_page.md` |
| 组件/Props | 前端组件 | `02_index_component.md` |
| 前后端联调 | 前端 API + 后端路由 | 前端 `03_index_api.md` + 后端 `01_index_api.md` |
| 架构/技术栈 | 项目全景 | `00_project_map.md` |
| 跨模块/全局 | 多个索引 | 从 `00_project_map.md` 开始 |

### 第 2 步：查找第一层（项目全景）

如果问题涉及项目整体架构、技术栈选型、模块关系，或者不确定该查哪个索引：

```
read_file: kb/server/server/00_project_map.md
```

从项目全景中定位到具体模块，再进入第 3 步。

**如果问题已经明确指向某个具体模块**（如"Agent Model 有哪些字段"），可以跳过此步直接进入第 3 步。

### 第 3 步：查找第二层（索引表）

根据第 1 步确定的知识域，读取对应的索引文件：

```
read_file: kb/server/server/{对应索引文件}
```

在索引表中搜索与问题相关的条目。

**判断是否需要深入第三层**：
- 索引表中的信息已足够回答 → 直接进入第 5 步输出答案
- 需要更详细的逻辑/参数/字段 → 进入第 4 步

### 第 4 步：查找第三层（详情文件）

读取对应的详情文件：

```
read_file: kb/server/server/api/{routeName}.md
read_file: kb/server/server/services/{serviceName}.md
read_file: kb/frontend/@agency/web/pages/{pageName}.md
```

**判断是否需要查看源码**：
- 详情文件中的信息已足够回答 → 进入第 5 步
- 详情文件标注了"⚠️ 待补充"或信息不完整 → 进入第 4.5 步

### 第 4.5 步：深入源码验证（仅在 KB 不足时）

当 KB 中的信息不足以回答问题时，直接读取源码：

```
read_file: server/src/routes/{file}.ts
read_file: server/src/services/{file}.ts
read_file: server/src/models/{file}.ts
read_file: web/src/pages/{file}.tsx
```

**⚠️ 此步骤的输出必须标注**：`> ⚠️ 以下信息来自源码分析，KB 中未完整覆盖`

### 第 5 步：组织答案

按以下格式输出：

```markdown
## 回答

{结构化的回答内容}

### 信息来源

| 来源 | 文件 | 说明 |
|------|------|------|
| KB 索引 | kb/server/server/01_index_api.md | API 路由列表 |
| KB 详情 | kb/server/server/api/agents.md | Agent 路由详情 |
| 源码 | server/src/routes/agents.ts | （仅在 KB 不足时标注） |
```

### 回答格式规范

**API 相关问题**：必须包含 HTTP 方法、路径、中间件、请求参数、响应结构

**Model 相关问题**：必须包含字段名、类型、约束（required/unique/ref）、关联关系

**Service 相关问题**：必须包含函数签名、依赖、核心逻辑步骤

**页面相关问题**：必须包含路由路径、状态管理、API 调用、核心交互流程

**跨模块问题**：必须画出调用链路（如 `Page → API → Route → Service → Model → MongoDB`）

---

## 编排流程（模式 B：方案走查）

### B-1 步：理解方案

读取用户提供的方案/设计文档，提取：
- **涉及的功能模块**（哪些 Route/Service/Model/Page 会被影响）
- **新增/修改的内容**（新 API、新字段、新页面、逻辑变更）
- **技术选型**（如果方案中有技术决策）

### B-2 步：KB 影响范围分析

根据方案涉及的模块，从 KB 中查找现有实现：

1. 读取相关的索引文件，确认现有的 API/Model/Service/Page
2. 读取相关的详情文件，了解现有逻辑
3. 分析方案与现有实现的**兼容性**

### B-3 步：逐项走查

对方案中的每个变更点，逐一检查：

| 检查维度 | 检查内容 |
|---------|---------|
| **API 兼容性** | 新 API 是否与现有路由冲突？参数命名是否一致？ |
| **Model 兼容性** | 新字段是否与现有 Schema 冲突？是否需要数据迁移？ |
| **Service 依赖** | 新逻辑是否影响现有 Service 的调用链？ |
| **前端影响** | 哪些页面需要适配？Store 是否需要更新？Types 是否需要扩展？ |
| **权限影响** | 新 API 是否需要认证/权限控制？ |
| **性能风险** | 是否引入 N+1 查询、大数据量遍历等性能问题？ |
| **安全风险** | 是否有未校验的用户输入、权限绕过风险？ |

### B-4 步：生成走查报告

```markdown
## 方案走查报告

### 总体结论

{✅ 通过 / ⚠️ 有风险，建议修改 / ❌ 存在严重问题，需重新设计}

### 影响范围

| 模块 | 影响类型 | 影响文件 | 说明 |
|------|---------|---------|------|
| 后端路由 | 新增 | routes/xxx.ts | 新增 3 个 API |
| 后端 Model | 修改 | models/Xxx.ts | 新增 2 个字段 |
| 前端页面 | 修改 | pages/XxxPage.tsx | 需适配新 API |

### 走查详情

#### ✅ 通过项

1. {通过的检查点及理由}

#### ⚠️ 风险项

1. **{风险描述}**
   - **现状**：{KB 中查到的现有实现}
   - **方案**：{方案中的变更}
   - **风险**：{具体风险}
   - **建议**：{修改建议}

#### ❌ 问题项

1. **{问题描述}**
   - **现状**：{KB 中查到的现有实现}
   - **方案**：{方案中的变更}
   - **问题**：{具体问题}
   - **建议**：{修改建议}

### 信息来源

| 来源 | 文件 | 说明 |
|------|------|------|
| KB | kb/... | ... |
```

---

## 约束

### 通用约束

1. **不要猜测**：KB 中没有的信息，要么查源码确认，要么明确标注"未知"
2. **不要编造 API**：回答中提到的 API 路径、参数、字段必须在 KB 或源码中有据可查
3. **标注来源**：每个回答必须包含"信息来源"表格
4. **KB 路径使用相对路径**：如 `kb/server/server/01_index_api.md`，不用绝对路径

### 问答约束

1. **简洁优先**：如果索引表已能回答，不要读取详情文件浪费 token
2. **表格优先**：字段列表、API 列表等用表格展示，不要用纯文本
3. **调用链必画**：涉及跨模块的问题，必须画出完整调用链

### 走查约束

1. **必须给结论**：走查报告必须有"总体结论"，不能只列问题不给判断
2. **影响范围必须完整**：不能只看方案直接涉及的文件，还要检查间接影响（如修改 Model 会影响所有使用该 Model 的 Service 和 Route）
3. **建议必须可操作**：每个风险/问题项必须给出具体的修改建议，不能只说"需要注意"

---

## Few-Shot 示例

### 示例 1：技术问答

**用户问题**：Agent Model 有哪些字段？和 User 是什么关系？

**执行过程**：
1. 判断知识域 → 后端 Model
2. 读取 `kb/server/server/02_index_model.md`
3. 找到 Agent Model 的字段列表和关联关系

**回答**：

```markdown
## 回答

### Agent Model

**文件**: server/src/models/Agent.ts

**接口 `IAgent`**:

| 字段 | 类型 | 可选 | 说明 |
|------|------|------|------|
| name | string | — | Agent 名称 |
| slug | string | — | URL 友好标识 |
| description | string | ✅ | 描述 |
| systemPrompt | string | — | 系统提示词 |
| ... | ... | ... | ... |

### 与 User 的关系

Agent 通过 `userId` 字段关联到 User Model（N:1 关系），表示每个 Agent 归属于一个用户。

### 信息来源

| 来源 | 文件 |
|------|------|
| KB 索引 | kb/server/server/02_index_model.md |
```

### 示例 2：方案走查

**用户输入**：我计划给 Agent 增加一个"标签"功能，允许用户给 Agent 打标签，支持按标签筛选。

**走查报告摘要**：

```markdown
## 方案走查报告

### 总体结论

⚠️ 有风险，建议修改

### 影响范围

| 模块 | 影响类型 | 影响文件 |
|------|---------|---------|
| 后端 Model | 修改 | models/Agent.ts — 新增 tags 字段 |
| 后端路由 | 修改 | routes/agents.ts — 列表接口增加 tags 过滤 |
| 前端类型 | 修改 | types/index.ts — Agent 接口增加 tags |
| 前端页面 | 修改 | pages/AgentsPage.tsx — 增加标签筛选 UI |

### ⚠️ 风险项

1. **Agent 列表 API 性能**
   - **现状**：GET /api/agents 当前无索引优化
   - **方案**：增加 tags 数组字段 + 按标签筛选
   - **风险**：MongoDB 数组字段的 $in 查询在数据量大时性能下降
   - **建议**：为 tags 字段添加多键索引 `{ tags: 1 }`
```

---

## 边界条件处理

| 场景 | 处理方式 |
|------|---------|
| KB 目录不存在 | 提示用户先执行 `doc-code-to-kb` Skill 生成知识库 |
| 问题涉及 KB 未覆盖的文件 | 直接读取源码，标注"⚠️ KB 未覆盖" |
| 用户问题模糊 | 先从 `00_project_map.md` 给出项目概览，再请用户明确问题 |
| 方案涉及新模块（KB 中不存在） | 只走查与现有模块的兼容性，新模块部分标注"无法走查" |
| KB 信息与源码不一致 | 以源码为准，标注"⚠️ KB 可能过期，以下基于源码" |
