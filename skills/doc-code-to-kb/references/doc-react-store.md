# Zustand Store 索引规范

## 生成目标

- `04_index_store.md` — 状态管理索引

## 分析流程

1. 扫描 `src/store/` 目录下所有 `.ts` 文件
2. 对每个 Store 文件：
   - 读取文件内容，提取 create() 调用中的状态定义
   - 提取 state 字段及类型
   - 提取 actions（修改状态的函数）
   - 识别 persist 中间件配置
   - 识别 selector 模式

## 索引文件格式（04_index_store.md）

```markdown
# Zustand Store 索引

## Store 总览

| # | Store 名 | 文件 | 状态字段数 | Action 数 | 持久化 | 说明 |
|---|---------|------|-----------|----------|--------|------|
| 1 | useStore | store/index.ts | 5 | 8 | 否 | 全局状态 |

## Store 详情

### useStore

**文件**: src/store/index.ts

**状态字段**:

| 字段 | 类型 | 初始值 | 说明 |
|------|------|--------|------|
| user | User \| null | null | 当前登录用户 |
| token | string | '' | JWT token |
| theme | 'light' \| 'dark' | 'light' | 主题 |

**Actions**:

| Action | 入参 | 说明 |
|--------|------|------|
| setUser(user) | User \| null | 设置当前用户 |
| setToken(token) | string | 设置 token |
| logout() | — | 清除用户和 token |

**使用示例**:
```tsx
const user = useStore(state => state.user);
const setUser = useStore(state => state.setUser);
```
```
