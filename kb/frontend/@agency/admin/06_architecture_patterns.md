# 架构模式 — 前端 Admin 端

> Admin 端与 Web 端共享大部分架构模式（参见 `web/06_architecture_patterns.md`），
> 本文件仅记录 Admin 端**特有的**差异模式。

---

## Pattern-A001: API 基础路径差异

Admin 端的 axios 实例 `baseURL` 为 `/api/admin`，而非 `/api`。

✅ **GOOD**：
```typescript
// admin/src/api/index.ts
const api = axios.create({ baseURL: '/api/admin', timeout: 60_000 });
```

❌ **BAD**：
```typescript
const api = axios.create({ baseURL: '/api' }); // ❌ Admin 端应使用 /api/admin
```

---

## Pattern-A002: Token 存储 key 差异

Admin 端 token 存储 key 为 `admin_token`，与 Web 端的 `token` 区分。

✅ **GOOD**：
```typescript
// Admin 端
const token = localStorage.getItem('admin_token');
localStorage.setItem('admin_token', response.token);
```

❌ **BAD**：
```typescript
const token = localStorage.getItem('token'); // ❌ 这是 Web 端的 key
```

---

## Pattern-A003: 401 响应自动跳转登录

Admin 端响应拦截器在收到 401 时自动清除 token 并跳转到 `/login`。

✅ **GOOD**：
```typescript
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);
```

---

## Pattern-A004: initAdminToken 手动设置

Admin 端提供 `initAdminToken` 函数，在 Store 初始化时手动设置 axios 默认 header。

✅ **GOOD**：
```typescript
// api/index.ts
export const initAdminToken = (token: string) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

// 登录成功后调用
const result = await adminLogin(username, password);
localStorage.setItem('admin_token', result.token);
initAdminToken(result.token);
```

---

## 共享模式

以下模式与 Web 端完全一致，请参考 `web/06_architecture_patterns.md`：

- **Pattern-F004**: Store 使用模式（Zustand + persist + useShallow）
- **Pattern-F005**: 页面组件结构
- **Pattern-F006**: 类型定义模式
- **Pattern-F007**: 样式约定（TailwindCSS）
- **Pattern-F009**: 多语言文本显示
