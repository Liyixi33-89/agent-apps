# ToolsPage

**文件**: src\pages\ToolsPage.tsx
**复杂度**: 复杂

## 功能概述

ToolsPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| testing | setTesting |  | false |
| result | setResult | { success: boolean; data?: unknown; error?: string } | null | null |
| tools | setTools | ToolDefinition[] | [] |
| loading | setLoading |  | true |
| search | setSearch |  | '' |
| testTool | setTestTool | ToolDefinition | null | null |
| drawerOpen | setDrawerOpen |  | false |

## Hooks

| Hook |
|------|
| useForm |
| useState |
| useEffect |
| useCallback |

## 事件处理函数

| 函数名 |
|--------|
| handleTest |
| handleTest |
| handleCloseDrawer |

