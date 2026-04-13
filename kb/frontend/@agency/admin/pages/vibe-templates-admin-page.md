# VibeTemplatesAdminPage

**文件**: src\pages\VibeTemplatesAdminPage.tsx
**复杂度**: 复杂

## 功能概述

VibeTemplatesAdminPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| title | setTitle |  | template.title |
| description | setDesc |  | template.description |
| category | setCategory |  | template.category |
| author | setAuthor |  | template.author |
| tagsInput | setTagsInput |  | template.tags.join(', ' |
| isActive | setIsActive |  | template.isActive |
| saving | setSaving |  | false |
| error | setError |  | '' |
| templates | setTemplates | VibeTemplateAdmin[] | [] |
| loading | setLoading |  | false |
| search | setSearch |  | '' |
| searchInput | setSearchInput |  | '' |
| filterCat | setFilterCat |  | '' |
| page | setPage |  | 1 |
| total | setTotal |  | 0 |
| editTarget | setEditTarget | VibeTemplateAdmin | null | null |

## Hooks

| Hook |
|------|
| useState |
| useApp |
| useCallback |
| useEffect |

## 事件处理函数

| 函数名 |
|--------|
| handleSave |
| handleKeyDown |
| handleEdit |
| handleDelete |
| handleToggleActive |
| handleSearch |
| handleSearchKeyDown |
| handleFilterCat |
| handleSave |
| handleDelete |
| handleToggleActive |

