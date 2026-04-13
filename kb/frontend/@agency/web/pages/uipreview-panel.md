# UIPreviewPanel

**文件**: src\pages\vibe-coding\UIPreviewPanel.tsx
**复杂度**: 复杂

## 功能概述

UIPreviewPanel 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| activeTab | setActiveTab | PreviewTab | 'preview' |
| activeCodeTab | setActiveCodeTab | CodeTab | 'html' |
| copied | setCopied |  | false |
| isFullscreen | setIsFullscreen |  | false |
| iframeError | setIframeError | string | null | null |
| iframeLoading | setIframeLoading |  | false |
| isMobile | setIsMobile |  | false |
| selectMode | setSelectMode |  | false |
| selectedEl | setSelectedEl | SelectedElementInfo | null | null |
| historyIframeLoading | setHistoryIframeLoading |  | false |
| localParts | setLocalParts | CodeParts | { html: '', css: '', js: '' } |

## Hooks

| Hook |
|------|
| useState |
| useEffect |
| useCallback |

## 事件处理函数

| 函数名 |
|--------|
| handleToggleReactMode |
| handleToggleSelectMode |
| handleMessage |
| handleRun |
| handleRefresh |
| handleCopy |
| handleDownload |
| handleOpenExternal |
| handleCodeChange |
| handleImageFileChange |

