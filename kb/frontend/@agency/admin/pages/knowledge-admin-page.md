# KnowledgeAdminPage

**文件**: src\pages\KnowledgeAdminPage.tsx
**复杂度**: 复杂

## 功能概述

KnowledgeAdminPage 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| items | setItems | KnowledgeItem[] | [] |
| loading | setLoading |  | true |
| total | setTotal |  | 0 |
| page | setPage |  | 1 |
| showCreate | setShowCreate |  | false |
| creating | setCreating |  | false |
| ingestLoading | setIngestLoading |  | false |
| knowledgeIngestLoading | setKnowledgeIngestLoading |  | false |
| ingestMsg | setIngestMsg |  | '' |
| uploading | setUploading |  | false |
| refreshingUrls | setRefreshingUrls |  | false |
| buildingEmbeddings | setBuildingEmbeddings |  | false |
| form | setForm |  | {
    titleZh: '', titleEn: '', content: '',
    sourceType: 'text' as 'markdown' | 'text' | 'url',
    categoryKey: '', tags: '', translate: true
  } |

## Hooks

| Hook |
|------|
| useState |
| useCallback |
| useEffect |

## 事件处理函数

| 函数名 |
|--------|
| handleCreate |
| handleDelete |
| handleIngest |
| handleKnowledgeIngest |
| handleDocumentUpload |
| handleRefreshAllUrls |
| handleBuildEmbeddings |

