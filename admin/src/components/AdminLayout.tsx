import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bot, LayoutDashboard, Database, BookOpen, GitBranch, MessageSquare, Settings, LogOut, Menu, X } from 'lucide-react';
import clsx from 'clsx';
import { useAdminStore } from '../store';

const navItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/agents', label: 'Agent 管理', icon: Bot },
  { path: '/knowledge', label: '知识库管理', icon: BookOpen },
  { path: '/pipelines', label: '流水线管理', icon: GitBranch },
  { path: '/chats', label: '对话记录', icon: MessageSquare },
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
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="关闭菜单"
          onKeyDown={(e) => e.key === 'Enter' && setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside className={clsx(
        'fixed lg:static inset-y-0 left-0 z-30 w-56 flex flex-col bg-gray-900 border-r border-gray-800 transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Admin</div>
            <div className="text-xs text-gray-500">管理后台</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                location.pathname === path
                  ? 'bg-sky-600/20 text-sky-400 border border-sky-600/30'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
              )}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-800">
          <div className="flex items-center gap-2 px-3 py-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-sky-600/30 flex items-center justify-center text-xs text-sky-400 font-bold">
              {username?.[0]?.toUpperCase() || 'A'}
            </div>
            <span className="text-sm text-gray-300 truncate">{username}</span>
          </div>
          <button
            className="w-full btn-ghost text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20"
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
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800">
          <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-800" onClick={() => setSidebarOpen(true)} aria-label="打开菜单">
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-white">Agency Admin</span>
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
