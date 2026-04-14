# PRD — Agent 收藏功能

**版本**：v1.2.0
**日期**：2026-04-14
**来源 BRD**：`version-doc/v1.2.0/brd/brd_normalized.md`

---

## 1. 概述

### 1.1 产品目标

为 Agency Agents 平台增加 Agent 收藏功能，让用户能快速标记和访问常用 Agent，提升使用效率和用户粘性。

### 1.2 用户角色

| 角色 | 说明 |
|------|------|
| 已登录用户 | 可执行收藏/取消收藏操作，查看个人收藏列表 |
| 未登录用户 | 可查看 Agent 收藏数，点击收藏时引导登录 |

---

## 2. 功能需求

### FR-001：收藏/取消收藏 Agent（P0）
### FR-002：我的收藏列表（P0）
### FR-003：收藏数统计（P1）

## 3. API 设计概要

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/favorites` | 收藏 Agent | ✅ |
| DELETE | `/api/favorites/:agentId` | 取消收藏 | ✅ |
| GET | `/api/favorites` | 获取我的收藏列表 | ✅ |
| GET | `/api/favorites/check` | 批量检查收藏状态 | ✅ |

## 4. 数据模型概要

### Favorite（新增）

| 字段 | 类型 | 说明 |
|------|------|------|
| userId | ObjectId | 用户 ID |
| agentId | ObjectId | Agent ID |
| createdAt | Date | 收藏时间 |

### Agent（扩展）

| 字段 | 类型 | 说明 |
|------|------|------|
| favoriteCount | Number | 收藏数（冗余字段） |
