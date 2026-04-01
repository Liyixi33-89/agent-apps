import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  Globe, Search, Trash2, Pencil, Save, X,
  Loader2, RefreshCw, Eye, EyeOff, ExternalLink,
  ChevronLeft, ChevronRight, Copy, Check, Server, Code2,
  Rocket, Power,
} from 'lucide-react';
import clsx from 'clsx';
import { App } from 'antd';
import {
  fetchAdminVibeApps, updateAdminVibeApp, deleteAdminVibeApp,
  fetchAdminVibeAppCode,
  deployVibeAppRuntime, undeployVibeAppRuntime, fetchVibeAppRuntimeStatus,
  type VibeAppAdmin, type VibeAppCodeDetail,
  type RuntimeStatus,
} from '../api';

// 懒加载 Monaco Editor
const MonacoEditor = lazy(() => import('@monaco-editor/react'));

// ─── 常量 ──────────────────────────────────────────────────────────────────────

/** 前端预览页基础地址（web 端口） */
const PREVIEW_BASE_URL = window.location.origin.replace(':5174', ':5173');

const STATUS_FILTERS = [
  { key: '',      label: '全部' },
  { key: 'true',  label: '已上架' },
  { key: 'false', label: '已下架' },
];

// ─── 编辑 Tab 类型 ────────────────────────────────────────────────────────────

type EditTab = 'info' | 'frontend' | 'backend' | 'database' | 'permission';

/** 后端代码子 Tab */
type BackendSubTab = 'model' | 'route' | 'service' | 'middleware' | 'envTemplate';

/** 前端代码子 Tab */
type FrontendSubTab = 'jsx' | 'html' | 'css' | 'js';

/** 权限配置子 Tab */
type PermissionSubTab = 'menus' | 'permissions' | 'roles';

// ─── 子组件：编辑弹窗（增强版 — 支持前后端代码编辑）──────────────────────────

interface EditModalProps {
  app: VibeAppAdmin;
  onSave: (id: string, data: Partial<VibeAppAdmin>) => Promise<void>;
  onClose: () => void;
}

const EditModal = ({ app, onSave, onClose }: EditModalProps) => {
  // 基本信息
  const [title, setTitle]       = useState(app.title);
  const [description, setDesc]  = useState(app.description);
  const [author, setAuthor]     = useState(app.author);
  const [isActive, setIsActive] = useState(app.isActive);

  // Tab 状态
  const [activeTab, setActiveTab] = useState<EditTab>('info');

  // 代码加载状态
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeLoaded, setCodeLoaded]   = useState(false);
  const [codeDetail, setCodeDetail]   = useState<VibeAppCodeDetail | null>(null);

  // 前端代码编辑状态
  const [frontendSubTab, setFrontendSubTab] = useState<FrontendSubTab>('jsx');
  const [frontendCode, setFrontendCode] = useState<Record<FrontendSubTab, string>>({
    jsx: '', html: '', css: '', js: '',
  });

  // 后端代码编辑状态
  const [backendSubTab, setBackendSubTab] = useState<BackendSubTab>('model');
  const [backendCode, setBackendCode] = useState<Record<BackendSubTab, string>>({
    model: '', route: '', service: '', middleware: '', envTemplate: '',
  });

  // 数据库代码编辑状态
  const [dbCode, setDbCode] = useState({ collections: '', indexes: '', seedData: '' });

  // 权限配置编辑状态
  const [permSubTab, setPermSubTab] = useState<PermissionSubTab>('menus');
  const [permCode, setPermCode] = useState<Record<PermissionSubTab, string>>({
    menus: '', permissions: '', roles: '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const isFullStack = app.isFullStack ?? false;

  // 切换到代码 Tab 时懒加载完整代码
  const loadCodeIfNeeded = useCallback(async () => {
    if (codeLoaded || codeLoading) return;
    setCodeLoading(true);
    try {
      const detail = await fetchAdminVibeAppCode(app._id);
      setCodeDetail(detail);

      // 初始化前端代码
      setFrontendCode({
        jsx:  detail.codeParts.jsx ?? '',
        html: detail.codeParts.html ?? '',
        css:  detail.codeParts.css ?? '',
        js:   detail.codeParts.js ?? '',
      });

      // 初始化后端代码
      if (detail.serverParts) {
        setBackendCode({
          model:       detail.serverParts.model ?? '',
          route:       detail.serverParts.route ?? '',
          service:     detail.serverParts.service ?? '',
          middleware:   detail.serverParts.middleware ?? '',
          envTemplate: detail.serverParts.envTemplate ?? '',
        });
      }

      // 初始化数据库代码
      if (detail.dbSchema) {
        setDbCode({
          collections: detail.dbSchema.collections ?? '',
          indexes:     detail.dbSchema.indexes ?? '',
          seedData:    detail.dbSchema.seedData ?? '',
        });
      }

      // 初始化权限配置
      if (detail.menuConfig) {
        setPermCode({
          menus:       detail.menuConfig.menus ?? '',
          permissions: detail.menuConfig.permissions ?? '',
          roles:       detail.menuConfig.roles ?? '',
        });
      }

      setCodeLoaded(true);
    } catch (e: any) {
      setError('加载代码失败：' + (e?.message ?? '未知错误'));
    } finally {
      setCodeLoading(false);
    }
  }, [app._id, codeLoaded, codeLoading]);

  // 切换到代码相关 Tab 时自动加载
  useEffect(() => {
    if (activeTab !== 'info') loadCodeIfNeeded();
  }, [activeTab, loadCodeIfNeeded]);

  const handleSave = async () => {
    if (!title.trim()) { setError('标题不能为空'); return; }
    setSaving(true);
    setError('');
    try {
      const updateData: Record<string, unknown> = { title, description, author, isActive };

      // 如果代码已加载且有修改，一并保存
      if (codeLoaded) {
        updateData.codeParts = {
          ...(codeDetail?.codeParts ?? {}),
          jsx:  frontendCode.jsx,
          html: frontendCode.html,
          css:  frontendCode.css,
          js:   frontendCode.js,
        };

        if (isFullStack) {
          updateData.serverParts = { ...backendCode };
          updateData.dbSchema    = { ...dbCode };
          updateData.menuConfig  = { ...permCode };
        }
      }

      await onSave(app._id, updateData as Partial<VibeAppAdmin>);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && e.ctrlKey) handleSave();
  };

  // Tab 配置
  const tabs: Array<{ key: EditTab; label: string; icon: React.ReactNode; show: boolean }> = [
    { key: 'info',       label: '基本信息', icon: <Pencil className="w-3.5 h-3.5" />,  show: true },
    { key: 'frontend',   label: '前端代码', icon: <Code2 className="w-3.5 h-3.5" />,   show: true },
    { key: 'backend',    label: '后端代码', icon: <Server className="w-3.5 h-3.5" />,   show: isFullStack },
    { key: 'database',   label: '数据库',   icon: <Globe className="w-3.5 h-3.5" />,    show: isFullStack },
    { key: 'permission', label: '权限配置', icon: <Eye className="w-3.5 h-3.5" />,      show: isFullStack },
  ];

  // 前端代码子 Tab 配置
  const frontendSubTabs: Array<{ key: FrontendSubTab; label: string; color: string }> = [
    { key: 'jsx',  label: 'JSX',  color: 'text-cyan-500' },
    { key: 'html', label: 'HTML', color: 'text-orange-500' },
    { key: 'css',  label: 'CSS',  color: 'text-sky-500' },
    { key: 'js',   label: 'JS',   color: 'text-yellow-500' },
  ];

  // 后端代码子 Tab 配置
  const backendSubTabs: Array<{ key: BackendSubTab; label: string }> = [
    { key: 'model',       label: 'Model' },
    { key: 'route',       label: 'Route' },
    { key: 'service',     label: 'Service' },
    { key: 'middleware',   label: 'Middleware' },
    { key: 'envTemplate', label: '.env' },
  ];

  // 权限配置子 Tab 配置
  const permSubTabs: Array<{ key: PermissionSubTab; label: string }> = [
    { key: 'menus',       label: '菜单' },
    { key: 'permissions', label: '权限' },
    { key: 'roles',       label: '角色' },
  ];

  /** Monaco 编辑器渲染 */
  const renderMonacoEditor = (value: string, language: string, onChange: (val: string) => void) => (
    <Suspense fallback={
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      </div>
    }>
      <MonacoEditor
        height="100%"
        language={language}
        value={value}
        onChange={(val) => onChange(val ?? '')}
        theme="vs-dark"
        options={{
          fontSize: 13,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          lineNumbers: 'on',
          folding: true,
          automaticLayout: true,
          tabSize: 2,
          formatOnPaste: true,
          padding: { top: 8, bottom: 8 },
        }}
      />
    </Suspense>
  );

  /** 代码加载中占位 */
  const renderCodeLoading = () => (
    <div className="flex items-center justify-center h-full bg-slate-50">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        加载代码中...
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="编辑应用"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-sky-500" />
            <h3 className="text-base font-semibold text-slate-800">
              编辑应用
            </h3>
            {isFullStack && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium">
                全栈
              </span>
            )}
          </div>
          <button
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            onClick={onClose}
            aria-label="关闭"
            tabIndex={0}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab 栏 */}
        <div className="flex items-center gap-0 border-b border-slate-200 px-5 flex-shrink-0 bg-slate-50">
          {tabs.filter((t) => t.show).map((tab) => (
            <button
              key={tab.key}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all',
                activeTab === tab.key
                  ? 'border-sky-500 text-sky-600 bg-white'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              )}
              onClick={() => setActiveTab(tab.key)}
              tabIndex={0}
              aria-label={tab.label}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-5 mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex-shrink-0">
            {error}
          </div>
        )}

        {/* 内容区 */}
        <div className="flex-1 overflow-hidden">

          {/* ── 基本信息 Tab ── */}
          {activeTab === 'info' && (
            <div className="p-5 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">标题 *</label>
                <input
                  type="text"
                  className="input w-full"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-label="应用标题"
                  tabIndex={0}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">作者</label>
                <input
                  type="text"
                  className="input w-full"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  aria-label="作者"
                  tabIndex={0}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">描述</label>
                <textarea
                  className="input w-full resize-none min-h-16 text-sm"
                  value={description}
                  onChange={(e) => setDesc(e.target.value)}
                  aria-label="描述"
                  tabIndex={0}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none" tabIndex={0}>
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-sky-500"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  aria-label="是否上架"
                />
                <span className="text-sm text-slate-600">上架（模板市场可见）</span>
              </label>
            </div>
          )}

          {/* ── 前端代码 Tab ── */}
          {activeTab === 'frontend' && (
            <div className="flex flex-col h-full" style={{ height: 'calc(90vh - 200px)' }}>
              {/* 子 Tab */}
              <div className="flex items-center gap-0 border-b border-slate-200 px-4 flex-shrink-0">
                {frontendSubTabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all',
                      frontendSubTab === tab.key
                        ? `border-current ${tab.color}`
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    )}
                    onClick={() => setFrontendSubTab(tab.key)}
                    tabIndex={0}
                    aria-label={tab.label}
                  >
                    <span className={clsx('w-2 h-2 rounded-full', {
                      'bg-cyan-400':   tab.key === 'jsx',
                      'bg-orange-400': tab.key === 'html',
                      'bg-sky-400':    tab.key === 'css',
                      'bg-yellow-400': tab.key === 'js',
                    })} />
                    {tab.label}
                    {frontendCode[tab.key] && (
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                    )}
                  </button>
                ))}
              </div>
              {/* 编辑器 */}
              <div className="flex-1 overflow-hidden">
                {codeLoading ? renderCodeLoading() : renderMonacoEditor(
                  frontendCode[frontendSubTab],
                  frontendSubTab === 'jsx' ? 'javascript' : frontendSubTab === 'js' ? 'javascript' : frontendSubTab,
                  (val) => setFrontendCode((prev) => ({ ...prev, [frontendSubTab]: val }))
                )}
              </div>
            </div>
          )}

          {/* ── 后端代码 Tab ── */}
          {activeTab === 'backend' && (
            <div className="flex flex-col h-full" style={{ height: 'calc(90vh - 200px)' }}>
              {/* 子 Tab */}
              <div className="flex items-center gap-0 border-b border-slate-200 px-4 flex-shrink-0">
                {backendSubTabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all',
                      backendSubTab === tab.key
                        ? 'border-sky-500 text-sky-600'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    )}
                    onClick={() => setBackendSubTab(tab.key)}
                    tabIndex={0}
                    aria-label={tab.label}
                  >
                    {tab.label}
                    {backendCode[tab.key] && (
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 opacity-50" />
                    )}
                  </button>
                ))}
              </div>
              {/* 编辑器 */}
              <div className="flex-1 overflow-hidden">
                {codeLoading ? renderCodeLoading() : renderMonacoEditor(
                  backendCode[backendSubTab],
                  backendSubTab === 'envTemplate' ? 'ini' : 'typescript',
                  (val) => setBackendCode((prev) => ({ ...prev, [backendSubTab]: val }))
                )}
              </div>
            </div>
          )}

          {/* ── 数据库 Tab ── */}
          {activeTab === 'database' && (
            <div className="flex flex-col h-full" style={{ height: 'calc(90vh - 200px)' }}>
              <div className="px-4 py-2 text-xs text-slate-400 border-b border-slate-200 flex-shrink-0">
                MongoDB Schema 定义（Mongoose Model 代码）
              </div>
              <div className="flex-1 overflow-hidden">
                {codeLoading ? renderCodeLoading() : renderMonacoEditor(
                  dbCode.collections,
                  'typescript',
                  (val) => setDbCode((prev) => ({ ...prev, collections: val }))
                )}
              </div>
            </div>
          )}

          {/* ── 权限配置 Tab ── */}
          {activeTab === 'permission' && (
            <div className="flex flex-col h-full" style={{ height: 'calc(90vh - 200px)' }}>
              {/* 子 Tab */}
              <div className="flex items-center gap-0 border-b border-slate-200 px-4 flex-shrink-0">
                {permSubTabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all',
                      permSubTab === tab.key
                        ? 'border-violet-500 text-violet-600'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    )}
                    onClick={() => setPermSubTab(tab.key)}
                    tabIndex={0}
                    aria-label={tab.label}
                  >
                    {tab.label}
                    {permCode[tab.key] && (
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 opacity-50" />
                    )}
                  </button>
                ))}
              </div>
              {/* 编辑器 */}
              <div className="flex-1 overflow-hidden">
                {codeLoading ? renderCodeLoading() : renderMonacoEditor(
                  permCode[permSubTab],
                  'json',
                  (val) => setPermCode((prev) => ({ ...prev, [permSubTab]: val }))
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-slate-200 flex-shrink-0">
          <span className="text-[10px] text-slate-400">
            Ctrl+Enter 快速保存 · Esc 关闭
          </span>
          <div className="flex gap-2">
            <button
              className="btn-ghost"
              onClick={onClose}
              aria-label="取消"
              tabIndex={0}
            >
              <X className="w-4 h-4" />
              取消
            </button>
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving}
              aria-label="保存"
              tabIndex={0}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 子组件：复制按钮 ─────────────────────────────────────────────────────────

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <button
      className="p-1 rounded text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-colors"
      onClick={handleCopy}
      aria-label="复制链接"
      tabIndex={0}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

// ─── 子组件：应用行 ────────────────────────────────────────────────────────────

interface AppRowProps {
  app: VibeAppAdmin;
  onEdit: (a: VibeAppAdmin) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onDeploy: (id: string) => void;
  onUndeploy: (id: string) => void;
  deployStatus?: RuntimeStatus;
  deploying?: boolean;
}

const AppRow = ({ app, onEdit, onDelete, onToggleActive, onDeploy, onUndeploy, deployStatus, deploying }: AppRowProps) => {
  const previewUrl = `${PREVIEW_BASE_URL}/preview/${app._id}`;

  const handleEdit         = () => onEdit(app);
  const handleDelete       = () => onDelete(app._id);
  const handleToggleActive = () => onToggleActive(app._id, !app.isActive);

  return (
    <tr className={clsx('border-b border-slate-100 hover:bg-slate-50 transition-colors', !app.isActive && 'opacity-50')}>
      {/* 标题 + 描述 */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="font-medium text-slate-800 text-sm truncate max-w-48">{app.title}</div>
          {app.codeParts?.isReact && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-600 border border-cyan-200 flex-shrink-0">
              React
            </span>
          )}
          {app.isFullStack && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 flex-shrink-0">
              全栈
            </span>
          )}
          {deployStatus?.deployed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-200 flex-shrink-0 animate-pulse">
              ● 已部署
            </span>
          )}
        </div>
        {app.description && (
          <div className="text-xs text-slate-400 truncate max-w-48 mt-0.5">{app.description}</div>
        )}
      </td>

      {/* 作者 */}
      <td className="px-4 py-3 text-sm text-slate-500">{app.author}</td>

      {/* 发布时间 */}
      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
        {new Date(app.publishedAt).toLocaleString('zh-CN', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit',
        })}
      </td>

      {/* 发布地址 */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sky-500 hover:text-sky-600 hover:underline truncate max-w-40"
            aria-label="打开预览"
            tabIndex={0}
          >
            /preview/{app._id.slice(-8)}
          </a>
          <CopyButton text={previewUrl} />
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-colors"
            aria-label="在新窗口打开"
            tabIndex={0}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </td>

      {/* 状态 */}
      <td className="px-4 py-3">
        <span className={clsx(
          'badge border text-xs',
          app.isActive
            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
            : 'bg-slate-100 text-slate-400 border-slate-200'
        )}>
          {app.isActive ? '已上架' : '已下架'}
        </span>
      </td>

      {/* 操作 */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            className={clsx(
              'p-1.5 rounded-lg transition-colors',
              app.isActive
                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
            )}
            onClick={handleToggleActive}
            onKeyDown={(e) => e.key === 'Enter' && handleToggleActive()}
            aria-label={app.isActive ? '下架' : '上架'}
            tabIndex={0}
          >
            {app.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
            onClick={handleEdit}
            onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
            aria-label="编辑"
            tabIndex={0}
          >
            <Pencil className="w-4 h-4" />
          </button>
          {/* 全栈项目：部署/卸载按钮 */}
          {app.isFullStack && (
            deploying ? (
              <span className="p-1.5"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></span>
            ) : deployStatus?.deployed ? (
              <button
                className="p-1.5 rounded-lg text-emerald-500 hover:text-red-500 hover:bg-red-50 transition-colors"
                onClick={() => onUndeploy(app._id)}
                aria-label="卸载后端"
                title="卸载后端服务"
                tabIndex={0}
              >
                <Power className="w-4 h-4" />
              </button>
            ) : (
              <button
                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                onClick={() => onDeploy(app._id)}
                aria-label="部署后端"
                title="部署后端服务"
                tabIndex={0}
              >
                <Rocket className="w-4 h-4" />
              </button>
            )
          )}
          <button
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            onClick={handleDelete}
            onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
            aria-label="删除"
            tabIndex={0}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

// ─── 主页面 ────────────────────────────────────────────────────────────────────

const VibeAppsAdminPage = () => {
  const { message, modal } = App.useApp();
  const [apps, setApps]             = useState<VibeAppAdmin[]>([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [editTarget, setEditTarget] = useState<VibeAppAdmin | null>(null);
  const [deployStatuses, setDeployStatuses] = useState<Record<string, RuntimeStatus>>({});
  const [deployingApps, setDeployingApps] = useState<Set<string>>(new Set());

  const LIMIT = 20;
  const totalPages = Math.ceil(total / LIMIT);

  const loadApps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminVibeApps({
        page,
        limit: LIMIT,
        search: search || undefined,
        isActive: filterStatus || undefined,
      });
      setApps(res.data);
      setTotal(res.pagination.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, search]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  // 搜索时重置页码
  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleFilterStatus = (status: string) => {
    setPage(1);
    setFilterStatus(status);
  };

  const handleSave = async (id: string, data: Partial<VibeAppAdmin>) => {
    try {
      await updateAdminVibeApp(id, data);
      message.success('保存成功');
      await loadApps();
    } catch {
      message.error('保存失败');
    }
  };

  const handleDelete = (id: string) => {
    modal.confirm({
      title: '确认删除',
      content: '确认删除该应用？此操作不可恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteAdminVibeApp(id);
          message.success('删除成功');
          await loadApps();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  // 加载应用列表后，查询全栈应用的部署状态
  useEffect(() => {
    const fullStackApps = apps.filter(a => a.isFullStack);
    if (fullStackApps.length === 0) return;
    fullStackApps.forEach(async (app) => {
      try {
        const status = await fetchVibeAppRuntimeStatus(app._id);
        setDeployStatuses(prev => ({ ...prev, [app._id]: status }));
      } catch {
        setDeployStatuses(prev => ({ ...prev, [app._id]: { deployed: false, appId: app._id } }));
      }
    });
  }, [apps]);

  const handleDeploy = async (id: string) => {
    setDeployingApps(prev => new Set(prev).add(id));
    try {
      const result = await deployVibeAppRuntime(id);
      message.success(`后端部署成功，创建了 ${result.collections.length} 个数据集合`);
      setDeployStatuses(prev => ({
        ...prev,
        [id]: { deployed: true, appId: id, basePath: result.basePath, deployedAt: result.deployedAt },
      }));
    } catch (err: any) {
      message.error(`部署失败: ${err?.response?.data?.message || err?.message || '未知错误'}`);
    } finally {
      setDeployingApps(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const handleUndeploy = (id: string) => {
    modal.confirm({
      title: '确认卸载',
      content: '卸载后端服务后，前端页面将无法调用真实 API。确认卸载？',
      okText: '卸载',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setDeployingApps(prev => new Set(prev).add(id));
        try {
          await undeployVibeAppRuntime(id);
          message.success('后端已卸载');
          setDeployStatuses(prev => ({ ...prev, [id]: { deployed: false, appId: id } }));
        } catch (err: any) {
          message.error(`卸载失败: ${err?.message || '未知错误'}`);
        } finally {
          setDeployingApps(prev => { const s = new Set(prev); s.delete(id); return s; });
        }
      },
    });
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateAdminVibeApp(id, { isActive });
      message.success(isActive ? '已上架' : '已下架');
      setApps((prev) => prev.map((a) => a._id === id ? { ...a, isActive } : a));
    } catch {
      message.error('操作失败');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Globe className="w-6 h-6 text-violet-600" />
            已发布应用管理
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            管理所有通过 Vibe Coding 发布的应用，支持查看预览地址、上下架、编辑和删除
          </p>
        </div>
        <button
          className="btn-ghost text-sm"
          onClick={loadApps}
          disabled={loading}
          aria-label="刷新"
          tabIndex={0}
        >
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          刷新
        </button>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* 状态过滤 */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key || 'all'}
              className={clsx(
                'px-3 py-1.5 text-xs rounded-md transition-colors font-medium whitespace-nowrap',
                filterStatus === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
              onClick={() => handleFilterStatus(key)}
              onKeyDown={(e) => e.key === 'Enter' && handleFilterStatus(key)}
              aria-label={`过滤：${label}`}
              tabIndex={0}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* 搜索框 */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              className="input pl-8 pr-3 py-1.5 text-sm w-52"
              placeholder="搜索标题、作者、描述..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              aria-label="搜索应用"
              tabIndex={0}
            />
          </div>
          <button
            className="btn-primary text-sm py-1.5"
            onClick={handleSearch}
            aria-label="搜索"
            tabIndex={0}
          >
            搜索
          </button>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="text-xs text-slate-400">
        共 <span className="font-medium text-slate-600">{total}</span> 个应用
        {filterStatus && (
          <span>，状态：<span className="font-medium text-slate-600">
            {STATUS_FILTERS.find((f) => f.key === filterStatus)?.label}
          </span></span>
        )}
        {search && <span>，搜索：<span className="font-medium text-slate-600">{search}</span></span>}
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无已发布应用</p>
            <p className="text-xs mt-1">用户在 Vibe Coding 页面发布应用后会显示在这里</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">标题</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">作者</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">发布时间</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">发布地址</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">操作</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => (
                  <AppRow
                    key={app._id}
                    app={app}
                    onEdit={setEditTarget}
                    onDelete={handleDelete}
                    onToggleActive={handleToggleActive}
                    onDeploy={handleDeploy}
                    onUndeploy={handleUndeploy}
                    deployStatus={deployStatuses[app._id]}
                    deploying={deployingApps.has(app._id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            第 {page} / {totalPages} 页
          </span>
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost text-sm py-1.5 px-3"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="上一页"
              tabIndex={0}
            >
              <ChevronLeft className="w-4 h-4" />
              上一页
            </button>
            <button
              className="btn-primary text-sm py-1.5 px-3"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="下一页"
              tabIndex={0}
            >
              下一页
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editTarget && (
        <EditModal
          app={editTarget}
          onSave={handleSave}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
};

export default VibeAppsAdminPage;
