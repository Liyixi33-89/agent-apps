---
name: prd-to-frontend-design
description: "将 PRD 转化为前端技术设计文档（fe-*.md）。基于 PRD 中的功能需求和项目知识库（kb/）中的现有前端架构，设计页面结构、组件拆分、API 调用、路由配置、Store 状态管理、TypeScript 类型等，输出可直接指导前端编码的技术设计文档。"
triggers:
  - 前端设计
  - 前端技术设计
  - frontend design
  - 页面设计
  - 组件设计
  - fe 设计文档
---

# PRD-TO-FRONTEND-DESIGN — PRD 转前端技术设计文档

## 目标

将 PRD 中的产品需求转化为前端技术设计文档，覆盖页面结构、组件拆分、API 调用、路由配置、Store 状态管理、TypeScript 类型定义等，让前端开发人员可以直接按文档编码。

**核心隐喻**：你是一个"前端架构师"——把产品经理的交互描述翻译成组件树、状态流和 API 调用链。每个页面都有清晰的组件边界，每个状态都有明确的数据流向。

---

## 设计原则

1. **KB 驱动**：所有设计必须基于项目知识库中的现有前端架构，复用已有组件、API 封装、Store、类型定义
2. **组件化思维**：页面拆分为可复用的组件，明确 Props 接口和事件回调
3. **类型安全**：所有数据结构都有 TypeScript 类型定义，API 响应有明确的类型
4. **状态最小化**：只在必要时使用全局 Store，优先使用组件本地状态
5. **遵循现有模式**：新代码必须遵循项目现有的路由注册方式、API 封装方式、Store 使用方式

---

## 适用技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| UI 框架 | React 19 | 函数组件 + Hooks |
| UI 组件库 | Antd 6 | 表格、表单、弹窗等 |
| 样式 | TailwindCSS | 原子化 CSS |
| 状态管理 | Zustand 5 | 全局状态 |
| 路由 | react-router-dom 7 | 客户端路由 |
| HTTP | axios | API 请求 |
| 语言 | TypeScript | 强类型 |

---

## 输入

| 参数 | 必填 | 说明 |
|------|------|------|
| **PRD 文件** | ✅ | `version-doc/{版本号}/prd/prd.md` |
| **后端设计** | 否 | `version-doc/{版本号}/design/be-*.md`（如已有，可参考接口定义） |
| **版本号** | ✅ | 如 `v1.0.1`，用于确定输入/输出目录 |
| **目标应用** | 否 | `web` / `admin` / `both`，默认根据 PRD 内容自动判断 |

**版本号获取规则**：
1. 如果用户直接指定了版本号 → 使用用户指定的
2. 如果文件路径中包含版本号 → 从路径提取
3. 如果以上未提供 → **向用户询问版本号**，不可跳过

## 输出

**输出位置**：`version-doc/{版本号}/design/`

| 文件 | 说明 |
|------|------|
| `fe-{feature}.md` | 每个功能模块一个前端设计文档 |

如果功能模块较少（≤2 个），可以合并为一个 `fe-design.md`。

---

## 编排流程

### 第 0 步：检查前置条件

1. 检查 `version-doc/{版本号}/prd/prd.md` 是否存在
   - 不存在 → 提示用户先执行 `prd-brd-to-prd` Skill
2. 检查是否有后端设计文档 `version-doc/{版本号}/design/be-*.md`
   - 存在 → 读取，参考其中的 API 接口定义和数据类型
   - 不存在 → 从 PRD 中的接口约定推断
3. 检查 KB 是否存在
   - `kb/frontend/` 不存在 → 提示用户先执行 `doc-code-to-kb`，但仍可继续（标注"⚠️ 未参考 KB"）

### 第 1 步：读取 PRD 并提取前端相关需求

读取 `version-doc/{版本号}/prd/prd.md`，提取：
- 所有功能模块及其页面设计
- 交互流程
- 接口约定
- 数据模型约定
- 目标应用（web/admin/both）

如果有后端设计文档，同时读取：
- API 接口的完整定义（请求/响应类型）
- 数据模型的完整 Schema

### 第 2 步：深度查阅项目知识库

**必须读取以下 KB 文件**（按需，根据目标应用选择 web 或 admin）：

| KB 文件 | 目的 |
|---------|------|
| `kb/frontend/@agency/{app}/00_project_map.md` | 了解前端项目整体结构 |
| `kb/frontend/@agency/{app}/01_index_page.md` | 了解现有页面和路由，避免冲突 |
| `kb/frontend/@agency/{app}/02_index_component.md` | 了解可复用的公共组件 |
| `kb/frontend/@agency/{app}/03_index_api.md` | 了解现有 API 封装函数 |
| `kb/frontend/@agency/{app}/04_index_store.md` | 了解现有 Store 结构 |
| `kb/frontend/@agency/{app}/05_index_types.md` | 了解现有类型定义 |

**如果需要更详细的信息**，进一步读取第三层详情文件：
- `kb/frontend/@agency/{app}/pages/{pageName}.md` — 了解类似页面的实现模式

**从 KB 中提取的关键信息**：
- 路由注册方式（`App.tsx` 中的 `<Route>` 组件）
- API 封装方式（`api/index.ts` 中的函数命名和调用模式）
- Store 使用方式（Zustand `create()` 的模式）
- 组件命名规范（PascalCase）
- 页面文件组织方式（`pages/` 目录结构）
- 常用 Antd 组件的使用模式

### 第 3 步：设计页面结构

对 PRD 中涉及的每个页面：

#### 3.1 新增页面

```markdown
### {PageName}（新增）

> 来源：PRD 功能模块 {N}

**文件位置**：`{app}/src/pages/{PageName}.tsx`
**路由路径**：`/{path}`
**路由参数**：`{params}`（如有）

**页面布局**：

```
┌─────────────────────────────────────┐
│ 页面标题 + 操作按钮区                  │
├─────────────────────────────────────┤
│ 筛选/搜索栏                          │
├─────────────────────────────────────┤
│ 主内容区                             │
│  ├─ 列表/表格/卡片                   │
│  └─ 分页器                          │
├─────────────────────────────────────┤
│ 弹窗（创建/编辑）                     │
└─────────────────────────────────────┘
```

**组件拆分**：

| 组件 | 类型 | Props | 说明 |
|------|------|-------|------|
| {ComponentName} | 页面内组件/公共组件 | {props} | {说明} |
```

#### 3.2 修改现有页面

```markdown
### {PageName}（修改现有）

> 来源：PRD 功能模块 {N}
> 现有定义：kb/frontend/@agency/{app}/pages/{pageName}.md

**变更内容**：
1. {变更 1}
2. {变更 2}

**新增组件**：

| 组件 | Props | 说明 |
|------|-------|------|
| {ComponentName} | {props} | {说明} |
```

### 第 4 步：设计组件

对需要新增的组件：

```markdown
### {ComponentName}（新增）

> 来源：PRD 功能模块 {N}

**文件位置**：`{app}/src/components/{ComponentName}.tsx` 或页面内组件

**Props 接口**：

```typescript
interface {ComponentName}Props {
  field: type;       // 说明
  onEvent?: (params: type) => void;  // 事件回调
}
```

**内部状态**：

| 状态 | 类型 | 初始值 | 说明 |
|------|------|--------|------|
| {state} | {type} | {initial} | {desc} |

**渲染逻辑**：
- {描述组件的渲染逻辑和条件渲染}

**使用的 Antd 组件**：
- {列出使用的 Antd 组件}
```

### 第 5 步：设计 API 调用

对需要新增/修改的 API 封装函数：

```markdown
### API 封装（{app}/src/api/index.ts）

**新增函数**：

| 函数名 | HTTP 方法 | 路径 | 参数 | 返回类型 | 说明 |
|--------|----------|------|------|---------|------|
| {funcName} | GET/POST/PUT/DELETE | /api/xxx | {params} | Promise<{Type}> | {说明} |

**函数定义**：

```typescript
// 新增 API 函数
export const {funcName} = (params: {ParamType}): Promise<{ResponseType}> => {
  return request.get('/api/xxx', { params });
};
```
```

### 第 6 步：设计 Store 变更

如果需要修改全局 Store：

```markdown
### Store 变更（{app}/src/store/index.ts）

**新增状态**：

| 状态 | 类型 | 初始值 | 说明 |
|------|------|--------|------|
| {state} | {type} | {initial} | {desc} |

**新增 Action**：

| Action | 参数 | 说明 |
|--------|------|------|
| {action} | {params} | {desc} |
```

### 第 7 步：设计 TypeScript 类型

对需要新增/修改的类型定义：

```markdown
### 类型定义（{app}/src/types/index.ts）

**新增类型**：

```typescript
// {说明}
export interface {TypeName} {
  field: type;  // 说明
}
```

**修改类型**（如修改现有）：

```typescript
// 在现有 {TypeName} 接口中新增字段
export interface {TypeName} {
  // ... 现有字段
  newField: type;  // 新增：说明
}
```
```

### 第 8 步：设计路由配置

如果需要新增路由：

```markdown
### 路由配置（{app}/src/App.tsx）

**新增路由**：

| 路径 | 组件 | 权限 | 说明 |
|------|------|------|------|
| /{path} | {PageName} | auth/public | {说明} |

**路由注册代码**：

```tsx
<Route path="/{path}" element={<{PageName} />} />
```
```

### 第 9 步：生成设计文档

读取 `{SKILL_DIR}/references/fe-design-template.md`，按模板生成设计文档。

写入 `version-doc/{版本号}/design/fe-{feature}.md`。

### 第 10 步：自检

检查设计文档的完整性：
- [ ] "文件变更清单"章节已填写完整，覆盖所有涉及的文件
- [ ] 每个 PRD 中的页面设计都有对应的前端设计
- [ ] 所有新增页面都有路由配置
- [ ] 所有 API 调用都有对应的封装函数
- [ ] 所有数据结构都有 TypeScript 类型定义
- [ ] 组件 Props 接口完整
- [ ] 标注了复用的现有组件/API/Store

### 第 11 步：输出摘要

```
## 前端技术设计完成

- PRD 来源：version-doc/{版本号}/prd/prd.md
- 目标应用：{web/admin/both}
- 设计文件：{列出所有生成的 fe-*.md 文件}

变更摘要：
- 新增页面：{N} 个
- 修改页面：{N} 个
- 新增组件：{N} 个
- 新增 API 函数：{N} 个
- 新增类型定义：{N} 个
- Store 变更：{有/无}
- 路由变更：{有/无}

建议下一步：
1. 使用 `gen-frontend-code` 按设计文档生成前端代码
2. 如后端尚未开发，可先用 Mock 数据开发前端
```

---

## 约束

### 设计约束

1. **遵循现有组件库**：优先使用 Antd 6 组件，不引入新的 UI 库
2. **遵循现有样式方案**：使用 TailwindCSS，不写自定义 CSS（除非 Tailwind 无法实现）
3. **遵循现有命名**：
   - 页面组件：`PascalCase` + `Page` 后缀（如 `AgentsPage`）
   - 公共组件：`PascalCase`（如 `TagSelector`）
   - API 函数：`camelCase`（如 `getAgentList`）
   - Store Action：`camelCase`（如 `setCurrentAgent`）
   - 类型：`PascalCase` + `I` 前缀（如 `IAgent`，遵循项目现有规范）
4. **遵循现有文件组织**：
   - 页面放 `pages/` 目录
   - 公共组件放 `components/` 目录
   - API 封装放 `api/index.ts`
   - Store 放 `store/index.ts`
   - 类型放 `types/index.ts`
5. **事件处理函数命名**：使用 `handle` 前缀（如 `handleClick`、`handleSubmit`）

### 内容约束

1. **不超出 PRD 范围**：只设计 PRD 中明确要求的功能
2. **标注 PRD 来源**：每个设计点都标注 `来源：PRD 功能模块 {N}`
3. **标注变更状态**：每个页面/组件/API/Store/类型都标注 `新增` / `修改现有` / `复用`
4. **标注 KB 参考**：设计中参考了哪些 KB 文件

### 边界条件处理

| 场景 | 处理方式 |
|------|---------|
| PRD 不存在 | 提示用户先生成 PRD |
| 后端设计文档不存在 | 从 PRD 接口约定推断 API 定义 |
| KB 不存在 | 标注"⚠️ 未参考 KB"，按通用 React+Antd 模式设计 |
| 需要新的公共组件 | 在设计文档中定义组件接口，标注为"建议抽取为公共组件" |
| 涉及 web 和 admin 两端 | 分别设计，标注共享的类型和组件 |
