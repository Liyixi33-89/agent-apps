# RbacAdminPage

**文件**: src\pages\RbacAdminPage.tsx
**复杂度**: 复杂

## 功能概述

RbacAdminPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| roles | setRoles | RoleConfig[] | [] |
| loading | setLoading |  | true |
| showCreate | setShowCreate |  | false |
| editingKey | setEditingKey | string | null | null |
| msg | setMsg |  | '' |
| form | setForm |  | { key: '', name: '', description: '', permissions: [{ resource: 'agents', actions: ['read'] }] } |
| users | setUsers | UserAdmin[] | [] |
| roles | setRoles | RoleConfig[] | [] |
| loading | setLoading |  | true |
| total | setTotal |  | 0 |
| page | setPage |  | 1 |
| search | setSearch |  | '' |
| editingQuota | setEditingQuota | { id: string; value: number } | null | null |
| activeTab | setActiveTab | TabKey | 'roles' |

## Hooks

| Hook |
|------|
| useState |
| useCallback |
| useEffect |

## 事件处理函数

| 函数名 |
|--------|
| handleSeed |
| handleCreate |
| handleDelete |
| handleUpdatePermission |
| handleRoleChange |
| handleQuotaSave |

