import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Lock, User, Eye, EyeOff } from 'lucide-react';
import { adminLogin } from '../api';
import { useAdminStore } from '../store';

const LoginPage = () => {
  const navigate = useNavigate();
  const { setAuth } = useAdminStore();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    setError('');

    try {
      const result = await adminLogin(username, password);
      setAuth(result.token, result.username);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-slate-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-sky-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-sky-200">
            <Bot className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Agency Agents</h1>
          <p className="text-slate-400 text-sm mt-1">管理后台</p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleLogin} className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-100 p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">用户名</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                className="input pl-9"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-label="用户名"
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="input pl-9 pr-9"
                placeholder="输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label="密码"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full justify-center"
            disabled={loading || !username.trim() || !password.trim()}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            {loading ? '登录中...' : '登录'}
          </button>

          <p className="text-xs text-slate-400 text-center">
            首次登录将自动创建管理员账号
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
