# AgentPlanPage

**文件**: src\pages\AgentPlanPage.tsx
**复杂度**: 复杂

## 功能概述

AgentPlanPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| expanded | setExpanded |  | false |
| selected | setSelected | ToolDefinition | null | null |
| args | setArgs |  | '{}' |
| result | setResult | string | '' |
| loading | setLoading |  | false |
| prompt | setPrompt |  | '' |
| activeTab | setActiveTab | TabKey | 'plan' |
| plan | setPlan | ExecutionPlan | null | null |
| steps | setSteps | PlanStep[] | [] |
| complexity | setComplexity | { value: TaskComplexity; reason: string } | null | null |
| finalResult | setFinalResult |  | '' |
| isRunning | setIsRunning |  | false |
| isDone | setIsDone |  | false |
| errorMsg | setErrorMsg |  | '' |
| statusMsg | setStatusMsg |  | '' |
| activeStepId | setActiveStepId |  | '' |
| tools | setTools | ToolDefinition[] | [] |
| toolsLoaded | setToolsLoaded |  | false |
| reactRunning | setReactRunning |  | false |
| reactResult | setReactResult | { finalAnswer: string; totalSteps: number; toolCallCount: number; totalDuration: number } | null | null |

## Hooks

| Hook |
|------|
| useState |
| useCallback |
| useActiveProvider |
| useEffect |

## 事件处理函数

| 函数名 |
|--------|
| handleRun |
| handleReActExecute |
| handleReset |
| handleExecute |
| handleKeyDown |

