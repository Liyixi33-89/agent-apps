# Zustand Store 索引

## index.ts

**文件**: src\store\index.ts

**导出**:

| 导出名 |
|--------|
| useAppStore |
| useLang |
| useSetLang |
| useActiveProvider |
| useSetActiveProvider |
| useAppStoreShallow |

**接口 `AppState`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| lang | Lang | — |
| setLang | (lang: Lang) => void | — |
| activeProvider | Provider | — |
| setActiveProvider | (provider: Provider) => void | — |
| overview | { stats: OverviewStats | — |
| categories | Category[] | — |
| featuredAgents | Agent[] } | null | — |
| setOverview | (data: AppState['overview']) => void | — |
| agents | Agent[] | — |
| setAgents | (agents: Agent[]) => void | — |
| selectedAgent | Agent | null | — |
| setSelectedAgent | (agent: Agent | null) => void | — |
| categories | Category[] | — |
| setCategories | (categories: Category[]) => void | — |
| selectedCategory | string | — |
| setSelectedCategory | (key: string) => void | — |
| pipelines | Pipeline[] | — |
| setPipelines | (pipelines: Pipeline[]) => void | — |
| chatSessions | ChatSession[] | — |
| setChatSessions | (sessions: ChatSession[]) => void | — |
| currentSession | ChatSession | null | — |
| setCurrentSession | (session: ChatSession | null) => void | — |
| searchQuery | string | — |
| setSearchQuery | (query: string) => void | — |
| modelType | ModelType | — |
| setModelType | (type: ModelType) => void | — |

