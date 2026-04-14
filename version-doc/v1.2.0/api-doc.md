# API 文档 — v1.3.0 收藏功能

**Base URL**：`http://127.0.0.1:3000`

---

## Favorites API

### POST /api/favorites

收藏 Agent。

**认证**：Bearer Token（必须）

**请求体**：
```json
{
  "agentId": "507f1f77bcf86cd799439011"
}
```

**成功响应**（201）：
```json
{
  "success": true,
  "data": {
    "favoriteId": "507f1f77bcf86cd799439044",
    "agentId": "507f1f77bcf86cd799439011",
    "createdAt": "2026-04-14T11:30:00.000Z"
  }
}
```

**错误响应**：
| 状态码 | 说明 |
|--------|------|
| 400 | 缺少 agentId 参数 |
| 401 | 未授权 |
| 404 | Agent 不存在 |
| 409 | 已收藏该 Agent |

---

### DELETE /api/favorites/:agentId

取消收藏 Agent。

**认证**：Bearer Token（必须）

**路径参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| agentId | string | Agent ID |

**成功响应**（200）：
```json
{
  "success": true
}
```

**错误响应**：
| 状态码 | 说明 |
|--------|------|
| 401 | 未授权 |
| 404 | 未收藏该 Agent |

---

### GET /api/favorites

获取当前用户的收藏列表。

**认证**：Bearer Token（必须）

**查询参数**：
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | 1 | 页码 |
| limit | number | 20 | 每页数量（最大 50） |

**成功响应**（200）：
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "favoriteId": "507f1f77bcf86cd799439044",
        "agent": {
          "_id": "507f1f77bcf86cd799439011",
          "slug": "code-assistant",
          "name": { "zh": "代码助手", "en": "Code Assistant" },
          "description": { "zh": "...", "en": "..." },
          "emoji": "💻",
          "color": "blue",
          "tags": ["编程"],
          "favoriteCount": 42
        },
        "createdAt": "2026-04-14T11:30:00.000Z"
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20
  }
}
```

---

### GET /api/favorites/check

批量检查当前用户对指定 Agent 的收藏状态。

**认证**：Bearer Token（必须）

**查询参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| agentIds | string | 逗号分隔的 Agent ID 列表 |

**示例**：`GET /api/favorites/check?agentIds=id1,id2,id3`

**成功响应**（200）：
```json
{
  "success": true,
  "data": {
    "507f1f77bcf86cd799439011": true,
    "507f1f77bcf86cd799439022": false,
    "507f1f77bcf86cd799439033": false
  }
}
```
