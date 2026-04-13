# TokenUsagePage

**文件**: src\pages\TokenUsagePage.tsx
**复杂度**: 复杂

## 功能概述

TokenUsagePage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| overview | setOverview | TokenUsageOverview | null | null |
| historyTotal | setHistoryTotal |  | 0 |
| page | setPage |  | 1 |
| loading | setLoading |  | true |
| groupBy | setGroupBy | 'provider' | 'model' | 'callType' | 'day' | 'provider' |
| providerFilter | setProviderFilter |  | '' |

## Hooks

| Hook |
|------|
| useState |
| useCallback |
| useEffect |

