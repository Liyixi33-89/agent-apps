# PublishModal

**文件**: src\pages\vibe-coding\PublishModal.tsx
**复杂度**: 复杂

## 功能概述

PublishModal 页面。

## 状态管理

| 状态 | setter | 类型 | 初始值 |
|------|--------|------|--------|
| title | setTitle |  | item.label.slice(0, 30 |
| description | setDesc |  | '' |
| category | setCategory |  | '/ҳ' |
| tagInput | setTagInput |  | '' |
| tags | setTags | string[] | [] |
| publishing | setPublishing |  | false |
| error | setError |  | '' |
| thumbnailFile | setThumbnailFile | File | null | null |
| thumbnailPreview | setThumbnailPreview | string | null | null |
| uploadingImg | setUploadingImg |  | false |
| publishToMarket | setPublishToMarket |  | false |

## Hooks

| Hook |
|------|
| useState |

## 事件处理函数

| 函数名 |
|--------|
| handleAddTag |
| handleTagKeyDown |
| handleImageChange |
| handleRemoveImage |
| handlePublish |

