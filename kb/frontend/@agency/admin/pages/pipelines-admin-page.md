# PipelinesAdminPage

**文件**: src\pages\PipelinesAdminPage.tsx
**复杂度**: 复杂

## 功能概述

PipelinesAdminPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| pipelines | setPipelines | Pipeline[] | [] |
| loading | setLoading |  | true |
| showCreate | setShowCreate |  | false |
| creating | setCreating |  | false |
| form | setForm |  | {
    key: '',
    nameZh: '',
    nameEn: '',
    descZh: '',
    descEn: '',
  } |
| steps | setSteps | StepForm[] | [{ ...DEFAULT_STEP }] |

## Hooks

| Hook |
|------|
| useState |
| useEffect |

## 事件处理函数

| 函数名 |
|--------|
| handleDelete |
| handleAddStep |
| handleRemoveStep |
| handleStepChange |
| handleCloseCreate |
| handleCreate |

