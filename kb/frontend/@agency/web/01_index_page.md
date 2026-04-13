# 页面索引

## 路由表

| # | 路由路径 | 页面组件 |
|---|---------|---------|
| 1 | / | HomePage |
| 2 | /agents | AgentsPage |
| 3 | /agents/:slug | AgentDetailPage |
| 4 | /vibe | VibeCodingPage |
| 5 | /market | TemplateMarketPage |
| 6 | /chat | ChatPage |
| 7 | /chat/:sessionId | ChatPage |
| 8 | /knowledge | KnowledgePage |
| 9 | /pipelines | PipelinesPage |
| 10 | /plan | AgentPlanPage |
| 11 | /multi-agent | MultiAgentPage |
| 12 | /memory | MemoryPage |
| 13 | /skills | SkillOrchestratorPage |
| 14 | /knowledge-graph | KnowledgeGraphPage |
| 15 | /agent-market | AgentMarketPage |
| 16 | /oauth/callback | OAuthCallbackPage |
| 17 | * | NotFoundPage |
| 18 | /preview/:id | PreviewPage |
| 19 | /* | MainRoutes |

## 页面功能摘要

| # | 页面 | 文件 | useState 数 | API 调用 | 事件处理 |
|---|------|------|------------|---------|---------|
| 1 | AgentDetailPage | src\pages\AgentDetailPage.tsx | 3 | — | 1 |
| 2 | AgentMarketPage | src\pages\AgentMarketPage.tsx | 11 | — | 5 |
| 3 | AgentPlanPage | src\pages\AgentPlanPage.tsx | 20 | — | 5 |
| 4 | AgentsPage | src\pages\AgentsPage.tsx | 5 | — | 3 |
| 5 | ChatPage | src\pages\ChatPage.tsx | 14 | — | 8 |
| 6 | HomePage | src\pages\HomePage.tsx | 3 | — | 1 |
| 7 | KnowledgeGraphPage | src\pages\KnowledgeGraphPage.tsx | 6 | — | 3 |
| 8 | KnowledgePage | src\pages\KnowledgePage.tsx | 11 | — | 6 |
| 9 | MemoryPage | src\pages\MemoryPage.tsx | 11 | — | 4 |
| 10 | MultiAgentPage | src\pages\MultiAgentPage.tsx | 8 | — | 2 |
| 11 | OAuthCallbackPage | src\pages\OAuthCallbackPage.tsx | 1 | — | 0 |
| 12 | PipelinesPage | src\pages\PipelinesPage.tsx | 7 | — | 2 |
| 13 | PreviewPage | src\pages\PreviewPage.tsx | 4 | — | 0 |
| 14 | ProviderMonitorPage | src\pages\ProviderMonitorPage.tsx | 6 | — | 2 |
| 15 | SkillOrchestratorPage | src\pages\SkillOrchestratorPage.tsx | 19 | — | 6 |
| 16 | TemplateMarketPage | src\pages\TemplateMarketPage.tsx | 12 | — | 3 |
| 17 | ToolsPage | src\pages\ToolsPage.tsx | 7 | — | 3 |
| 18 | VibeCodingPage | src\pages\VibeCodingPage.tsx | 0 | — | 1 |
| 19 | ChatSidebar | src\pages\vibe-coding\ChatSidebar.tsx | 0 | — | 1 |
| 20 | HistoryPanel | src\pages\vibe-coding\HistoryPanel.tsx | 6 | — | 2 |
| 21 | MessageBubble | src\pages\vibe-coding\MessageBubble.tsx | 0 | — | 0 |
| 22 | MultiFileEditor | src\pages\vibe-coding\MultiFileEditor.tsx | 4 | — | 4 |
| 23 | PromptCategoryList | src\pages\vibe-coding\PromptCategoryList.tsx | 2 | — | 2 |
| 24 | PublishModal | src\pages\vibe-coding\PublishModal.tsx | 11 | — | 5 |
| 25 | ReactPreview | src\pages\vibe-coding\ReactPreview.tsx | 2 | get, post | 0 |
| 26 | TemplateMarket | src\pages\vibe-coding\TemplateMarket.tsx | 7 | — | 3 |
| 27 | UIPreviewPanel | src\pages\vibe-coding\UIPreviewPanel.tsx | 11 | — | 10 |

