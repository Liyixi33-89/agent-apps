# PipelinesPage

**文件**: src\pages\PipelinesPage.tsx
**复杂度**: 复杂

## 功能概述

PipelinesPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| pipelines | setPipelines | Pipeline[] | [] |
| loading | setLoading |  | true |
| searchText | setSearchText |  | '' |
| modelFilter | setModelFilter | 'all' | 'text' | 'vision' | 'all' |
| activeTab | setActiveTab | 'scenarios' | 'pipelines' | 'scenarios' |
| selectedScenario | setSelectedScenario | ScenarioTemplate | null | null |
| customPrompt | setCustomPrompt |  | '' |

## Hooks

| Hook |
|------|
| useLang |
| useNavigate |
| useState |
| useEffect |
| useMemo |

## 事件处理函数

| 函数名 |
|--------|
| handleRunScenario |
| handleRunCustom |

