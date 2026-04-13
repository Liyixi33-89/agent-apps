# SkillsAdminPage

**文件**: src\pages\SkillsAdminPage.tsx
**复杂度**: 复杂

## 功能概述

SkillsAdminPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| tools | setTools | ToolItem[] | [] |
| loading | setLoading |  | false |
| search | setSearch |  | '' |
| sourceFilter | setSourceFilter | 'all' | 'builtin' | 'mcp' | 'all' |
| testVisible | setTestVisible |  | false |
| testTool | setTestTool | ToolItem | null | null |
| testArgs | setTestArgs |  | '{}' |
| testResult | setTestResult | any | null |
| testLoading | setTestLoading |  | false |
| activeMainTab | setActiveMainTab | 'skills' | 'tools' | 'skills' |
| skills | setSkills | Skill[] | [] |
| loading | setLoading |  | false |
| total | setTotal |  | 0 |
| page | setPage |  | 1 |
| search | setSearch |  | '' |
| category | setCategory | string | '' |
| overviewStats | setOverviewStats | SkillOverviewStats | null | null |
| detailSkill | setDetailSkill | Skill | null | null |
| detailVisible | setDetailVisible |  | false |
| detailTab | setDetailTab |  | 'steps' |
| skillStats | setSkillStats | SkillStats | null | null |
| executions | setExecutions | any[] | [] |
| testVisible | setTestVisible |  | false |
| testSkillKey | setTestSkillKey |  | '' |
| testInput | setTestInput |  | '{}' |
| testResult | setTestResult | any | null |
| testLoading | setTestLoading |  | false |
| matchVisible | setMatchVisible |  | false |
| matchMessage | setMatchMessage |  | '' |
| matchResult | setMatchResult | any | null |
| matchLoading | setMatchLoading |  | false |
| editVisible | setEditVisible |  | false |
| editSkill | setEditSkill | Skill | null | null |
| editLoading | setEditLoading |  | false |

## Hooks

| Hook |
|------|
| useState |
| useCallback |
| useEffect |
| useForm |

## 事件处理函数

| 函数名 |
|--------|
| handleTest |
| handleToggle |
| handleViewDetail |
| handleTest |
| handleMatchTest |
| handleOpenCreate |
| handleOpenEdit |
| handleSaveSkill |
| handleDelete |
| handleRollback |

