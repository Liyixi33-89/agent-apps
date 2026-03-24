import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bot, Zap, MessageSquare, BookOpen, GitBranch, Home, Menu, X, Globe, Cpu, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../store';

const navItems = [
  { path: '/',          label: { zh: '首页',       en: 'Home' },      icon: Home },
  { path: '/agents',   label: { zh: 'Agent 库',   en: 'Agents' },    icon: Bot },
  { path: '/vibe',     label: { zh: 'Vibe Coding', en: 'Vibe Coding' }, icon: Zap },
  { path: '/chat',     label: { zh: '对话',        en: 'Chat' },      icon: MessageSquare },
  { path: '/knowledge',label: { zh: '知识库',      en: 'Knowledge' }, icon: BookOpen },
  { path: '/pipelines',label: { zh: '流水线',      en: 'Pipelines' }, icon: GitBranch },
];

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { lang, setLang, activeProvider, setActiveProvider } = useAppStore();

  const handleToggleLang = () => setLang(lang === 'zh' ? 'en' : 'zh');
  const handleToggleProvider = () => setActiveProvider(activeProvider === 'ollama' ? 'codebuddy' : 'ollama');

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* 移动端遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="关闭侧边栏"
          onKeyDown={(e) => e.key === 'Enter' && setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={clsx(
          'fixed lg:static inset-y-0 left-0 z-30 w-60 flex flex-col bg-gray-900 border-r border-gray-800 transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Agency Agents</div>
            <div className="text-xs text-gray-500">AI 开发平台</div>
          </div>
        </div>

        {/* 导航 */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
                location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
                  ? 'bg-sky-600/20 text-sky-400 border border-sky-600/30'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
              )}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {lang === 'zh' ? label.zh : label.en}
            </Link>
          ))}
        </nav>

        {/* 底部工具栏 */}
        <div className="px-3 py-4 border-t border-gray-800 space-y-2">
          {/* Provider 切换 */}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
            onClick={handleToggleProvider}
            aria-label="切换 AI 提供商"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">
              {activeProvider === 'ollama' ? '🦙 Ollama' : '🤖 CodeBuddy'}
            </span>
            <span className="text-gray-600">切换</span>
          </button>

          {/* 语言切换 */}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
            onClick={handleToggleLang}
            aria-label="切换语言"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{lang === 'zh' ? '中文' : 'English'}</span>
          </button>

          {/* 管理后台入口 */}
          <a
            href="http://127.0.0.1:5174/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-violet-400 hover:bg-violet-900/20 transition-colors"
            aria-label="管理后台"
            tabIndex={0}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>管理后台</span>
          </a>
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 顶部栏（移动端） */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800">
          <button
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800"
            onClick={() => setSidebarOpen(true)}
            aria-label="打开菜单"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-white">Agency Agents</span>
          <button
            className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800"
            onClick={() => setSidebarOpen(false)}
            aria-label="关闭菜单"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
