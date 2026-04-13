# MemoryPage

**文件**: src\pages\MemoryPage.tsx
**复杂度**: 复杂

## 功能概述

MemoryPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| memories | setMemories | MemoryEntry[] | [] |
| loading | setLoading |  | false |
| selectedAgent | setSelectedAgent |  | '' |
| selectedType | setSelectedType | string | '' |
| searchQuery | setSearchQuery |  | '' |
| searching | setSearching |  | false |
| consolidating | setConsolidating |  | false |
| showAdd | setShowAdd |  | false |
| newContent | setNewContent |  | '' |
| newType | setNewType | 'session' | 'long_term' | 'working' | 'long_term' |
| adding | setAdding |  | false |

## Hooks

| Hook |
|------|
| useLang |
| useState |
| useEffect |
| useCallback |

## 事件处理函数

| 函数名 |
|--------|
| handleSearch |
| handleAdd |
| handleDelete |
| handleConsolidate |

