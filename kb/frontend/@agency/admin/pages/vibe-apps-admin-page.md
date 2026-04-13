# VibeAppsAdminPage

**文件**: src\pages\VibeAppsAdminPage.tsx
**复杂度**: 复杂

## 功能概述

VibeAppsAdminPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| title | setTitle |  | app.title |
| description | setDesc |  | app.description |
| author | setAuthor |  | app.author |
| isActive | setIsActive |  | app.isActive |
| activeTab | setActiveTab | EditTab | 'info' |
| codeLoading | setCodeLoading |  | false |
| codeLoaded | setCodeLoaded |  | false |
| codeDetail | setCodeDetail | VibeAppCodeDetail | null | null |
| frontendSubTab | setFrontendSubTab | FrontendSubTab | 'jsx' |
| backendSubTab | setBackendSubTab | BackendSubTab | 'model' |
| dbCode | setDbCode |  | { collections: '', indexes: '', seedData: '' } |
| permSubTab | setPermSubTab | PermissionSubTab | 'menus' |
| saving | setSaving |  | false |
| error | setError |  | '' |
| copied | setCopied |  | false |
| apps | setApps | VibeAppAdmin[] | [] |
| loading | setLoading |  | false |
| search | setSearch |  | '' |
| searchInput | setSearchInput |  | '' |
| filterStatus | setFilterStatus |  | '' |
| page | setPage |  | 1 |
| total | setTotal |  | 0 |
| editTarget | setEditTarget | VibeAppAdmin | null | null |

## Hooks

| Hook |
|------|
| useState |
| useCallback |
| useEffect |
| useApp |
| uses |

## 事件处理函数

| 函数名 |
|--------|
| handleSave |
| handleKeyDown |
| handleCopy |
| handleEdit |
| handleDelete |
| handleToggleActive |
| handleSearch |
| handleSearchKeyDown |
| handleFilterStatus |
| handleSave |
| handleDelete |
| handleDeploy |
| handleUndeploy |
| handleToggleActive |

