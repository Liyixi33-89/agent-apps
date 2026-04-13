# EvaluationAdminPage

**文件**: src\pages\EvaluationAdminPage.tsx
**复杂度**: 复杂

## 功能概述

EvaluationAdminPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| agentA | setAgentA |  | '' |
| agentB | setAgentB |  | '' |
| testPrompt | setTestPrompt |  | '' |
| comparing | setComparing |  | false |
| results | setResults | CompareResult[] | [] |
| agents | setAgents | AgentOption[] | [] |
| selectedAgent | setSelectedAgent |  | '' |
| stats | setStats | EvalStats | null | null |
| loading | setLoading |  | false |
| agentsLoading | setAgentsLoading |  | true |
| activeTab | setActiveTab | 'stats' | 'compare' | 'stats' |

## Hooks

| Hook |
|------|
| useState |
| useCallback |
| useEffect |

## 事件处理函数

| 函数名 |
|--------|
| handleCompare |

