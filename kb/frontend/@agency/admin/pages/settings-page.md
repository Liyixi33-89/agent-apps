# SettingsPage

**文件**: src\pages\SettingsPage.tsx
**复杂度**: 复杂

## 功能概述

SettingsPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| settings | setSettings | SettingsData | null | null |
| providers | setProviders | { activeProvider: string; providers: ProviderInfo[]; routingStrategy: string; fallbackChain: string[] } | null | null |
| loading | setLoading |  | true |

## API 调用

| API 方法 |
|---------|
| api.openai |
| api.anthropic |
| api.deepseek |

## Hooks

| Hook |
|------|
| useState |
| useEffect |

