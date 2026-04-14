---
name: doc-code-to-kb
description: "从代码生成项目知识库。扫描 TypeScript/React/Koa Monorepo 项目结构，按各层生成规范构建五层索引知识库（含项目宪法、架构模式、反模式）。"
---

# Doc-Code-To-KB — 从代码生成知识库

## 目标

让 AI 在编程时能 **3 秒内定位** 到项目中的任何路由、Model、Service、组件、页面，而无需逐文件搜索。

## 适用技术栈

| 层级 | 技术 | 语言 |
|------|------|------|
| 后端 | Koa + Mongoose | TypeScript (.ts) |
| 前端 | React 19 + Antd + TailwindCSS + Zustand | TypeScript (.tsx/.ts) |
| 构建 | Vite + npm workspaces (Monorepo) | — |

## 设计哲学

知识库不是文档，而是 **AI 的项目认知缓存**。

**消费路径**（AI 查阅时的五层定位）：
0. 第零层 project_constitution → "这个项目的架构决策、编码约定、技术栈锁定是什么？"
1. 第一层 project_map → "这个项目有哪些模块？我要找的功能在哪个模块？"
2. 第二层 index → "这个模块有哪些 Route/Model/Service/Page？我要找的符号叫什么？在哪个文件？"
2.5. 第二.五层 architecture_patterns / anti_patterns → "这个模块的编码模式是什么？哪些做法是被禁止的？"
3. 第三层 detail → "这个 Service 的完整逻辑是什么？入参出参？调用了谁？"

**三个使用场景的依赖层级**：

| 场景 | 最依赖 | 次依赖 | 生成时的关注点 |
|------|--------|--------|--------------|
| 解答用户提问 | 第一层+第二层 | 第三层 | 索引表的搜索友好性（关键词、路径、说明） |
| AI 编码参考 | 第零层+第二.五层+第三层 | 第二层 | 架构模式遵循、函数签名精确、反模式规避 |
| 方案设计参考 | 第零层+第一层+第二层 | 第三层 | 架构决策、模块关系、依赖矩阵 |
| Code Review | 第零层+第二.五层 | 第三层 | 架构模式合规、反模式检测 |

因此生成时的优先保障顺序：**签名精确 > 覆盖全量 > 逻辑详尽**

## 完备性标准

一个"可用"的模块知识库必须满足：
1. **符号全覆盖**：模块中每一个导出函数/组件/Model 在至少一个索引文件中有记录
2. **签名可追溯**：每个 API 的入参出参可以追溯到具体的 TypeScript 类型定义
3. **调用链可查**：任意路由处理函数能沿 Route → Service → Model 链路追踪到数据库操作
4. **前后端可关联**：前端 API 函数能对应到后端路由路径
5. **架构模式已提取**：每个模块有 `06_architecture_patterns.md`，包含 ✅ GOOD / ❌ BAD 代码示例
6. **反模式已记录**：每个模块有 `07_anti_patterns.md`，列出禁止做的事情及检测方法
7. **项目宪法已生成**：`kb/00_project_constitution.md` 包含架构决策、编码约定、技术栈锁定

## 五层索引体系

```
第零层: kb/00_project_constitution.md → 项目宪法：架构决策、编码约定、技术栈锁定（全局唯一）
第一层: 00_project_map.md            → 项目全景："这个项目有什么？去哪里找？"
第二层: 0N_index_*.md                → 符号索引表：所有 API/Model/Service/Page 等的详细索引
第二.五层: 06_architecture_patterns.md → 架构模式：✅ GOOD / ❌ BAD 代码示例（每个模块一个）
         07_anti_patterns.md         → 反模式清单：禁止做的事情及检测方法（每个模块一个）
第三层: api/ services/ pages/        → 全量详情文件：每个路由/Service/页面一个文件（分详略）
```

## 知识库目录规范

**后端**（Koa）→ `kb/server/{module-name}/`
**前端**（React）→ `kb/frontend/{app-name}/`

Monorepo 项目额外在 `kb/` 根目录放 `00_project_map.md`。

### 第三层文件命名规则

| 类型 | 目录 | 命名规则 | 示例 |
|------|------|---------|------|
| 路由详情 | api/ | 路由文件名（不带 .ts） | `agents.md` |
| Service 详情 | services/ | Service 文件名（不带 .ts） | `llmService.md` |
| 前端页面详情 | pages/ | 组件名转 kebab-case | `chat-page.md` |

所有文件名使用 camelCase（后端）或 kebab-case（前端），不带 .ts/.tsx 后缀。

---

## 覆盖度保障协议

1. **第 2 步结束后**，将 scan_project.py 的输出保存为临时文件，然后执行：
   ```bash
   python3 {SKILL_DIR}/scripts/gen_progress.py init <kb_root> <scan_json_file>
   ```
   生成 `<kb_root>/progress.md` 作为全量文件清单

2. **每写完一个文件后**，立即执行：
   ```bash
   python3 {SKILL_DIR}/scripts/gen_progress.py done <kb_root> <relative_filepath>
   ```

3. **每完成一个模块后**，执行 status 子命令确认该模块无遗漏：
   ```bash
   python3 {SKILL_DIR}/scripts/gen_progress.py status <kb_root>
   ```
   如果有 ⬜ 残留，立即补生成

4. **禁止跳过 done 调用**——即使文件已写入磁盘，不执行 done 就不算完成

## 断点续做协议

本 Skill 面向中大型项目，生成过程可能跨多轮对话。

**批次边界**：
- 一个模块 = 一个批次
- 每个批次结束时输出当前进度摘要（执行 status 子命令），然后继续下一个模块
- 如果当前对话已处理 3+ 模块或已生成 40+ 文件，主动告知用户"建议新开对话继续"，并输出续做指令

**中断恢复**：
当用户说"继续生成知识库"时：
1. 执行 `python3 {SKILL_DIR}/scripts/gen_progress.py status <kb_root>`
2. 从 status 输出中确认：已完成的文件列表、待处理的文件列表、当前所在模块和层级
3. 从上次中断点继续，不重复已完成的文件
4. 如果 progress.md 不存在，视为全新构建，从第 1 步开始

**续做指令模板**（输出给用户复制粘贴）：
> 请继续生成知识库。知识库位置：`<kb_root>`

---

## 编排流程

### 第 1 步：扫描项目

```bash
python3 {SKILL_DIR}/scripts/scan_project.py <project_root>
```

从输出 JSON 确定：
- `project_type`：项目类型（monorepo / single）
- `server`：后端信息（routes、models、services）
- `frontend_projects`：前端项目列表（pages、components、api、store、types）

### 第 2 步：列出构建计划并确认

```
| # | 模块 | 技术栈 | 源码位置 | KB 位置 |
|---|------|--------|---------|---------|
```

等待用户确认。

用户确认后，将第 1 步的 scan JSON 保存为临时文件（`<kb_root>/.scan_result.json`），然后初始化进度清单：

```bash
python3 {SKILL_DIR}/scripts/gen_progress.py init <kb_root> <kb_root>/.scan_result.json
```

### 第 3 步：逐模块生成第一层 + 第二层

一个模块一个模块地处理。当前模块所有文件生成完后再做下一个。

**Koa 后端模块**，按序生成：
1. 生成 `00_project_map.md` — 读取 `{SKILL_DIR}/references/project_map_monorepo.md` 模板
2. 生成 `01_index_api.md` + `api/*.md` — **必须严格按照** `{SKILL_DIR}/references/doc-koa-route.md` 中的格式生成（总览文件 + 每个路由文件一个详情文件）
3. 生成 `02_index_model.md` — **必须严格按照** `{SKILL_DIR}/references/doc-koa-model.md` 中的格式生成
4. 生成 `03_index_service.md` + `services/*.md` — **必须严格按照** `{SKILL_DIR}/references/doc-koa-service.md` 中的格式生成（总览文件 + 每个 Service 一个详情文件）
5. 生成 `04_index_config.md` — **必须严格按照** `{SKILL_DIR}/references/doc-koa-middleware.md` 中的格式生成
6. 生成 `changelog.md`

**React 前端模块**，按序生成：
1. 生成 `00_project_map.md` — 读取 `{SKILL_DIR}/references/project_map_monorepo.md` 模板
2. 生成 `01_index_page.md` + `pages/*.md` — **必须严格按照** `{SKILL_DIR}/references/doc-react-page.md` 中的格式生成（总览文件 + 每个页面一个详情文件）
3. 生成 `02_index_component.md` — **必须严格按照** `{SKILL_DIR}/references/doc-react-component.md` 中的格式生成
4. 生成 `03_index_api.md` — **必须严格按照** `{SKILL_DIR}/references/doc-react-api.md` 中的格式生成
5. 生成 `04_index_store.md` — **必须严格按照** `{SKILL_DIR}/references/doc-react-store.md` 中的格式生成
6. 生成 `05_index_types.md` — **必须严格按照** `{SKILL_DIR}/references/doc-react-types.md` 中的格式生成
7. 生成 `changelog.md`

**每个索引文件的生成流程（必须逐条执行，不得跳过任何步骤）：**

1. 用 `read_file` **完整读取**对应的规范文件（`{SKILL_DIR}/references/doc-xxx.md`），从头读到尾
   - ⚠️ **这一步是强制的，每个索引文件都必须执行**，即使你"记得"规范内容也不行
   - ⚠️ **如果一轮对话中要生成多个索引文件**，每个文件生成前都要重新 `read_file` 读对应规范（不同索引对应不同规范文件）
2. 按规范中 **"分析流程"** 章节的每一步扫描源码：
   - 规范要求"读取路由文件提取端点"→ 就必须 `read_file` 打开路由文件
   - 规范要求"提取 Schema 字段"→ 就必须 `read_file` 打开 Model 文件
   - **不得跳过任何提取步骤**
3. 按规范中 **"索引文件格式"** 或 **"详情文件格式"** 章节的格式输出，**逐项对照**：
   - 示例中有"请求参数"表 → 生成的文件必须有"请求参数"表
   - 示例中有"响应 Body"表 → 生成的文件必须有"响应 Body"表
   - 示例中有"业务逻辑"行 → 生成的文件必须有"业务逻辑"行
   - **如果生成的内容缺少示例中的任何一个部分，视为不合格**
4. 用 `write_to_file` 写到 `kb/{server|frontend}/{module}/{filename}`
5. **写完后立即执行** `python3 {SKILL_DIR}/scripts/gen_progress.py done <kb_root> <relative_filepath>` 标记完成

**每完成一个模块后**，执行 `python3 {SKILL_DIR}/scripts/gen_progress.py status <kb_root>` 确认无遗漏，再处理下一个模块。

### 第 3.5 步：提取架构模式与反模式（🆕 新增）

> 借鉴 BMAD-METHOD 的 `project-context.md` 和 awesome-cursorrules 的 MDC 格式。
> 本步骤从实际代码中提取架构模式，生成 ✅ GOOD / ❌ BAD 代码示例。

#### 3.5.1 生成项目宪法

**输出文件**：`kb/00_project_constitution.md`（全局唯一）

**提取方法**：
1. 读取 `package.json` → 提取技术栈和版本号
2. 读取 `server/src/config/env.ts` → 提取环境变量管理模式
3. 读取 `server/src/index.ts` → 提取中间件注册顺序和路由挂载模式
4. 读取 `server/src/middleware/auth.ts` → 提取认证和权限模式
5. 读取 `web/src/api/index.ts` → 提取 API 封装模式（axios 实例、拦截器）
6. 读取 `web/src/store/index.ts` → 提取状态管理模式（Zustand 配置）
7. 综合以上信息，按模板生成项目宪法

**项目宪法必须包含**：
- 架构决策记录（ADR）：为什么选择 X 而不是 Y
- 全局编码约定：命名、错误处理、响应格式
- 技术栈锁定：每个层级的技术选型和禁止替代
- 目录结构约定
- 多语言约定
- 环境变量约定

#### 3.5.2 生成后端架构模式

**输出文件**：`kb/server/{module}/06_architecture_patterns.md`

**提取方法**：
1. 读取 3 个典型路由文件 → 提取路由注册模式、响应格式模式
2. 读取 `middleware/auth.ts` → 提取认证中间件链模式
3. 读取 2 个典型 Model 文件 → 提取 Schema 定义模式
4. 读取 `config/env.ts` → 提取环境变量读取模式
5. 读取 1 个 SSE 路由 → 提取流式响应模式
6. 读取 `index.ts` → 提取全局错误处理模式

**每个模式必须包含**：
- 模式编号和名称（如 `Pattern-S001: 路由注册模式`）
- 一段文字说明
- ✅ GOOD 代码示例（从实际代码中提取）
- ❌ BAD 代码示例（常见错误写法）

#### 3.5.3 生成后端反模式

**输出文件**：`kb/server/{module}/07_anti_patterns.md`

**提取方法**：
1. 扫描 `routes/*.ts` → 检测是否有直接操作 Model 的复杂业务逻辑
2. 扫描所有 `.ts` 文件 → 检测 `process.env.` 出现在 `config/env.ts` 以外的位置
3. 扫描所有 `.ts` 文件 → 检测空 catch 块、缺少 .js 后缀的导入

**每条反模式必须包含**：
- 编号和名称（如 `AP-S001: 禁止在 Route 中直接操作复杂业务逻辑`）
- 原因说明
- 检测方法
- ❌ BAD / ✅ GOOD 代码示例

#### 3.5.4 生成前端架构模式

**输出文件**：`kb/frontend/{app}/06_architecture_patterns.md`

**提取方法**：
1. 读取 `api/index.ts` 前 80 行 → 提取 axios 实例配置和拦截器模式
2. 读取 `store/index.ts` → 提取 Zustand 使用模式（persist、useShallow）
3. 读取 `types/index.ts` 前 50 行 → 提取类型定义模式
4. 读取 3 个典型页面 → 提取页面组件结构模式（hooks 顺序、事件处理命名）
5. 对比 web 和 admin 的 `api/index.ts` → 提取差异模式（baseURL、token key）

#### 3.5.5 生成前端反模式

**输出文件**：`kb/frontend/{app}/07_anti_patterns.md`

**提取方法**：
1. 扫描 `pages/*.tsx` → 检测是否有绕过 axios 实例的 fetch 调用
2. 扫描 `store/index.ts` → 检测是否有 token 字段
3. 扫描 `pages/*.tsx` → 检测是否有 `style={{ }}` 内联样式
4. 扫描 `pages/*.tsx` → 检测是否有 `export interface`（应在 types/ 中）

#### 执行要求

1. **先生成项目宪法**（全局唯一），再逐模块生成架构模式和反模式
2. **代码示例必须来自实际代码**，不要编造
3. **每个文件写完后立即执行** `gen_progress.py done`
4. **如果项目宪法已存在**，读取并检查是否需要更新（技术栈版本变化等）

---

### 第 4 步：生成第三层（全量详情文件）

第二层全部完成后，**为所有路由、Service、前端页面生成详情文件**。全量生成，不可跳过。

```
kb/server/{module}/
├── api/                   # 全量路由详情（每个路由文件一个详情文件）
└── services/              # 全量 Service 详情（每个 Service 一个详情文件）

kb/frontend/{app}/
└── pages/                 # 全量页面详情（每个页面一个详情文件）
```

**每个详情文件写完后**，立即执行 `gen_progress.py done` 标记完成。

#### 后端路由详情（api/）

**为每个路由文件生成 `api/{routeName}.md`**。

```markdown
# {routeName} 路由

**文件**: server/src/routes/{filename}.ts
**挂载前缀**: /api/{prefix}

## API 列表

### GET /api/{prefix}

**中间件**: requireAuth
**说明**: 获取列表

**请求参数**:

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| page | query | number | 否 | 页码 |

**响应 Body**:

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 是否成功 |
| data | Array | 数据列表 |

**业务逻辑**:
1. 从 ctx.query 获取分页参数
2. 调用 Model.find() 查询
3. 返回结果

**调用链**: Route → Model.find() → MongoDB
```

---

#### 后端 Service 详情（services/）

**为每个 Service 生成 `services/{serviceName}.md`**。根据复杂度分两种格式：

**复杂 Service**（满足任一：导出函数 ≥ 3、依赖 2+ Model/Service、文件 > 200 行）→ **完整格式**：

```markdown
# {serviceName}

**文件**: server/src/services/{filename}.ts
**复杂度**: 复杂

## 职责
一句话描述。

## 依赖

| 依赖 | 类型 | 用途 |
|------|------|------|
| Agent | Model | 查询 Agent 配置 |
| openai | 外部库 | LLM API 调用 |

## 导出函数详情

### functionName(param1: Type1, param2: Type2): ReturnType

**入参**:
- param1: Type1 — 说明
- param2: Type2 — 说明

**出参**: ReturnType

**完整逻辑**:
1. 步骤一
2. 步骤二

**错误处理**:
| 错误 | 条件 | 处理方式 |
|------|------|---------|
| NotFoundError | 资源不存在 | throw 404 |

## 调用关系
Route.handler() → Service.fn() → Model.find() → MongoDB
```

**简单 Service**（不满足上述条件）→ **精简格式**：

```markdown
# {serviceName}

**文件**: server/src/services/{filename}.ts
**复杂度**: 简单

## 职责
一句话描述。

## 导出函数

| 函数 | 入参 | 出参 | 说明 |
|------|------|------|------|
| fn1(param) | ParamType | ReturnType | 功能说明 |
```

---

#### 前端页面详情（pages/）

**为每个页面生成 `pages/{pageName}.md`**。根据复杂度分两种格式：

**复杂页面**（useState ≥ 4、调用 2+ API、或包含表单提交）→ **完整格式**（含状态管理、API 调用、事件处理、交互流程）

**简单页面** → **精简格式**：

```markdown
# {PageName}

**文件**: src/pages/{filename}.tsx
**路由**: /{path}
**复杂度**: 简单

## 功能概述
一句话描述。

## API 调用

| 函数 | API | 触发时机 | 说明 |
|------|-----|---------|------|
| handleLoad | api.getList | 页面加载 | 获取列表 |
```

---

#### 执行要求

1. **全量生成**——模块中的每一个路由/Service/页面都必须在对应目录下有文件
2. **复杂类用完整格式，简单类用精简格式**
3. **逐个生成**，每个文件生成后立即写入，立即执行 `gen_progress.py done`
4. **不得跳过**——不要自行判断"太简单不需要生成"

### 第 5 步：自检

执行验证脚本：

```bash
python3 {SKILL_DIR}/scripts/verify_kb.py <kb_root>
```

- 如果 status = "pass"：进入第 6 步
- 如果 status = "fail"：按 recommendation 补生成缺失文件，最多补 2 轮
- 每轮补生成后重新执行验证脚本

### 第 6 步：输出报告

```
## 知识库构建完成

| # | 模块 | 技术栈 | 第二层文件数 | 第三层文件数 |
|---|------|--------|------------|------------|
| 1 | server/server | koa-typescript | 6/6 ✅ | api:15 services:14 |
| 2 | frontend/web | react-typescript | 7/7 ✅ | pages:18 |
| 3 | frontend/admin | react-typescript | 7/7 ✅ | pages:16 |

知识库位置: <project_root>/kb/
```

---

## 通用规则（必须遵守）

1. **一次只处理一个模块**
2. **模块间不停顿**，完成一个立即做下一个（除非触发断点续做协议的上下文预警）
3. **表格优先**，所有索引文件必须用 Markdown 表格
4. **覆盖所有符号**，不能遗漏
5. **路径精确**，标注相对项目根目录的路径
6. **空类别也生成文件**，写 `> 该模块无此类型的代码`
7. **必须严格按规范文件中的格式生成**，不得省略表格列、参数详情或响应字段
8. **生成每个索引文件前必须先 read_file 读取对应规范文件**，不要凭记忆生成
9. **每个文件写完后必须执行 gen_progress.py done**，保持进度清单实时更新
10. **架构模式必须有 ✅ GOOD / ❌ BAD 代码示例**，示例必须来自实际代码
11. **反模式必须有检测方法**，说明如何在代码中发现违规
12. **项目宪法是全局唯一的**，放在 `kb/` 根目录，不在模块目录下重复

---

## 规范文件清单

所有规范文件在 `{SKILL_DIR}/references/` 目录下：

### 项目地图模板

| 文件 | 用途 |
|------|------|
| `project_map_monorepo.md` | Monorepo 项目地图模板 |

### 后端生成规范（Koa + TypeScript）

| 文件 | 生成目标 | 说明 |
|------|---------|------|
| `doc-koa-route.md` | `01_index_api.md` + `api/*.md` | 路由 API 索引（总览 + 每个路由文件一个详情） |
| `doc-koa-model.md` | `02_index_model.md` | Mongoose Model 索引（含 Schema 字段、关联关系） |
| `doc-koa-service.md` | `03_index_service.md` + `services/*.md` | Service 索引 + 全量 Service 详情 |
| `doc-koa-middleware.md` | `04_index_config.md` | 中间件与配置索引（含环境变量、数据库连接） |

### 前端生成规范（React + TypeScript）

| 文件 | 生成目标 | 说明 |
|------|---------|------|
| `doc-react-page.md` | `01_index_page.md` + `pages/*.md` | 页面索引 + 全量页面详情 |
| `doc-react-component.md` | `02_index_component.md` | 公共组件索引（含 Props/状态/事件） |
| `doc-react-api.md` | `03_index_api.md` | 前端 API 封装索引 |
| `doc-react-store.md` | `04_index_store.md` | Zustand Store 索引 |
| `doc-react-types.md` | `05_index_types.md` | TypeScript 类型定义索引 |

---

## 更新知识库（增量更新模式）

> 🆕 当 Pipeline 中的 KB 更新步骤被触发时，使用此模式。
> 不需要全量扫描，只更新受影响的索引文件和详情文件。

### 触发条件

以下任一条件满足时触发增量更新：
- Pipeline 中的 `doc-code-to-kb` 步骤被执行
- 用户说"更新知识库"、"同步 KB"、"KB 增量更新"
- 用户说"把 XX 功能更新到知识库"

### 输入

| 参数 | 必填 | 说明 |
|------|------|------|
| **版本号** | 否 | 如 `v1.3.0`，用于定位 `version-doc/{版本号}/` 下的设计文档 |
| **变更文件列表** | 否 | 手动指定变更的源码文件列表 |

如果未提供版本号和变更文件列表，则使用 `detect_changes.py` 自动检测：

```bash
python3 {SKILL_DIR}/scripts/detect_changes.py <project_root>
```

### 增量更新编排流程

#### IU-1：确定变更范围

**方式 A：从版本文档推断**（推荐）

读取 `version-doc/{版本号}/CHANGELOG.md` 或 `version-doc/{版本号}/design/be-*.md` + `fe-*.md`，提取：
- 新增的 Model 文件列表
- 新增/修改的 Route 文件列表
- 新增的 Service 文件列表
- 新增的前端组件文件列表
- 修改的前端页面文件列表
- 新增的前端 API 函数列表
- 新增的前端类型定义列表

**方式 B：从 detect_changes.py 推断**

```bash
python3 {SKILL_DIR}/scripts/detect_changes.py <project_root>
```

输出受影响的索引文件列表。

**方式 C：用户手动指定**

用户直接告知变更了哪些文件。

#### IU-2：确定受影响的 KB 文件

根据变更范围，映射到需要更新的 KB 文件：

| 变更类型 | 受影响的 KB 文件 |
|---------|----------------|
| 新增 Model | `02_index_model.md`（追加条目） |
| 修改 Model（新增字段） | `02_index_model.md`（更新对应 Model 的字段表） |
| 新增 Route 文件 | `01_index_api.md`（追加路由挂载 + API 列表）+ 新建 `api/{routeName}.md` 详情 |
| 修改 Route 文件（新增端点） | `01_index_api.md`（更新端点数 + 追加 API 列表）+ 更新 `api/{routeName}.md` 详情 |
| 新增 Service | `03_index_service.md`（追加条目）+ 新建 `services/{serviceName}.md` 详情 |
| 新增前端组件 | `02_index_component.md`（追加条目） |
| 修改前端页面 | 更新 `pages/{pageName}.md` 详情 |
| 新增前端 API 函数 | `03_index_api.md`（追加条目） |
| 新增前端类型 | `05_index_types.md`（追加条目） |
| 修改 Agent Model（新增字段） | `02_index_model.md` + `05_index_types.md`（前端类型同步） |

#### IU-3：逐文件执行增量更新

对每个受影响的 KB 文件：

1. **读取当前 KB 文件内容**
2. **读取对应的源码文件**（新增/修改的源码）
3. **读取对应的规范文件**（`{SKILL_DIR}/references/doc-xxx.md`）
4. **按规范格式追加/更新内容**：
   - 索引文件（`0N_index_*.md`）→ 在表格末尾追加新条目，或更新已有条目
   - 详情文件（`api/*.md`、`services/*.md`、`pages/*.md`）→ 新建或覆盖重写
5. **写入文件**
6. **执行 `gen_progress.py done`**

#### IU-4：更新进度文件

更新 `kb/progress.md`，追加新增文件的记录。

#### IU-5：输出增量更新报告

```markdown
## KB 增量更新完成

**触发来源**：{版本号 / detect_changes / 手动指定}

### 更新的 KB 文件

| # | KB 文件 | 操作 | 说明 |
|---|---------|------|------|
| 1 | server/server/01_index_api.md | 更新 | 新增 review.ts 路由（4 端点） |
| 2 | server/server/02_index_model.md | 更新 | 新增 AgentReview Model + Agent ratingStats 字段 |
| 3 | server/server/03_index_service.md | 更新 | 新增 reviewService |
| 4 | server/server/api/review.md | 新建 | 评价路由详情 |
| 5 | server/server/services/reviewService.md | 新建 | 评价 Service 详情 |
| 6 | frontend/@agency/web/02_index_component.md | 更新 | 新增 3 个评价组件 |
| 7 | frontend/@agency/web/03_index_api.md | 更新 | 新增 4 个评价 API 函数 |

### 统计

| 指标 | 数量 |
|------|------|
| 更新的索引文件 | {N} |
| 新建的详情文件 | {N} |
| 更新的详情文件 | {N} |
```

### 增量更新约束

1. **只更新受影响的文件**，不触碰未变更的 KB 文件
2. **追加而非覆盖**：索引文件中已有的条目不要删除，只追加新条目或更新已有条目
3. **格式一致**：追加的内容必须与已有内容格式一致（表格列数、字段顺序等）
4. **编号连续**：追加到表格时，序号从已有最大值 +1 开始
5. **必须读取规范文件**：即使是增量更新，也必须先读取对应的规范文件确认格式
