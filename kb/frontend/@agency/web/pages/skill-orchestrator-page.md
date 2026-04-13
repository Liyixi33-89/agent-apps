# SkillOrchestratorPage

**文件**: src\pages\SkillOrchestratorPage.tsx
**复杂度**: 复杂

## 功能概述

SkillOrchestratorPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| expanded | setExpanded |  | false |
| executing | setExecuting |  | false |
| result | setResult | SkillExecutionResult | null | null |
| error | setError |  | '' |
| showHistory | setShowHistory |  | false |
| historyLoading | setHistoryLoading |  | false |
| steps | setSteps | SkillStep[] | [] |
| skillName | setSkillName |  | '' |
| skillDescription | setSkillDescription |  | '' |
| message | setMessage |  | '' |
| loading | setLoading |  | false |
| result | setResult | {
    matched: boolean; skillKey?: string; skillName?: string;
    confidence?: number; method?: string; matchedTrigger?: string;
  } | null | null |
| skills | setSkills | Skill[] | [] |
| loading | setLoading |  | true |
| searchText | setSearchText |  | '' |
| categoryFilter | setCategoryFilter |  | 'all' |
| trySkill | setTrySkill | Skill | null | null |
| activeTab | setActiveTab | TabKey | 'gallery' |
| debouncedSearch | setDebouncedSearch |  | '' |

## Hooks

| Hook |
|------|
| useState |
| useEffect |
| useLang |
| useCallback |

## 事件处理函数

| 函数名 |
|--------|
| handleExecute |
| handleLoadHistory |
| handleExportJSON |
| handleTest |
| handleKeyDown |
| handleTrySkill |

