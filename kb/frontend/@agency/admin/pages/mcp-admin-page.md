# McpAdminPage

**文件**: src\pages\McpAdminPage.tsx
**复杂度**: 复杂

## 功能概述

McpAdminPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| argsJson | setArgsJson |  | '{}' |
| loading | setLoading |  | false |
| result | setResult | { success: boolean; data?: unknown; error?: string } | null | null |
| loading | setLoading |  | false |
| transportType | setTransportType | 'stdio' | 'sse' | 'sse' |
| servers | setServers | McpServerConfig[] | [] |
| loading | setLoading |  | true |
| formOpen | setFormOpen |  | false |
| editingServer | setEditingServer | McpServerConfig | null | null |
| testToolOpen | setTestToolOpen |  | false |
| testingTool | setTestingTool | McpTool | null | null |

## Hooks

| Hook |
|------|
| useState |
| useEffect |
| useForm |
| useCallback |

## 事件处理函数

| 函数名 |
|--------|
| handleExecute |
| handleSubmit |
| handleConnect |
| handleDisconnect |
| handleDelete |
| handleToggleActive |
| handleEdit |

