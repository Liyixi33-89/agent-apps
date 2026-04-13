# HistoryPanel

**文件**: src\pages\vibe-coding\HistoryPanel.tsx
**复杂度**: 复杂

## 功能概述

HistoryPanel 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| codeType | setCodeType | 'html' | 'css' | 'js' | 'jsx' | 'html' |
| confirmClear | setConfirmClear |  | false |
| hoveredId | setHoveredId | string | null | null |
| diffPair | setDiffPair | [VibeHistoryItem, VibeHistoryItem] | null | null |
| diffSelectMode | setDiffSelectMode |  | false |
| diffFirstItem | setDiffFirstItem | VibeHistoryItem | null | null |

## Hooks

| Hook |
|------|
| useMemo |
| useState |

## 事件处理函数

| 函数名 |
|--------|
| handleClear |
| handleDiffSelect |

