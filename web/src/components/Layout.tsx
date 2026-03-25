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
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* 移动端遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/40 backdrop-blur-sm lg:hidden"
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
          'fixed lg:static inset-y-0 left-0 z-30 w-60 flex flex-col bg-white border-r border-slate-200 shadow-sm transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center shadow-sm">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800">Agency Agents</div>
            <div className="text-xs text-slate-400">AI 开发平台</div>
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
                location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
                  ? 'bg-sky-50 text-sky-600 border border-sky-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              )}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {lang === 'zh' ? label.zh : label.en}
            </Link>
          ))}
        </nav>

        {/* 底部工具栏 */}
        <div className="px-3 py-4 border-t border-slate-100 space-y-0.5">
          {/* Provider 切换 */}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
            onClick={handleToggleProvider}
            aria-label="切换 AI 提供商"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">
              {activeProvider === 'ollama' ? '🦙 Ollama' : '🤖 CodeBuddy'}
            </span>
            <span className="text-slate-300 text-xs">切换</span>
          </button>

          {/* 语言切换 */}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
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
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
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
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shadow-sm">
          <button
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="打开菜单"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-slate-800">Agency Agents</span>
          <button
            className="ml-auto p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            onClick={() => setSidebarOpen(false)}
            aria-label="关闭菜单"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
