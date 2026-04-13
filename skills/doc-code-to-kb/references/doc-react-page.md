# React 页面索引规范

## 生成目标

- `01_index_page.md` — 页面总览索引
- `pages/{PageName}.md` — 每个页面一个详情文件

## 分析流程

1. 扫描 `src/pages/` 目录下所有 `.tsx` 文件
2. 检查 `src/App.tsx` 中的路由定义（react-router-dom）
3. 对每个页面组件：
   - 读取文件内容，提取组件名
   - 提取 useState / useEffect / 自定义 Hook 调用
   - 提取 API 调用（从 api/ 导入的函数）
   - 提取子组件引用
   - 识别路由路径和参数
   - 分析页面功能点

## 总览文件格式（01_index_page.md）

```markdown
# 页面索引

## 路由表

| # | 路由路径 | 页面组件 | 文件 | 权限 | 说明 |
|---|---------|---------|------|------|------|
| 1 | / | HomePage | pages/HomePage.tsx | — | 首页 |
| 2 | /chat/:id? | ChatPage | pages/ChatPage.tsx | auth | 聊天页 |
| 3 | /agents | AgentsPage | pages/AgentsPage.tsx | auth | Agent 列表 |

## 页面功能摘要

### HomePage

**文件**: src/pages/HomePage.tsx
**路由**: /
**功能点**:
- 展示系统概览统计
- 快捷入口导航

**API 调用**:

| 函数 | API | 触发时机 | 说明 |
|------|-----|---------|------|
| fetchStats() | api.getStats | 页面加载 | 获取统计数据 |

**状态管理**:

| Hook | 说明 |
|------|------|
| useState(stats) | 统计数据 |
| useEffect | 页面加载时获取数据 |
```

## 详情文件格式（pages/{PageName}.md）

```markdown
# {PageName}

**文件**: src/pages/{filename}.tsx
**路由**: /{path}
**复杂度**: 复杂/简单

## 功能概述
一句话描述页面功能。

## 状态管理

| 状态 | 类型 | 初始值 | 说明 |
|------|------|--------|------|
| data | Array | [] | 列表数据 |
| loading | boolean | false | 加载状态 |
| modalOpen | boolean | false | 弹窗开关 |

## API 调用

| 函数 | API 方法 | 触发时机 | 说明 |
|------|---------|---------|------|
| handleLoad | api.getList | 页面加载 | 获取列表 |
| handleSubmit | api.create | 表单提交 | 创建记录 |
| handleDelete | api.delete | 点击删除 | 删除记录 |

## 子组件

| 组件 | 来源 | Props | 说明 |
|------|------|-------|------|
| Layout | components/Layout | children | 页面布局 |
| Modal | antd | open, onOk | 编辑弹窗 |

## 核心交互流程

1. 页面加载 → 调用 api.getList → 设置 data 状态
2. 点击新增 → 打开 Modal → 填写表单 → 调用 api.create → 刷新列表
3. 点击删除 → 确认弹窗 → 调用 api.delete → 刷新列表

## 事件处理函数

| 函数名 | 触发元素 | 逻辑 |
|--------|---------|------|
| handleSearch | 搜索框 onChange | 过滤列表数据 |
| handleSubmit | 表单 onFinish | 调用 API 创建/更新 |
| handleDelete | 删除按钮 onClick | 调用 API 删除 |
```
