# 前端技术设计文档模板

生成 `fe-{feature}.md` 时严格遵循以下模板格式。

---

## 文档模板

```markdown
# 前端技术设计：{功能名称}

> 版本：{版本号}
> PRD 来源：version-doc/{版本号}/prd/prd.md
> 后端设计：version-doc/{版本号}/design/be-{feature}.md（如有）
> 生成日期：{YYYY-MM-DD}
> 目标应用：{web / admin / both}
> 技术栈：React 19 + Antd 6 + TailwindCSS + Zustand 5 + TypeScript

---

## 一、设计概述

**功能摘要**：{一句话描述}

**涉及 PRD 模块**：{列出对应的 PRD 功能模块编号}

**变更范围**：

| 类型 | 新增 | 修改 | 复用 | 说明 |
|------|------|------|------|------|
| 页面 | {N} | {N} | {N} | {列出名称} |
| 组件 | {N} | {N} | {N} | {列出名称} |
| API 函数 | {N} | {N} | {N} | {列出名称} |
| Store | — | {有/无} | — | {说明} |
| 类型定义 | {N} | {N} | {N} | {列出名称} |
| 路由 | {N} | {N} | — | {列出路径} |

---

## 二、文件变更清单（快速预览）

> 供 design-review 和人工审批快速了解本次变更涉及的所有文件，无需通读全文。

| # | 文件路径 | 操作 | 变更内容 | 影响范围 |
|---|---------|------|---------|---------|
| 1 | `{app}/src/pages/{PageName}.tsx` | 🆕 新增 / ✏️ 修改 | {简要描述变更内容} | {新文件 / 影响哪些页面} |
| 2 | `{app}/src/components/{ComponentName}.tsx` | 🆕 新增 / ✏️ 修改 | {简要描述变更内容} | {新文件 / 影响哪些页面引用} |
| 3 | `{app}/src/api/index.ts` | ✏️ 修改 | {新增 N 个 API 封装函数} | {影响哪些页面调用} |
| 4 | `{app}/src/store/index.ts` | ✏️ 修改 / 📎 无变更 | {新增 N 个状态和 Action} | {影响哪些组件} |
| 5 | `{app}/src/types/index.ts` | ✏️ 修改 | {新增 N 个类型定义} | {影响哪些文件引用} |
| 6 | `{app}/src/App.tsx` | ✏️ 修改 | {注册新路由} | {N 行变更} |
| ... | ... | ... | ... | ... |

**操作图例**：🆕 新增文件 · ✏️ 修改现有文件 · 🗑️ 删除文件 · 📎 复用（无变更）

---

## 三、路由设计

### 新增路由

| 路径 | 组件 | 权限 | 懒加载 | 说明 |
|------|------|------|--------|------|
| /{path} | {PageName} | auth/public | ✅/否 | {说明} |

### 路由注册（App.tsx）

\`\`\`tsx
// 在现有路由配置中新增
<Route path="/{path}" element={<{PageName} />} />
\`\`\`

---

## 四、页面设计

### 4.1 {PageName}（新增/修改现有）

> 来源：PRD 功能模块 {N}
> 文件：{app}/src/pages/{PageName}.tsx

**页面布局**：

\`\`\`
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
\`\`\`

**组件树**：

\`\`\`
{PageName}
├── PageHeader（标题 + 操作按钮）
├── FilterBar（筛选栏）
├── DataList / DataTable（数据展示）
│   └── DataItem / TableRow（单条数据）
├── Pagination（分页）
└── EditModal（编辑弹窗）
\`\`\`

**本地状态**：

| 状态 | 类型 | 初始值 | 说明 |
|------|------|--------|------|
| {state} | {type} | {initial} | {desc} |

**API 调用**：

| 函数 | API 方法 | 触发时机 | 说明 |
|------|---------|---------|------|
| {handler} | {apiFunc} | {trigger} | {desc} |

**事件处理**：

| 函数名 | 触发元素 | 逻辑 |
|--------|---------|------|
| handle{Action} | {element} | {logic} |

**交互流程**：
1. {步骤 1}
2. {步骤 2}
3. {步骤 3}

---

## 五、组件设计

### 5.1 {ComponentName}（新增/复用）

> 来源：PRD 功能模块 {N}
> 文件：{app}/src/components/{ComponentName}.tsx（公共组件）
> 或：页面内组件（不单独抽取文件）

**Props 接口**：

\`\`\`typescript
interface {ComponentName}Props {
  field: type;                          // 说明
  onEvent?: (params: type) => void;     // 事件回调
}
\`\`\`

**内部状态**：

| 状态 | 类型 | 初始值 | 说明 |
|------|------|--------|------|
| {state} | {type} | {initial} | {desc} |

**使用的 Antd 组件**：{列出}

**渲染逻辑**：
- {描述}

---

## 六、API 封装设计

### 文件：{app}/src/api/index.ts

**新增函数**：

\`\`\`typescript
// {说明}
// 来源：PRD 功能模块 {N}
export const {funcName} = (params: {ParamType}): Promise<{ResponseType}> => {
  return request.{method}('/api/xxx', params);
};
\`\`\`

**修改函数**（如修改现有）：

\`\`\`typescript
// 在现有 {funcName} 函数中新增参数
export const {funcName} = (params: {ParamType} & { newParam?: type }): Promise<{ResponseType}> => {
  return request.{method}('/api/xxx', params);
};
\`\`\`

---

## 七、Store 设计

### 文件：{app}/src/store/index.ts

{如无变更则写"本次无 Store 变更"}

**新增状态**：

\`\`\`typescript
// 在现有 Store 中新增
{stateName}: {type},
\`\`\`

**新增 Action**：

\`\`\`typescript
// 新增 Action
set{StateName}: (value: {type}) => set({ {stateName}: value }),
\`\`\`

---

## 八、类型定义设计

### 文件：{app}/src/types/index.ts

**新增类型**：

\`\`\`typescript
// {说明}
// 来源：PRD 功能模块 {N}
export interface {TypeName} {
  field: type;  // 说明
}
\`\`\`

**修改类型**（如修改现有）：

\`\`\`typescript
// 在现有 {TypeName} 中新增字段
export interface {TypeName} {
  // ... 现有字段保持不变
  newField: type;  // 新增：说明
}
\`\`\`

---

## 九、KB 参考

| 参考内容 | KB 文件 | 说明 |
|---------|---------|------|
| {参考了什么} | kb/frontend/... | {为什么参考} |

---

## 十、实施建议

### 实施顺序

1. {第一步：通常是类型定义}
2. {第二步：通常是 API 封装}
3. {第三步：通常是 Store 变更}
4. {第四步：通常是组件开发}
5. {第五步：通常是页面组装}
6. {第六步：路由注册}
7. {第七步：联调测试}

### 测试要点

| 测试场景 | 预期结果 |
|---------|---------|
| {场景} | {预期} |

### Mock 数据建议

{如后端尚未开发，建议的 Mock 数据方案}
```
