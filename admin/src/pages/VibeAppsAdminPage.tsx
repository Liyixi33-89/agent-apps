import { useState, useEffect, useCallback } from 'react';
import {
  Globe, Search, Trash2, Pencil, Save, X,
  Loader2, RefreshCw, Eye, EyeOff, ExternalLink,
  ChevronLeft, ChevronRight, Copy, Check,
} from 'lucide-react';
import clsx from 'clsx';
import { App } from 'antd';
import {
  fetchAdminVibeApps, updateAdminVibeApp, deleteAdminVibeApp,
  type VibeAppAdmin,
} from '../api';

// ─── 常量 ──────────────────────────────────────────────────────────────────────

/** 前端预览页基础地址（web 端口） */
const PREVIEW_BASE_URL = window.location.origin.replace(':5174', ':5173');

const STATUS_FILTERS = [
  { key: '',      label: '全部' },
  { key: 'true',  label: '已上架' },
  { key: 'false', label: '已下架' },
];

// ─── 子组件：编辑弹窗 ─────────────────────────────────────────────────────────

interface EditModalProps {
  app: VibeAppAdmin;
  onSave: (id: string, data: Partial<VibeAppAdmin>) => Promise<void>;
  onClose: () => void;
}

const EditModal = ({ app, onSave, onClose }: EditModalProps) => {
  const [title, setTitle]       = useState(app.title);
  const [description, setDesc]  = useState(app.description);
  const [author, setAuthor]     = useState(app.author);
  const [isActive, setIsActive] = useState(app.isActive);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const handleSave = async () => {
    if (!title.trim()) { setError('标题不能为空'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(app._id, { title, description, author, isActive });
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="编辑应用"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Pencil className="w-4 h-4 text-sky-500" />
            编辑应用信息
          </h3>
          <button
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            onClick={onClose}
            aria-label="关闭"
            tabIndex={0}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="space-y-3">
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

        <div className="flex gap-2 pt-1">
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
          <button
            className="btn-ghost"
            onClick={onClose}
            aria-label="取消"
            tabIndex={0}
          >
            <X className="w-4 h-4" />
            取消
          </button>
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
}

const AppRow = ({ app, onEdit, onDelete, onToggleActive }: AppRowProps) => {
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
