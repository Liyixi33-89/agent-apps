import { create } from 'zustand';
import { initAdminToken } from '../api';

// 安全访问 localStorage（防止 SSR 或隐私模式崩溃）
const safeGet = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const safeSet = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
};
const safeRemove = (key: string) => {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
};

interface AdminState {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string, username: string) => void;
  logout: () => void;
}

const storedToken = safeGet('admin_token');
// 应用启动时恢复 token 到 axios 请求头
if (storedToken) initAdminToken(storedToken);

export const useAdminStore = create<AdminState>((set) => ({
  token: storedToken,
  username: safeGet('admin_username'),
  isAuthenticated: !!storedToken,

  setAuth: (token, username) => {
    safeSet('admin_token', token);
    safeSet('admin_username', username);
    initAdminToken(token);
    set({ token, username, isAuthenticated: true });
  },

  logout: () => {
    safeRemove('admin_token');
    safeRemove('admin_username');
    set({ token: null, username: null, isAuthenticated: false });
  },
}));
