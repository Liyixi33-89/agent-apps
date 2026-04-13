# extensions 路由

**文件**: server/src/routes/extensions.ts
**端点数**: 31

## API 列表

### GET /providers

**中间件**: 无

### GET /token-usage/today

**中间件**: 无

### GET /token-usage/stats

**中间件**: 无

### GET /token-usage/history

**中间件**: 无

### GET /admin/roles

**中间件**: requireAdmin

### POST /admin/roles

**中间件**: requireAdmin

### PUT /admin/roles/:key

**中间件**: requireAdmin

### DELETE /admin/roles/:key

**中间件**: requireAdmin

### POST /admin/roles/seed

**中间件**: requireAdmin

### GET /admin/users

**中间件**: requireAdmin

### PUT /admin/users/:id/role

**中间件**: requireAdmin

### PUT /admin/users/:id/quota

**中间件**: requireAdmin

### POST /knowledge/semantic-search

**中间件**: 无

### POST /knowledge/hybrid-search

**中间件**: 无

### POST /admin/knowledge/:id/build-embeddings

**中间件**: requireAdmin

### POST /admin/knowledge/build-all-embeddings

**中间件**: requireAdmin

### POST /memory

**中间件**: 无

### GET /memory

**中间件**: 无

### POST /memory/search

**中间件**: 无

### DELETE /memory/:memoryId

**中间件**: 无

### POST /memory/consolidate

**中间件**: 无

### POST /memory/context

**中间件**: 无

### POST /multi-agent/execute

**中间件**: 无

### GET /multi-agent/agents

**中间件**: 无

### GET /mcp/templates

**中间件**: 无

### GET /mcp/templates/:key

**中间件**: 无

### POST /mcp/templates/:key/install

**中间件**: 无

### GET /extensions/status

**中间件**: 无

### POST /evaluations

**中间件**: 无

### POST /evaluations/auto

**中间件**: 无

### GET /evaluations/:agentSlug/stats

**中间件**: 无

