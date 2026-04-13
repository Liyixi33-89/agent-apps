# 技术问答回答模板

## 回答

{结构化的回答内容}

{根据问题类型选择合适的展示方式：}

### API 相关回答格式

| 方法 | 路径 | 中间件 | 说明 |
|------|------|--------|------|
| GET | /api/xxx | requireAuth | 获取列表 |

**请求参数**：

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | params | string | ✅ | 资源 ID |

**响应结构**：

```json
{
  "success": true,
  "data": { ... }
}
```

### Model 相关回答格式

**{ModelName}**

| 字段 | 类型 | 必填 | 唯一 | 关联 | 说明 |
|------|------|------|------|------|------|
| name | String | ✅ | — | — | 名称 |

**关联关系**：
- `fieldName` → `TargetModel`（N:1）

### Service 相关回答格式

**{ServiceName}**

| 函数 | 入参 | 出参 | 说明 |
|------|------|------|------|
| fn1 | (param: Type) | ReturnType | 功能说明 |

**调用链**：
```
Route.handler() → Service.fn() → Model.find() → MongoDB
```

### 页面相关回答格式

**{PageName}**

| 路由 | 状态数 | API 调用 | 说明 |
|------|--------|---------|------|
| /path | 5 | api.getList, api.create | 功能说明 |

**核心交互流程**：
1. 页面加载 → 调用 api.getList
2. 用户操作 → 调用 api.create
3. ...

### 跨模块问题回答格式

**调用链路**：
```
[前端] Page → api.fn() 
  → [HTTP] POST /api/xxx 
    → [后端] Route → Service.fn() → Model.find() 
      → [DB] MongoDB
```

---

## 信息来源

| 来源 | 文件 | 说明 |
|------|------|------|
| KB 索引 | kb/server/server/0N_index_xxx.md | {查找了什么} |
| KB 详情 | kb/server/server/api/xxx.md | {查找了什么} |
| 源码 | server/src/xxx.ts | （仅在 KB 不足时标注） |
