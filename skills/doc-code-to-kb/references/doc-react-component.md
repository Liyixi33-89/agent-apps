# React 组件索引规范

## 生成目标

- `02_index_component.md` — 公共组件索引

## 分析流程

1. 扫描 `src/components/` 目录下所有 `.tsx` 文件
2. 对每个组件：
   - 读取文件内容，提取组件名
   - 提取 Props 接口/类型定义
   - 提取组件内部状态（useState）
   - 提取事件回调（on* props）
   - 识别子组件依赖
   - 分析组件功能

## 索引文件格式（02_index_component.md）

```markdown
# 公共组件索引

## 组件总览

| # | 组件名 | 文件 | Props 数 | 说明 |
|---|--------|------|---------|------|
| 1 | Layout | components/Layout.tsx | 3 | 页面布局框架 |
| 2 | MessageRating | components/MessageRating.tsx | 4 | 消息评分组件 |

## 组件详情

### Layout

**文件**: src/components/Layout.tsx
**说明**: 页面布局框架，包含导航栏、侧边栏、登录弹窗

**Props**:

| Prop | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| children | ReactNode | ✅ | — | 子内容 |

**内部状态**:

| 状态 | 类型 | 说明 |
|------|------|------|
| collapsed | boolean | 侧边栏折叠状态 |
| loginOpen | boolean | 登录弹窗开关 |

**事件/回调**:

| 事件 | 说明 |
|------|------|
| handleLogin | 登录提交 |
| handleLogout | 退出登录 |

**使用示例**:
```tsx
<Layout>
  <HomePage />
</Layout>
```
```
