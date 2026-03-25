import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bot, LayoutDashboard, BookOpen, GitBranch, MessageSquare, Settings, LogOut, Menu, X, Sparkles, LayoutTemplate } from 'lucide-react';
import clsx from 'clsx';
import { useAdminStore } from '../store';

const navItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/agents', label: 'Agent 管理', icon: Bot },
  { path: '/knowledge', label: '知识库管理', icon: BookOpen },
  { path: '/pipelines', label: '流水线管理', icon: GitBranch },
  { path: '/chats', label: '对话记录', icon: MessageSquare },
  { path: '/prompts',  label: '提示词管理', icon: Sparkles },
  { path: '/vibe-templates', label: '模板市场', icon: LayoutTemplate },
  { path: '/settings', label: '系统设置', icon: Settings }
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { username, logout } = useAdminStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="关闭菜单"
          onKeyDown={(e) => e.key === 'Enter' && setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside className={clsx(
        'fixed lg:static inset-y-0 left-0 z-30 w-56 flex flex-col bg-white border-r border-slate-200 shadow-sm transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center shadow-sm">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800">Admin</div>
            <div className="text-xs text-slate-400">管理后台</div>
          </div>
        </div>

        {/* 导航 */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                location.pathname === path
                  ? 'bg-sky-50 text-sky-600 border border-sky-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              )}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* 底部用户区 */}
        <div className="px-3 py-4 border-t border-slate-100">
          <div className="flex items-center gap-2 px-3 py-2 mb-1 rounded-lg bg-slate-50">
            <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center text-xs text-sky-600 font-bold">
              {username?.[0]?.toUpperCase() || 'A'}
            </div>
            <span className="text-sm text-slate-600 truncate">{username}</span>
          </div>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-150"
            onClick={handleLogout}
            aria-label="退出登录"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      </aside>

      {/* 主内容 */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 移动端顶部栏 */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shadow-sm">
          <button
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="打开菜单"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-slate-800">Agency Admin</span>
          <button
            className="ml-auto p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            onClick={() => setSidebarOpen(false)}
            aria-label="关闭菜单"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
