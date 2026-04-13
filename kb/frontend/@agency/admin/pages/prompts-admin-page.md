# PromptsAdminPage

**文件**: src\pages\PromptsAdminPage.tsx
**复杂度**: 复杂

## 功能概述

PromptsAdminPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| key | setKey |  | initial?.key ?? '' |
| category | setCategory | PromptCategory | initial?.category ?? 'vibe' |
| name | setName |  | initial?.name ?? '' |
| description | setDesc |  | initial?.description ?? '' |
| content | setContent |  | initial?.content ?? '' |
| isActive | setIsActive |  | initial?.isActive ?? true |
| sortOrder | setSortOrder |  | initial?.sortOrder ?? 0 |
| saving | setSaving |  | false |
| error | setError |  | '' |
| expanded | setExpanded |  | false |
| prompts | setPrompts | SystemPrompt[] | [] |
| loading | setLoading |  | false |
| filterCat | setFilterCat | 'all' | PromptCategory | 'all' |
| editTarget | setEditTarget | SystemPrompt | null | 'new' | null |
| seeding | setSeeding |  | false |
| seedMsg | setSeedMsg |  | '' |

## Hooks

| Hook |
|------|
| useState |
| useApp |
| useRef |
| useCallback |
| useEffect |

## 事件处理函数

| 函数名 |
|--------|
| handleSave |
| handleKeyDown |
| handleToggleExpand |
| handleEdit |
| handleDelete |
| handleSave |
| handleDelete |
| handleSeed |

