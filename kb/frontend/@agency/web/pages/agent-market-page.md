# AgentMarketPage

**文件**: src\pages\AgentMarketPage.tsx
**复杂度**: 复杂

## 功能概述

AgentMarketPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| jsonText | setJsonText |  | '' |
| error | setError |  | '' |
| preview | setPreview | AgentExportFormat | null | null |
| marketAgents | setMarketAgents | AgentMarketItem[] | [] |
| myAgents | setMyAgents | Agent[] | [] |
| loading | setLoading |  | true |
| activeTab | setActiveTab | 'market' | 'my' | 'market' |
| searchText | setSearchText |  | '' |
| showImport | setShowImport |  | false |
| page | setPage |  | 1 |
| total | setTotal |  | 0 |

## Hooks

| Hook |
|------|
| useState |
| useLang |
| useNavigate |
| useCallback |
| useEffect |

## 事件处理函数

| 函数名 |
|--------|
| handleParse |
| handleFileUpload |
| handleExport |
| handleImport |
| handleShare |

