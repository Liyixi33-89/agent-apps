# Koa 路由（API）索引规范

## 生成目标

- `01_index_api.md` — API 路由总览索引
- `api/{RouteName}.md` — 每个路由文件一个详情文件

## 分析流程

1. 扫描 `server/src/routes/` 目录下所有 `.ts` 文件
2. 对每个路由文件：
   - 读取文件内容，提取所有 `router.get/post/put/delete/patch` 调用
   - 提取路由路径、HTTP 方法、中间件（如 `requireAuth`、`requireAdmin`）
   - 提取请求参数（`ctx.params`、`ctx.query`、`ctx.request.body`）
   - 提取响应结构（`ctx.body = { ... }`）
   - 识别调用的 Service/Model
3. 检查 `server/src/index.ts` 中路由的挂载路径前缀

## 总览文件格式（01_index_api.md）

```markdown
# API 路由索引

## 路由挂载

| 路由文件 | 挂载前缀 | 说明 |
|---------|---------|------|
| agents.ts | /api/agents | Agent 管理 |
| chat.ts | /api/chat | 聊天对话 |

## 全量 API 列表

| # | 方法 | 路径 | 中间件 | 说明 | 路由文件 |
|---|------|------|--------|------|---------|
| 1 | GET | /api/agents | requireAuth | 获取 Agent 列表 | agents.ts |
| 2 | POST | /api/agents | requireAuth | 创建 Agent | agents.ts |
```

## 详情文件格式（api/{RouteName}.md）

```markdown
# {RouteName} 路由

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
| limit | query | number | 否 | 每页数量 |

**响应 Body**:

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 是否成功 |
| data | Array | 数据列表 |

**业务逻辑**:
1. 从 ctx.query 获取分页参数
2. 调用 Model.find() 查询数据库
3. 返回分页结果

**调用链**: Route → Model.find() → MongoDB
```
