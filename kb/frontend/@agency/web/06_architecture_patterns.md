# 架构模式 — 前端 Web 端

> 本文件记录 Web 前端代码中实际使用的架构模式，每个模式都有 ✅ GOOD / ❌ BAD 代码示例。

---

## Pattern-F001: API 封装模式

所有 API 请求通过 `api/index.ts` 中的 axios 实例发起，自动附加 token 和统一错误处理。

✅ **GOOD**：
```typescript
// api/index.ts — 唯一的 axios 实例
import axios from 'axios';
const api = axios.create({ baseURL: '/api', timeout: 60_000 });

// 请求拦截器：自动附加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 响应拦截器：统一错误提示
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401) message.error('未授权，请重新登录');
    else if (status === 403) message.error('没有权限执行此操作');
    // ...
    return Promise.reject(error);
  }
);

// API 函数：解构 data，返回业务数据
export const fetchAgents = async (params?: { ... }) => {
  const { data } = await api.get<{ success: boolean; data: Agent[] }>('/agents', { params });
  return data;
};
```

❌ **BAD**：
```typescript
// 直接用 fetch，绕过 axios 实例
export const fetchAgents = async () => {
  const res = await fetch('/api/agents'); // ❌ 绕过拦截器
  return res.json();
};

// 在组件中直接创建 axios 实例
const myApi = axios.create({ baseURL: '/api' }); // ❌ 应使用统一实例
```

**例外**：SSE 流式请求必须使用原生 `fetch`（axios 不支持 ReadableStream）：
```typescript
// ✅ SSE 场景允许使用 fetch
export const executeAgentPlan = (prompt, options, onEvent, onError) => {
  const controller = new AbortController();
  fetch('/api/agent/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, ...options }),
    signal: controller.signal,
  }).then(async (res) => {
    const reader = res.body.getReader();
    // 逐行解析 SSE 事件...
  });
  return () => controller.abort();
};
```

---

## Pattern-F002: API 函数返回值约定

API 函数应解构 axios 响应，直接返回业务数据。

✅ **GOOD**：
```typescript
// 返回 data.data（单个资源）
export const fetchAgent = async (slug: string) => {
  const { data } = await api.get<{ success: boolean; data: Agent }>(`/agents/${slug}`);
  return data.data; // 直接返回 Agent 对象
};

// 返回完整 data（带分页的列表）
export const fetchAgents = async (params?: { ... }) => {
  const { data } = await api.get<{ success: boolean; data: Agent[]; pagination: { ... } }>('/agents', { params });
  return data; // 返回 { success, data, pagination }
};
```

❌ **BAD**：
```typescript
// 返回整个 axios response
export const fetchAgent = async (slug: string) => {
  return api.get(`/agents/${slug}`); // ❌ 调用方还要 .data.data
};
```

---

## Pattern-F003: 可取消请求模式

同一 key 的请求会自动取消前一个，避免竞态条件。

✅ **GOOD**：
```typescript
// api/index.ts 中的 cancelableRequest 工具
const pendingRequests = new Map<string, AbortController>();

export const cancelableRequest = <T>(key: string, requestFn: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  const prev = pendingRequests.get(key);
  if (prev) prev.abort(); // 取消前一个同 key 请求

  const controller = new AbortController();
  pendingRequests.set(key, controller);
  return requestFn(controller.signal).finally(() => {
    if (pendingRequests.get(key) === controller) pendingRequests.delete(key);
  });
};
```

---

## Pattern-F004: Store 使用模式

使用 Zustand 单 Store + `persist` + `useShallow` 选择器。

✅ **GOOD**：
```typescript
// store/index.ts — 单 Store 定义
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

interface AppState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;
  // ...
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      lang: 'zh',
      setLang: (lang) => set({ lang }),
      agents: [],
      setAgents: (agents) => set({ agents }),
    }),
    {
      name: 'agency-agents-store',
      partialize: (state) => ({
        lang: state.lang,           // 只持久化偏好字段
        activeProvider: state.activeProvider,
        modelType: state.modelType,
      }),
    }
  )
);

// 细粒度选择器 — 避免全量订阅
export const useLang = () => useAppStore((s) => s.lang);
export const useActiveProvider = () => useAppStore((s) => s.activeProvider);

// 多字段选择器 — 使用 useShallow
export const useAppStoreShallow = <T>(selector: (state: AppState) => T): T =>
  useAppStore(useShallow(selector));
```

```typescript
// 组件中使用
const { agents, setAgents } = useAppStoreShallow(s => ({
  agents: s.agents,
  setAgents: s.setAgents,
}));
```

❌ **BAD**：
```typescript
// 直接解构整个 Store（会导致任何字段变化都重渲染）
const { agents, lang, provider } = useAppStore(); // ❌

// 在 Store 中存储 token
interface AppState {
  token: string; // ❌ token 应存 localStorage
}
```

---

## Pattern-F005: 页面组件结构

页面组件遵循固定的代码结构顺序。

✅ **GOOD**：
```typescript
const XxxPage: React.FC = () => {
  // 1. Router hooks
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 2. Store hooks
  const { lang, activeProvider } = useAppStoreShallow(s => ({
    lang: s.lang,
    activeProvider: s.activeProvider,
  }));

  // 3. Local state
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  // 4. Refs
  const containerRef = useRef<HTMLDivElement>(null);

  // 5. Memos
  const filteredData = useMemo(() => data.filter(...), [data]);

  // 6. Effects
  useEffect(() => { handleLoad(); }, []);

  // 7. Callbacks / Event handlers（handle* 前缀）
  const handleLoad = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchData();
      setData(result);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreate = async (values: T) => { ... };
  const handleDelete = async (id: string) => { ... };

  // 8. Render
  return (
    <div className="p-6">
      ...
    </div>
  );
};

export default XxxPage;
```

---

## Pattern-F006: 类型定义模式

所有类型集中在 `types/index.ts` 中定义，前端接口不加 `I` 前缀。

✅ **GOOD**：
```typescript
// types/index.ts
export interface Agent {
  _id: string;
  slug: string;
  name: LocalizedText;
  // ...
}

export interface LocalizedText {
  zh: string;
  en: string;
}

export type Provider = 'ollama' | 'openai' | 'claude' | 'gemini' | 'deepseek';
export type ModelType = 'text' | 'vision';
```

❌ **BAD**：
```typescript
// 在组件文件中定义类型
// ChatPage.tsx
interface ChatMessage { ... } // ❌ 应放在 types/index.ts

// 加 I 前缀（后端约定，前端不用）
export interface IAgent { ... } // ❌ 前端用 Agent
```

---

## Pattern-F007: 样式约定

使用 TailwindCSS 类名，不使用内联样式或 CSS 文件。

✅ **GOOD**：
```tsx
<div className="p-6 bg-white rounded-lg shadow-sm">
  <h1 className="text-2xl font-bold text-gray-900">标题</h1>
  <p className="mt-2 text-gray-600">描述</p>
</div>
```

❌ **BAD**：
```tsx
<div style={{ padding: '24px', background: 'white' }}> // ❌ 内联样式
<div className={isActive ? 'bg-blue-500' : 'bg-gray-500'}> // ⚠️ 简单条件可用 class:
```

---

## Pattern-F008: Token 存储与认证

Token 存在 `localStorage`，web 端 key 为 `token`，admin 端 key 为 `admin_token`。

✅ **GOOD**：
```typescript
// Web 端
const token = localStorage.getItem('token');
const isLoggedIn = !!localStorage.getItem('token');

// Admin 端
const token = localStorage.getItem('admin_token');

// 登录后存储
localStorage.setItem('token', response.token);

// 登出时清除
localStorage.removeItem('token');
```

❌ **BAD**：
```typescript
// 存在 Store 中
const { token } = useAppStore(); // ❌ Store 刷新后丢失

// 存在 sessionStorage 中
sessionStorage.setItem('token', token); // ❌ 约定用 localStorage

// 存在 cookie 中
document.cookie = `token=${token}`; // ❌ 约定用 localStorage
```

---

## Pattern-F009: 多语言文本显示

通过 `useLang()` 获取当前语言，按 `field[lang]` 取值。

✅ **GOOD**：
```typescript
const lang = useLang();

// 显示多语言文本
<h1>{agent.name[lang]}</h1>
<p>{agent.description[lang]}</p>
```

❌ **BAD**：
```typescript
// 硬编码语言
<h1>{agent.name.zh}</h1> // ❌ 不支持切换语言

// 使用 i18n 库
import { useTranslation } from 'react-i18next'; // ❌ 项目不用 i18n 库
```
