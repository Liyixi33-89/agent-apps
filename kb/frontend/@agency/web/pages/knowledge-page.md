# KnowledgePage

**文件**: src\pages\KnowledgePage.tsx
**复杂度**: 复杂

## 功能概述

KnowledgePage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| knowledge | setKnowledge | KnowledgeBase[] | [] |
| loading | setLoading |  | true |
| total | setTotal |  | 0 |
| page | setPage |  | 1 |
| searchQuery | setSearchQuery |  | '' |
| ragQuestion | setRagQuestion |  | '' |
| ragLoading | setRagLoading |  | false |
| ragHistory | setRagHistory | RagHistoryItem[] | [] |
| activeTab | setActiveTab |  | 'browse' |
| categories | setCategories | Category[] | [] |
| selectedCategory | setSelectedCategory | string | '' |

## Hooks

| Hook |
|------|
| useSearchParams |
| useAppStoreShallow |
| useState |
| useEffect |
| useCallback |

## 事件处理函数

| 函数名 |
|--------|
| handleSearch |
| handleRagQuery |
| handleClearRagHistory |
| handleCopyAnswer |
| handlePageChange |
| handleCategoryChange |

