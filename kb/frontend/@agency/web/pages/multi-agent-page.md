# MultiAgentPage

**文件**: src\pages\MultiAgentPage.tsx
**复杂度**: 复杂

## 功能概述

MultiAgentPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| agents | setAgents | AgentOption[] | [] |
| agentsLoading | setAgentsLoading |  | true |
| selectedAgents | setSelectedAgents | string[] | [] |
| mode | setMode | CollaborationMode | 'sequential' |
| prompt | setPrompt |  | '' |
| running | setRunning |  | false |
| error | setError |  | '' |
| agentSearch | setAgentSearch |  | '' |

## Hooks

| Hook |
|------|
| useAppStoreShallow |
| useState |
| useEffect |
| useCallback |

## 事件处理函数

| 函数名 |
|--------|
| handleExecute |
| handleReset |

