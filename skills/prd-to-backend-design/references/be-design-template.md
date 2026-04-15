# 后端技术设计文档模板

生成 `be-{feature}.md` 时严格遵循以下模板格式。

---

## 文档模板

```markdown
# 后端技术设计：{功能名称}

> 版本：{版本号}
> PRD 来源：version-doc/{版本号}/prd/prd.md
> 生成日期：{YYYY-MM-DD}
> 技术栈：Koa 3 + Mongoose 8 + TypeScript

---

## 一、设计概述

**功能摘要**：{一句话描述}

**涉及 PRD 模块**：{列出对应的 PRD 功能模块编号}

**变更范围**：

| 类型 | 新增 | 修改 | 说明 |
|------|------|------|------|
| Model | {N} | {N} | {列出名称} |
| API | {N} | {N} | {列出路径} |
| Service | {N} | {N} | {列出名称} |
| 中间件 | {N} | {N} | {列出名称} |
| 配置 | {N} | {N} | {列出名称} |

---

## 二、文件变更清单（快速预览）

> 供 design-review 和人工审批快速了解本次变更涉及的所有文件，无需通读全文。

| # | 文件路径 | 操作 | 变更内容 | 影响范围 |
|---|---------|------|---------|---------|
| 1 | `server/src/models/{ModelName}.ts` | 🆕 新增 / ✏️ 修改 | {简要描述变更内容} | {新文件 / 影响哪些查询或接口} |
| 2 | `server/src/services/{serviceName}.ts` | 🆕 新增 / ✏️ 修改 | {简要描述变更内容} | {新文件 / 影响哪些上游调用} |
| 3 | `server/src/routes/{routeFile}.ts` | 🆕 新增 / ✏️ 修改 | {简要描述变更内容} | {新文件 / 影响哪些端点} |
| 4 | `server/src/index.ts` | ✏️ 修改 | {注册新路由等} | {N 行变更} |
| ... | ... | ... | ... | ... |

**操作图例**：🆕 新增文件 · ✏️ 修改现有文件 · 🗑️ 删除文件 · 📎 复用（无变更）

---

## 三、数据模型设计

### 3.1 {ModelName}（新增/修改现有）

> 来源：PRD 功能模块 {N}
> 文件：server/src/models/{ModelName}.ts

**Schema 定义**：

| 字段 | 类型 | 必填 | 默认值 | 索引 | 校验 | 说明 |
|------|------|------|--------|------|------|------|
| {field} | {type} | ✅/否 | {default} | ✅/— | {rule} | {desc} |

**索引设计**：

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| {name} | { field: 1 } | 普通/复合/唯一/多键 | {说明} |

**关联关系**：
- {field} → {TargetModel}（N:1 / 1:N / N:N）

**数据迁移**（如修改现有 Model）：
- {迁移说明}

---

## 四、API 接口设计

### 4.1 {HTTP_METHOD} {路径}

> 来源：PRD 功能模块 {N}
> 状态：新增 / 修改现有
> 文件：server/src/routes/{routeFile}.ts
> 中间件：{middleware}

**请求参数**：

| 参数 | 位置 | 类型 | 必填 | 校验规则 | 说明 |
|------|------|------|------|---------|------|
| {param} | query/body/params | {type} | ✅/否 | {rule} | {desc} |

**请求 Body 类型**（POST/PUT）：

\`\`\`typescript
interface {RequestTypeName} {
  field: type;  // 说明
}
\`\`\`

**响应 Body**：

\`\`\`typescript
// 成功响应
interface {ResponseTypeName} {
  success: true;
  data: {
    field: type;  // 说明
  };
}

// 分页响应（如适用）
interface {PaginatedResponseTypeName} {
  success: true;
  data: {
    items: Array<{ItemType}>;
    total: number;
    page: number;
    limit: number;
  };
}
\`\`\`

**业务逻辑**：
1. {步骤 1}
2. {步骤 2}
3. {步骤 3}

**错误处理**：

| HTTP 状态码 | 条件 | 响应 body |
|------------|------|----------|
| 400 | {条件} | `{ success: false, error: '{message}' }` |
| 401 | 未认证 | `{ success: false, error: '请先登录' }` |
| 404 | {条件} | `{ success: false, error: '{message}' }` |

**调用链**：
Route → {ServiceName}.{method}() → {ModelName}.{dbOp}() → MongoDB

---

## 五、Service 设计

### 5.1 {serviceName}（新增/修改现有）

> 来源：PRD 功能模块 {N}
> 文件：server/src/services/{serviceName}.ts

**职责**：{一句话描述}

**依赖**：

| 依赖 | 类型 | 用途 |
|------|------|------|
| {dep} | Model/Service/外部库 | {用途} |

**导出函数**：

#### {functionName}(params): Promise<ReturnType>

**入参**：

| 参数 | 类型 | 说明 |
|------|------|------|
| {param} | {type} | {desc} |

**出参**：{ReturnType} — {说明}

**逻辑步骤**：
1. {步骤 1}
2. {步骤 2}

**错误处理**：

| 条件 | 处理 |
|------|------|
| {条件} | throw new Error('{message}') |

---

## 六、中间件/配置变更（如需要）

### 6.1 新增中间件

{如无则写"无"}

### 6.2 环境变量变更

| 变量 | 说明 | 默认值 | 必填 |
|------|------|--------|------|
| {VAR} | {说明} | {默认值} | ✅/否 |

### 6.3 路由注册变更

{在 server/src/index.ts 中的变更说明}

---

## 七、KB 参考

| 参考内容 | KB 文件 | 说明 |
|---------|---------|------|
| {参考了什么} | kb/server/server/... | {为什么参考} |

---

## 八、实施建议

### 实施顺序

1. {第一步：通常是 Model}
2. {第二步：通常是 Service}
3. {第三步：通常是 Route}
4. {第四步：测试}

### 测试要点

| 测试场景 | 预期结果 |
|---------|---------|
| {场景} | {预期} |
```
