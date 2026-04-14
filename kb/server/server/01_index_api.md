# API 路由索引

## 路由挂载

| 路由文件 | 端点数 | 说明 |
|---------|--------|------|
| admin.ts | 36 | admin 相关 API |
| agentMarket.ts | 5 | agentMarket 相关 API |
| agentPlan.ts | 6 | agentPlan 相关 API |
| agents.ts | 7 | agents 相关 API |
| chat.ts | 7 | chat 相关 API |
| compile.ts | 1 | compile 相关 API |
| extensions.ts | 31 | extensions 相关 API |
| knowledge.ts | 5 | knowledge 相关 API |
| knowledgeGraph.ts | 2 | knowledgeGraph 相关 API |
| market.ts | 5 | market 相关 API |
| mcp.ts | 12 | mcp 相关 API |
| oauth.ts | 7 | oauth 相关 API |
| skill.ts | 12 | skill 相关 API |
| upload.ts | 3 | upload 相关 API |
| vibe.ts | 2 | vibe 相关 API |
| vibeAppRuntime.ts | 10 | vibeAppRuntime 相关 API |
| vibeFullStackPipeline.ts | 3 | vibeFullStackPipeline 相关 API |
| vibePipeline.ts | 1 | vibePipeline 相关 API |
| favorite.ts | 4 | 收藏相关 API（v1.2.0 新增） |
| review.ts | 4 | 评价相关 API（v1.3.0 新增） |

## 全量 API 列表

| # | 方法 | 路径 | 中间件 | 路由文件 |
|---|------|------|--------|---------|
| 1 | POST | /login | — | admin.ts |
| 2 | GET | /dashboard | requireAdmin | admin.ts |
| 3 | GET | /agents | requireAdmin | admin.ts |
| 4 | PUT | /agents/:id | requireAdmin | admin.ts |
| 5 | DELETE | /agents/:id | requireAdmin | admin.ts |
| 6 | POST | /agents/upload-md | requireAdmin | admin.ts |
| 7 | GET | /knowledge | requireAdmin | admin.ts |
| 8 | POST | /knowledge | requireAdmin | admin.ts |
| 9 | DELETE | /knowledge/:id | requireAdmin | admin.ts |
| 10 | POST | /knowledge/:id/refresh-url | requireAdmin | admin.ts |
| 11 | POST | /knowledge/refresh-all-urls | requireAdmin | admin.ts |
| 12 | POST | /ingest | requireAdmin | admin.ts |
| 13 | GET | /ingest/translate-status | requireAdmin | admin.ts |
| 14 | POST | /ingest/translate | requireAdmin | admin.ts |
| 15 | POST | /ingest/knowledge | requireAdmin | admin.ts |
| 16 | GET | /pipelines | requireAdmin | admin.ts |
| 17 | POST | /pipelines | requireAdmin | admin.ts |
| 18 | PUT | /pipelines/:id | requireAdmin | admin.ts |
| 19 | DELETE | /pipelines/:id | requireAdmin | admin.ts |
| 20 | GET | /settings | requireAdmin | admin.ts |
| 21 | GET | /chats | requireAdmin | admin.ts |
| 22 | DELETE | /chats/:id | requireAdmin | admin.ts |
| 23 | POST | /prompts/seed | requireAdmin | admin.ts |
| 24 | GET | /prompts | requireAdmin | admin.ts |
| 25 | GET | /prompts/:key | requireAdmin | admin.ts |
| 26 | POST | /prompts | requireAdmin | admin.ts |
| 27 | PUT | /prompts/:key | requireAdmin | admin.ts |
| 28 | DELETE | /prompts/:key | requireAdmin | admin.ts |
| 29 | GET | /vibe-templates | requireAdmin | admin.ts |
| 30 | POST | /vibe-templates | requireAdmin | admin.ts |
| 31 | PUT | /vibe-templates/:id | requireAdmin | admin.ts |
| 32 | DELETE | /vibe-templates/:id | requireAdmin | admin.ts |
| 33 | GET | /vibe-apps | requireAdmin | admin.ts |
| 34 | GET | /vibe-apps/:id/code | requireAdmin | admin.ts |
| 35 | PUT | /vibe-apps/:id | requireAdmin | admin.ts |
| 36 | DELETE | /vibe-apps/:id | requireAdmin | admin.ts |
| 37 | GET | / | — | agentMarket.ts |
| 38 | GET | /:slug/export | — | agentMarket.ts |
| 39 | POST | /import | — | agentMarket.ts |
| 40 | POST | /:slug/share | — | agentMarket.ts |
| 41 | DELETE | /:slug/share | — | agentMarket.ts |
| 42 | POST | /agent/analyze | — | agentPlan.ts |
| 43 | POST | /agent/plan | — | agentPlan.ts |
| 44 | POST | /agent/execute | — | agentPlan.ts |
| 45 | POST | /agent/tool | — | agentPlan.ts |
| 46 | GET | /agent/tools | — | agentPlan.ts |
| 47 | POST | /agent/react | — | agentPlan.ts |
| 48 | GET | /health | — | agents.ts |
| 49 | GET | /overview | — | agents.ts |
| 50 | GET | /agents | — | agents.ts |
| 51 | GET | /agents/:slug | — | agents.ts |
| 52 | GET | /categories | — | agents.ts |
| 53 | GET | /pipelines | — | agents.ts |
| 54 | POST | /ingest | — | agents.ts |
| 55 | POST | /chat/session | — | chat.ts |
| 56 | GET | /chat/sessions | — | chat.ts |
| 57 | GET | /chat/session/:sessionId | — | chat.ts |
| 58 | POST | /chat/stream | — | chat.ts |
| 59 | POST | /chat/message | — | chat.ts |
| 60 | DELETE | /chat/session/:sessionId | — | chat.ts |
| 61 | PATCH | /chat/session/:sessionId | — | chat.ts |
| 62 | POST | / | — | compile.ts |
| 63 | GET | /providers | — | extensions.ts |
| 64 | GET | /token-usage/today | — | extensions.ts |
| 65 | GET | /token-usage/stats | — | extensions.ts |
| 66 | GET | /token-usage/history | — | extensions.ts |
| 67 | GET | /admin/roles | requireAdmin | extensions.ts |
| 68 | POST | /admin/roles | requireAdmin | extensions.ts |
| 69 | PUT | /admin/roles/:key | requireAdmin | extensions.ts |
| 70 | DELETE | /admin/roles/:key | requireAdmin | extensions.ts |
| 71 | POST | /admin/roles/seed | requireAdmin | extensions.ts |
| 72 | GET | /admin/users | requireAdmin | extensions.ts |
| 73 | PUT | /admin/users/:id/role | requireAdmin | extensions.ts |
| 74 | PUT | /admin/users/:id/quota | requireAdmin | extensions.ts |
| 75 | POST | /knowledge/semantic-search | — | extensions.ts |
| 76 | POST | /knowledge/hybrid-search | — | extensions.ts |
| 77 | POST | /admin/knowledge/:id/build-embeddings | requireAdmin | extensions.ts |
| 78 | POST | /admin/knowledge/build-all-embeddings | requireAdmin | extensions.ts |
| 79 | POST | /memory | — | extensions.ts |
| 80 | GET | /memory | — | extensions.ts |
| 81 | POST | /memory/search | — | extensions.ts |
| 82 | DELETE | /memory/:memoryId | — | extensions.ts |
| 83 | POST | /memory/consolidate | — | extensions.ts |
| 84 | POST | /memory/context | — | extensions.ts |
| 85 | POST | /multi-agent/execute | — | extensions.ts |
| 86 | GET | /multi-agent/agents | — | extensions.ts |
| 87 | GET | /mcp/templates | — | extensions.ts |
| 88 | GET | /mcp/templates/:key | — | extensions.ts |
| 89 | POST | /mcp/templates/:key/install | — | extensions.ts |
| 90 | GET | /extensions/status | — | extensions.ts |
| 91 | POST | /evaluations | — | extensions.ts |
| 92 | POST | /evaluations/auto | — | extensions.ts |
| 93 | GET | /evaluations/:agentSlug/stats | — | extensions.ts |
| 94 | GET | /knowledge | — | knowledge.ts |
| 95 | GET | /knowledge/:id | — | knowledge.ts |
| 96 | POST | /knowledge/search | — | knowledge.ts |
| 97 | POST | /knowledge/rag | — | knowledge.ts |
| 98 | POST | /knowledge/rag/stream | — | knowledge.ts |
| 99 | GET | / | — | knowledgeGraph.ts |
| 100 | GET | /agent/:slug | — | knowledgeGraph.ts |
| 101 | GET | /vibe/templates | — | market.ts |
| 102 | GET | /vibe/templates/:id | — | market.ts |
| 103 | POST | /vibe/apps | — | market.ts |
| 104 | GET | /vibe/apps/:id | — | market.ts |
| 105 | POST | /vibe/templates | — | market.ts |
| 106 | GET | /servers | — | mcp.ts |
| 107 | POST | /servers | — | mcp.ts |
| 108 | PUT | /servers/:key | — | mcp.ts |
| 109 | DELETE | /servers/:key | — | mcp.ts |
| 110 | POST | /servers/:key/connect | — | mcp.ts |
| 111 | POST | /servers/:key/disconnect | — | mcp.ts |
| 112 | GET | /tools | — | mcp.ts |
| 113 | POST | /tools/call | — | mcp.ts |
| 114 | GET | /servers/:key/resources | — | mcp.ts |
| 115 | POST | /servers/:key/resources/read | — | mcp.ts |
| 116 | GET | /servers/:key/prompts | — | mcp.ts |
| 117 | POST | /servers/:key/prompts/get | — | mcp.ts |
| 118 | GET | /providers | — | oauth.ts |
| 119 | GET | /github | — | oauth.ts |
| 120 | GET | /github/callback | — | oauth.ts |
| 121 | GET | /google | — | oauth.ts |
| 122 | GET | /google/callback | — | oauth.ts |
| 123 | GET | /wechat | — | oauth.ts |
| 124 | GET | /wechat/callback | — | oauth.ts |
| 125 | GET | /skills | — | skill.ts |
| 126 | GET | /skills/overview/stats | — | skill.ts |
| 127 | GET | /skills/:key | — | skill.ts |
| 128 | POST | /skills | — | skill.ts |
| 129 | PUT | /skills/:key | — | skill.ts |
| 130 | DELETE | /skills/:key | — | skill.ts |
| 131 | POST | /skills/:key/execute | — | skill.ts |
| 132 | POST | /skills/:key/toggle | — | skill.ts |
| 133 | GET | /skills/:key/executions | — | skill.ts |
| 134 | GET | /skills/:key/stats | — | skill.ts |
| 135 | POST | /skills/:key/rollback | — | skill.ts |
| 136 | POST | /skills/match | — | skill.ts |
| 137 | POST | /upload/image | — | upload.ts |
| 138 | POST | /upload/document | — | upload.ts |
| 139 | POST | /upload/document-to-knowledge | — | upload.ts |
| 140 | POST | /vibe/generate | — | vibe.ts |
| 141 | POST | /vibe/stream | — | vibe.ts |
| 142 | POST | /vibe-runtime/:appId/deploy | — | vibeAppRuntime.ts |
| 143 | DELETE | /vibe-runtime/:appId/deploy | — | vibeAppRuntime.ts |
| 144 | GET | /vibe-runtime/:appId/status | — | vibeAppRuntime.ts |
| 145 | GET | /vibe-runtime/:appId/collections | — | vibeAppRuntime.ts |
| 146 | GET | /vibe-runtime/apps | — | vibeAppRuntime.ts |
| 147 | GET | /vibe-runtime/:appId/:collection | — | vibeAppRuntime.ts |
| 148 | GET | /vibe-runtime/:appId/:collection/:id | — | vibeAppRuntime.ts |
| 149 | POST | /vibe-runtime/:appId/:collection | — | vibeAppRuntime.ts |
| 150 | PUT | /vibe-runtime/:appId/:collection/:id | — | vibeAppRuntime.ts |
| 151 | DELETE | /vibe-runtime/:appId/:collection/:id | — | vibeAppRuntime.ts |
| 152 | GET | /xxx | — | vibeFullStackPipeline.ts |
| 153 | POST | /xxx | — | vibeFullStackPipeline.ts |
| 154 | POST | /vibe/fullstack-pipeline | — | vibeFullStackPipeline.ts |
| 155 | POST | /vibe/pipeline | — | vibePipeline.ts |
| 156 | POST | /favorites | requireAuth | favorite.ts |
| 157 | DELETE | /favorites/:agentId | requireAuth | favorite.ts |
| 158 | GET | /favorites | requireAuth | favorite.ts |
| 159 | GET | /favorites/check | requireAuth | favorite.ts |
| 160 | GET | /agents/:slug/reviews | — | review.ts |
| 161 | POST | /agents/:slug/reviews | requireAuth | review.ts |
| 162 | GET | /agents/:slug/reviews/mine | requireAuth | review.ts |
| 163 | DELETE | /agents/:slug/reviews | requireAuth | review.ts |
