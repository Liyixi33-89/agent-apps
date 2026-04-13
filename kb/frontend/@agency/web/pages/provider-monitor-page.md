# ProviderMonitorPage

**文件**: src\pages\ProviderMonitorPage.tsx
**复杂度**: 复杂

## 功能概述

ProviderMonitorPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| providers | setProviders | ProviderInfo[] | [] |
| activeProvider | setActiveProvider |  | '' |
| routingStrategy | setRoutingStrategy |  | '' |
| fallbackChain | setFallbackChain | string[] | [] |
| loading | setLoading |  | true |
| checkingProvider | setCheckingProvider | string | null | null |

## Hooks

| Hook |
|------|
| useState |
| useCallback |
| useEffect |

## 事件处理函数

| 函数名 |
|--------|
| handleHealthCheck |
| handleCheckAll |

