import { create } from 'zustand';

interface AdminState {
  token: string | null;
  username: string | null;
  setAuth: (token: string, username: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

export const useAdminStore = create<AdminState>((set) => ({
  token: localStorage.getItem('admin_token'),
  username: localStorage.getItem('admin_username'),
  isAuthenticated: !!localStorage.getItem('admin_token'),

  setAuth: (token, username) => {
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_username', username);
    set({ token, username, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    set({ token: null, username: null, isAuthenticated: false });
  }
}));
