# @agency/web — 前端项目全景

**技术栈**: React + TypeScript + Antd + TailwindCSS + Zustand
**路径**: c:\Users\v_liyixili\Desktop\new2026\agency-agents\apps\web

## 目录结构

```
src/
├── App.tsx           # 根组件 + 路由
├── api/              # API 请求封装
├── components/       # 公共组件
├── pages/            # 页面组件
├── store/            # Zustand 状态管理
└── types/            # TypeScript 类型定义
```

## 路由表

| 路径 | 组件 |
|------|------|
| / | HomePage |
| /agents | AgentsPage |
| /agents/:slug | AgentDetailPage |
| /vibe | VibeCodingPage |
| /market | TemplateMarketPage |
| /chat | ChatPage |
| /chat/:sessionId | ChatPage |
| /knowledge | KnowledgePage |
| /pipelines | PipelinesPage |
| /plan | AgentPlanPage |
| /multi-agent | MultiAgentPage |
| /memory | MemoryPage |
| /skills | SkillOrchestratorPage |
| /knowledge-graph | KnowledgeGraphPage |
| /agent-market | AgentMarketPage |
| /oauth/callback | OAuthCallbackPage |
| * | NotFoundPage |
| /preview/:id | PreviewPage |
| /* | MainRoutes |

## 统计

- 页面: 33 个
- 组件: 4 个
- API 文件: 1 个
- Store 文件: 1 个
- Types 文件: 1 个
- Hooks: 5 个
