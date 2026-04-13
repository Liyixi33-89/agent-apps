# AgentsAdminPage

**文件**: src\pages\AgentsAdminPage.tsx
**复杂度**: 复杂

## 功能概述

AgentsAdminPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| agents | setAgents | Agent[] | [] |
| loading | setLoading |  | true |
| total | setTotal |  | 0 |
| page | setPage |  | 1 |
| search | setSearch |  | '' |
| deletingId | setDeletingId | string | null | null |
| uploading | setUploading |  | false |
| uploadResult | setUploadResult | UploadResult | null | null |
| uploadError | setUploadError | string | null | null |
| editAgent | setEditAgent | Agent | null | null |
| editModalOpen | setEditModalOpen |  | false |
| saving | setSaving |  | false |

## Hooks

| Hook |
|------|
| useApp |
| useState |
| useForm |
| useCallback |
| useEffect |

## 事件处理函数

| 函数名 |
|--------|
| handleOpenEdit |
| handleSaveEdit |
| handleDelete |
| handleUploadMd |

