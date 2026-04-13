# KnowledgeGraphPage

**文件**: src\pages\KnowledgeGraphPage.tsx
**复杂度**: 复杂

## 功能概述

KnowledgeGraphPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| graphData | setGraphData | KnowledgeGraphData | null | null |
| loading | setLoading |  | true |
| selectedNode | setSelectedNode | string | null | null |
| hoveredNode | setHoveredNode | string | null | null |
| typeFilter | setTypeFilter | string | 'all' |
| searchText | setSearchText |  | '' |

## Hooks

| Hook |
|------|
| useLoadGraph |
| useRegisterEvents |
| useSigma |
| useSetSettings |
| useEffect |
| useLang |
| useState |
| useCallback |
| useMemo |

## 事件处理函数

| 函数名 |
|--------|
| handleDownNode |
| handleMoveBody |
| handleUp |

