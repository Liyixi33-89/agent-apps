# 配置与中间件索引

## 中间件

| # | 中间件名 | 文件 | 说明 |
|---|---------|------|------|
| 1 | requireAuth | middleware/auth.ts | — |
| 2 | requirePermission | middleware/auth.ts | — |
| 3 | requireAdmin | middleware/auth.ts | — |
| 4 | tenantIsolation | middleware/auth.ts | — |
| 5 | rateLimit | middleware/auth.ts | — |
| 6 | checkTokenQuota | middleware/auth.ts | — |

## 配置文件

| # | 文件 | 导出 | 说明 |
|---|------|------|------|
| 1 | config/defaultPrompts.ts | DEFAULT_PROMPTS, CATEGORY_LABELS, App | — |
| 2 | config/env.ts | env, isProduction | — |
| 3 | config/mcpTemplates.ts | MCP_TEMPLATES, getTemplatesByCategory, getTemplateCategories | — |

## 数据库

| # | 文件 | 说明 |
|---|------|------|
| 1 | db/mongo.ts | MongoDB 连接管理 |

