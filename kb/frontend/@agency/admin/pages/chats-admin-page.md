# ChatsAdminPage

**文件**: src\pages\ChatsAdminPage.tsx
**复杂度**: 复杂

## 功能概述

ChatsAdminPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| chats | setChats | ChatItem[] | [] |
| loading | setLoading |  | true |
| total | setTotal |  | 0 |
| page | setPage |  | 1 |
| deleting | setDeleting |  | false |
| detailChat | setDetailChat | ChatItem | null | null |

## Hooks

| Hook |
|------|
| useState |
| useCallback |
| useEffect |

## 事件处理函数

| 函数名 |
|--------|
| handleDelete |
| handleBatchDelete |
| handleToggleSelect |
| handleSelectAll |

