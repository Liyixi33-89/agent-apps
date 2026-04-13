# admin 路由

**文件**: server/src/routes/admin.ts
**端点数**: 36

## API 列表

### POST /login

**中间件**: 无

### GET /dashboard

**中间件**: requireAdmin

### GET /agents

**中间件**: requireAdmin

### PUT /agents/:id

**中间件**: requireAdmin

### DELETE /agents/:id

**中间件**: requireAdmin

### POST /agents/upload-md

**中间件**: requireAdmin

### GET /knowledge

**中间件**: requireAdmin

### POST /knowledge

**中间件**: requireAdmin

### DELETE /knowledge/:id

**中间件**: requireAdmin

### POST /knowledge/:id/refresh-url

**中间件**: requireAdmin

### POST /knowledge/refresh-all-urls

**中间件**: requireAdmin

### POST /ingest

**中间件**: requireAdmin

### GET /ingest/translate-status

**中间件**: requireAdmin

### POST /ingest/translate

**中间件**: requireAdmin

### POST /ingest/knowledge

**中间件**: requireAdmin

### GET /pipelines

**中间件**: requireAdmin

### POST /pipelines

**中间件**: requireAdmin

### PUT /pipelines/:id

**中间件**: requireAdmin

### DELETE /pipelines/:id

**中间件**: requireAdmin

### GET /settings

**中间件**: requireAdmin

### GET /chats

**中间件**: requireAdmin

### DELETE /chats/:id

**中间件**: requireAdmin

### POST /prompts/seed

**中间件**: requireAdmin

### GET /prompts

**中间件**: requireAdmin

### GET /prompts/:key

**中间件**: requireAdmin

### POST /prompts

**中间件**: requireAdmin

### PUT /prompts/:key

**中间件**: requireAdmin

### DELETE /prompts/:key

**中间件**: requireAdmin

### GET /vibe-templates

**中间件**: requireAdmin

### POST /vibe-templates

**中间件**: requireAdmin

### PUT /vibe-templates/:id

**中间件**: requireAdmin

### DELETE /vibe-templates/:id

**中间件**: requireAdmin

### GET /vibe-apps

**中间件**: requireAdmin

### GET /vibe-apps/:id/code

**中间件**: requireAdmin

### PUT /vibe-apps/:id

**中间件**: requireAdmin

### DELETE /vibe-apps/:id

**中间件**: requireAdmin

