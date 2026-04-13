# 前端 API 封装索引规范

## 生成目标

- `03_index_api.md` — 前端 API 函数索引

## 分析流程

1. 扫描 `src/api/` 目录下所有 `.ts` 文件
2. 对每个 API 文件：
   - 读取文件内容，提取所有导出的 API 函数
   - 提取 HTTP 方法、请求路径
   - 提取请求参数类型和响应类型
   - 识别 axios 实例配置（baseURL、interceptors）
   - 关联到后端路由路径

## 索引文件格式（03_index_api.md）

```markdown
# 前端 API 封装索引

## Axios 配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| baseURL | /api | API 基础路径 |
| 请求拦截 | Authorization header | 自动附加 JWT token |
| 响应拦截 | 401 处理 | 自动跳转登录 |

## API 函数列表

| # | 函数名 | 方法 | 路径 | 参数 | 返回类型 | 说明 |
|---|--------|------|------|------|---------|------|
| 1 | getAgents | GET | /api/agents | — | Agent[] | 获取 Agent 列表 |
| 2 | createAgent | POST | /api/agents | AgentData | Agent | 创建 Agent |
| 3 | updateAgent | PUT | /api/agents/:id | AgentData | Agent | 更新 Agent |
| 4 | deleteAgent | DELETE | /api/agents/:id | — | void | 删除 Agent |

## 按模块分组

### Agent 相关

| 函数名 | 方法 | 路径 | 说明 |
|--------|------|------|------|
| getAgents | GET | /api/agents | 获取列表 |
| createAgent | POST | /api/agents | 创建 |
| updateAgent | PUT | /api/agents/:id | 更新 |
| deleteAgent | DELETE | /api/agents/:id | 删除 |

### Chat 相关

| 函数名 | 方法 | 路径 | 说明 |
|--------|------|------|------|
| getChats | GET | /api/chat | 获取会话列表 |
| sendMessage | POST | /api/chat/:id/message | 发送消息 |
```
