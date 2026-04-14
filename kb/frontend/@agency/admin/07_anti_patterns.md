# 反模式清单 — 前端 Admin 端

> Admin 端与 Web 端共享大部分反模式（参见 `web/07_anti_patterns.md`），
> 本文件仅记录 Admin 端**特有的**反模式。

---

## AP-A001: 禁止使用 Web 端的 token key

**原因**：Admin 端和 Web 端的 token 是独立的，使用错误的 key 会导致认证失败
**检测**：Admin 端代码中出现 `localStorage.getItem('token')`（不带 `admin_` 前缀）

❌ **BAD**：
```typescript
const token = localStorage.getItem('token'); // ❌ 这是 Web 端的 key
```

✅ **GOOD**：
```typescript
const token = localStorage.getItem('admin_token'); // ✅
```

---

## AP-A002: 禁止 Admin 端调用非 /api/admin 前缀的接口

**原因**：Admin 端的 API 都在 `/api/admin` 下，直接调用 `/api/agents` 等接口可能缺少管理员权限验证
**检测**：Admin 端 API 函数中出现 `api.get('/agents')` 而非 `api.get('/agents')`（因为 baseURL 已是 `/api/admin`）
**例外**：某些共享接口（如 Provider 列表）可能需要调用非 admin 前缀的接口

---

## AP-A003: 禁止在 Admin 端使用 Web 端的 Store

**原因**：Admin 端有独立的 Store 定义，不应 import Web 端的 Store
**检测**：Admin 端代码中出现 `from '../../web/src/store'`

---

## 共享反模式

以下反模式与 Web 端完全一致，请参考 `web/07_anti_patterns.md`：

- **AP-F003**: 禁止直接解构整个 Store
- **AP-F004**: 禁止在组件文件中定义共享类型
- **AP-F005**: 禁止使用内联样式
- **AP-F006**: 禁止使用 CSS Modules 或 Styled-Components
- **AP-F008**: 禁止使用 class 组件
- **AP-F009**: 禁止使用 any 类型
- **AP-F010**: 禁止在组件中直接创建新的 axios 实例
