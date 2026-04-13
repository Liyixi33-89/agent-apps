# TemplateMarket

**文件**: src\pages\vibe-coding\TemplateMarket.tsx
**复杂度**: 复杂

## 功能概述

TemplateMarket 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| templates | setTemplates | VibeTemplateItem[] | [] |
| loading | setLoading |  | false |
| activeCategory | setActiveCategory |  | 'all' |
| searchText | setSearchText |  | '' |
| previewItem | setPreviewItem | VibeTemplateDetail | null | null |
| previewUrl | setPreviewUrl | string | null | null |
| previewLoading | setPreviewLoading |  | false |

## Hooks

| Hook |
|------|
| useState |
| useCallback |
| useEffect |

## 事件处理函数

| 函数名 |
|--------|
| handleOpenPreview |
| handleOpenExternal |
| handleUseTemplate |

