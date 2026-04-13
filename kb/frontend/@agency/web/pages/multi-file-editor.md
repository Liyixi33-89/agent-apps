# MultiFileEditor

**文件**: src\pages\vibe-coding\MultiFileEditor.tsx
**复杂度**: 复杂

## 功能概述

MultiFileEditor 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| activeFile | setActiveFile | string | project.entryFile || project.files[0]?.path || '' |
| openTabs | setOpenTabs | string[] | [project.entryFile || project.files[0]?.path || ''] |
| showNewFile | setShowNewFile |  | false |
| newFileName | setNewFileName |  | '' |

## Hooks

| Hook |
|------|
| useState |
| useCallback |

## 事件处理函数

| 函数名 |
|--------|
| handleSelectFile |
| handleCloseTab |
| handleToggleDir |
| handleAddFile |

