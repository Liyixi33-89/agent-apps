# TemplateMarketPage

**文件**: src\pages\TemplateMarketPage.tsx
**复杂度**: 复杂

## 功能概述

TemplateMarketPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| previewUrl | setPreviewUrl | string | null | null |
| isMobile | setIsMobile |  | false |
| templates | setTemplates | VibeTemplateItem[] | [] |
| loading | setLoading |  | false |
| activeCategory | setActiveCategory |  | 'all' |
| searchText | setSearchText |  | '' |
| previewItem | setPreviewItem | VibeTemplateDetail | null | null |
| previewLoading | setPreviewLoading |  | false |
| sortBy | setSortBy | SortKey | 'newest' |
| page | setPage |  | 1 |
| totalCount | setTotalCount |  | 0 |
| debouncedSearch | setDebouncedSearch |  | '' |

## Hooks

| Hook |
|------|
| useState |
| useEffect |
| useNavigate |
| useLang |
| useCallback |

## 事件处理函数

| 函数名 |
|--------|
| handleOpenExternal |
| handlePreview |
| handleUse |

