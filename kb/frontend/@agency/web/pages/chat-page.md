# ChatPage

**文件**: src\pages\ChatPage.tsx
**复杂度**: 复杂

## 功能概述

ChatPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| sessions | setSessions | ChatSession[] | [] |
| currentSession | setCurrentSession | ChatSession | null | null |
| messages | setMessages | ChatMessage[] | [] |
| input | setInput |  | '' |
| streaming | setStreaming |  | false |
| streamingContent | setStreamingContent |  | '' |
| activeSkill | setActiveSkill | { name: string; key: string; confidence: number; method: string } | null | null |
| agents | setAgents | Agent[] | [] |
| selectedAgent | setSelectedAgent |  | searchParams.get('agent' |
| provider | setProvider | Provider | activeProvider |
| modelType | setModelType | ModelType | 'text' |
| mobileDrawerOpen | setMobileDrawerOpen |  | false |
| editingSessionId | setEditingSessionId | string | null | null |
| editingTitle | setEditingTitle |  | '' |

## Hooks

| Hook |
|------|
| useSearchParams |
| useNavigate |
| useAppStoreShallow |
| useState |
| useRef |
| useMemo |
| useEffect |
| useCallback |

## 事件处理函数

| 函数名 |
|--------|
| handleNewSession |
| handleDeleteSession |
| handleStartRename |
| handleConfirmRename |
| handleCancelRename |
| handleCopyMessage |
| handleStopGeneration |
| handleSend |

