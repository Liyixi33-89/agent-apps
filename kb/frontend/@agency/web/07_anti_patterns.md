# 反模式清单 — 前端 Web 端

> 本文件列出前端开发中**禁止**的做法。

---

## AP-F001: 禁止绕过 axios 实例发起普通请求

**原因**：绕过 axios 实例会跳过 token 注入和统一错误处理
**检测**：非 SSE 场景中出现 `fetch(` 或 `new XMLHttpRequest`
**例外**：SSE 流式请求（`executeFullStackPipeline`、`executeAgentPlan`、`executeReActLoop`）允许使用 `fetch`

---

## AP-F002: 禁止在 Store 中存储 Token

**原因**：Store 刷新后 token 会丢失，且 `persist` 的 `partialize` 未包含 token
**检测**：`store/index.ts` 中出现 `token` 字段定义

---

## AP-F003: 禁止直接解构整个 Store

**原因**：会导致任何 Store 字段变化都触发组件重渲染
**检测**：`const { ... } = useAppStore()` 且解构了 3 个以上字段

❌ **BAD**：
```typescript
const { agents, lang, provider, categories, pipelines } = useAppStore();
```

✅ **GOOD**：
```typescript
const { agents, lang } = useAppStoreShallow(s => ({
  agents: s.agents,
  lang: s.lang,
}));
```

---

## AP-F004: 禁止在组件文件中定义共享类型

**原因**：类型应集中在 `types/index.ts`，方便复用和维护
**检测**：`pages/*.tsx` 或 `components/*.tsx` 中出现 `export interface` 或 `export type`
**例外**：组件内部使用的 Props 类型可以在组件文件中定义

---

## AP-F005: 禁止使用内联样式

**原因**：项目统一使用 TailwindCSS
**检测**：JSX 中出现 `style={{ ... }}`
**例外**：动态计算的样式值（如 `style={{ height: calculatedHeight }}`）

---

## AP-F006: 禁止使用 CSS Modules 或 Styled-Components

**原因**：项目统一使用 TailwindCSS
**检测**：出现 `import styles from '*.module.css'` 或 `styled.div`

---

## AP-F007: 禁止在 API 函数中处理 UI 逻辑

**原因**：API 层只负责数据请求，UI 反馈（message.error 等）由拦截器或组件处理
**检测**：`api/index.ts` 中的 API 函数内出现 `message.error` 或 `notification`
**例外**：响应拦截器中的统一错误提示

---

## AP-F008: 禁止使用 class 组件

**原因**：项目统一使用函数组件 + Hooks
**检测**：出现 `class XxxComponent extends React.Component`

---

## AP-F009: 禁止使用 any 类型（除非有注释说明）

**原因**：TypeScript 的类型安全是项目的核心约束
**检测**：`: any` 且无 `// eslint-disable` 或 `// TODO` 注释说明原因

❌ **BAD**：
```typescript
const data: any = await fetchData();
```

✅ **GOOD**：
```typescript
const data: Agent[] = await fetchData();
// 或者确实需要 any 时加注释
const rawData = response as any; // TODO: 后端返回类型待定义
```

---

## AP-F010: 禁止在组件中直接创建新的 axios 实例

**原因**：应使用 `api/index.ts` 中的统一实例
**检测**：`pages/*.tsx` 或 `components/*.tsx` 中出现 `axios.create`
