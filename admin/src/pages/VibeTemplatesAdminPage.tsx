import { useState, useEffect, useCallback } from 'react';
import {
  LayoutTemplate, Search, Trash2, Pencil, Save, X,
  Loader2, RefreshCw, Eye, EyeOff, Tag, ChevronLeft, ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import {
  fetchAdminVibeTemplates, updateAdminVibeTemplate, deleteAdminVibeTemplate,
  type VibeTemplateAdmin,
} from '../api';

// ─── 常量 ──────────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  '官网/落地页':   'bg-violet-50 text-violet-600 border-violet-200',
  '后台管理':      'bg-sky-50 text-sky-600 border-sky-200',
  '数据可视化':    'bg-emerald-50 text-emerald-600 border-emerald-200',
  '电商':          'bg-orange-50 text-orange-600 border-orange-200',
  '工具/应用':     'bg-amber-50 text-amber-600 border-amber-200',
  '游戏':          'bg-pink-50 text-pink-600 border-pink-200',
  '其他':          'bg-slate-50 text-slate-500 border-slate-200',
};

const getCategoryColor = (cat: string) =>
  CATEGORY_COLORS[cat] ?? 'bg-slate-50 text-slate-500 border-slate-200';

// ─── 子组件：编辑弹窗 ─────────────────────────────────────────────────────────

interface EditModalProps {
  template: VibeTemplateAdmin;
  onSave: (id: string, data: Partial<VibeTemplateAdmin>) => Promise<void>;
  onClose: () => void;
}

const EditModal = ({ template, onSave, onClose }: EditModalProps) => {
  const [title, setTitle]           = useState(template.title);
  const [description, setDesc]      = useState(template.description);
  const [category, setCategory]     = useState(template.category);
  const [author, setAuthor]         = useState(template.author);
  const [tagsInput, setTagsInput]   = useState(template.tags.join(', '));
  const [isActive, setIsActive]     = useState(template.isActive);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const handleSave = async () => {
    if (!title.trim()) { setError('标题不能为空'); return; }
    setSaving(true);
    setError('');
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
      await onSave(template._id, { title, description, category, author, tags, isActive });
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
      aria-label="编辑模板"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Pencil className="w-4 h-4 text-sky-500" />
            编辑模板信息
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
              aria-label="模板标题"
              tabIndex={0}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">分类</label>
              <select
                className="input w-full"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="分类"
                tabIndex={0}
              >
                {Object.keys(CATEGORY_COLORS).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
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

          <div>
            <label className="text-xs text-slate-500 mb-1 block">标签（逗号分隔）</label>
            <input
              type="text"
              className="input w-full"
              placeholder="e.g. 响应式, 深色主题, ECharts"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              aria-label="标签"
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
            <span className="text-sm text-slate-600">上架（前端可见）</span>
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

// ─── 子组件：模板行 ────────────────────────────────────────────────────────────

interface TemplateRowProps {
  template: VibeTemplateAdmin;
  onEdit: (t: VibeTemplateAdmin) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}

const TemplateRow = ({ template, onEdit, onDelete, onToggleActive }: TemplateRowProps) => {
  const handleEdit         = () => onEdit(template);
  const handleDelete       = () => onDelete(template._id);
  const handleToggleActive = () => onToggleActive(template._id, !template.isActive);

  return (
    <tr className={clsx('border-b border-slate-100 hover:bg-slate-50 transition-colors', !template.isActive && 'opacity-50')}>
      {/* 标题 + 描述 */}
      <td className="px-4 py-3">
        <div className="font-medium text-slate-800 text-sm truncate max-w-48">{template.title}</div>
        {template.description && (
          <div className="text-xs text-slate-400 truncate max-w-48 mt-0.5">{template.description}</div>
        )}
      </td>

      {/* 分类 */}
      <td className="px-4 py-3">
        <span className={clsx('badge border text-xs', getCategoryColor(template.category))}>
          {template.category}
        </span>
      </td>

      {/* 作者 */}
      <td className="px-4 py-3 text-sm text-slate-500">{template.author}</td>

      {/* 标签 */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1 max-w-40">
          {template.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-0.5 text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
              <Tag className="w-2.5 h-2.5" />
              {tag}
            </span>
          ))}
          {template.tags.length > 3 && (
            <span className="text-xs text-slate-400">+{template.tags.length - 3}</span>
          )}
        </div>
      </td>

      {/* 统计 */}
      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
        <div>👁 {template.viewCount}</div>
        <div>❤️ {template.likeCount}</div>
      </td>

      {/* 发布时间 */}
      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
        {new Date(template.publishedAt).toLocaleDateString('zh-CN')}
      </td>

      {/* 状态 */}
      <td className="px-4 py-3">
        <span className={clsx(
          'badge border text-xs',
          template.isActive
            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
            : 'bg-slate-100 text-slate-400 border-slate-200'
        )}>
          {template.isActive ? '已上架' : '已下架'}
        </span>
      </td>

      {/* 操作 */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            className={clsx(
              'p-1.5 rounded-lg transition-colors',
              template.isActive
                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
            )}
            onClick={handleToggleActive}
            onKeyDown={(e) => e.key === 'Enter' && handleToggleActive()}
            aria-label={template.isActive ? '下架' : '上架'}
            tabIndex={0}
          >
            {template.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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

const VibeTemplatesAdminPage = () => {
  const [templates, setTemplates]   = useState<VibeTemplateAdmin[]>([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterCat, setFilterCat]   = useState('');
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [editTarget, setEditTarget] = useState<VibeTemplateAdmin | null>(null);

  const LIMIT = 20;
  const totalPages = Math.ceil(total / LIMIT);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminVibeTemplates({
        page,
        limit: LIMIT,
        category: filterCat || undefined,
        search: search || undefined,
      });
      setTemplates(res.data);
      setTotal(res.pagination.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, filterCat, search]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // 搜索时重置页码
  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleFilterCat = (cat: string) => {
    setPage(1);
    setFilterCat(cat);
  };

  const handleSave = async (id: string, data: Partial<VibeTemplateAdmin>) => {
    await updateAdminVibeTemplate(id, data);
    await loadTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确认删除该模板？此操作不可恢复。')) return;
    await deleteAdminVibeTemplate(id);
    await loadTemplates();
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await updateAdminVibeTemplate(id, { isActive });
    setTemplates((prev) => prev.map((t) => t._id === id ? { ...t, isActive } : t));
  };

  const categories = ['', ...Object.keys(CATEGORY_COLORS)];

  return (
    <div className="p-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <LayoutTemplate className="w-6 h-6 text-sky-600" />
            模板市场管理
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            管理用户发布的 Vibe Coding 模板，支持上下架、编辑信息和删除
          </p>
        </div>
        <button
          className="btn-ghost text-sm"
          onClick={loadTemplates}
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
        {/* 分类过滤 */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat || 'all'}
              className={clsx(
                'px-3 py-1.5 text-xs rounded-md transition-colors font-medium whitespace-nowrap',
                filterCat === cat ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
              onClick={() => handleFilterCat(cat)}
              onKeyDown={(e) => e.key === 'Enter' && handleFilterCat(cat)}
              aria-label={`过滤：${cat || '全部'}`}
              tabIndex={0}
            >
              {cat || '全部'}
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
              placeholder="搜索标题、描述、标签..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              aria-label="搜索模板"
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
        共 <span className="font-medium text-slate-600">{total}</span> 个模板
        {filterCat && <span>，分类：<span className="font-medium text-slate-600">{filterCat}</span></span>}
        {search && <span>，搜索：<span className="font-medium text-slate-600">{search}</span></span>}
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <LayoutTemplate className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无模板</p>
            <p className="text-xs mt-1">用户在 Vibe Coding 页面发布模板后会显示在这里</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">标题</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">分类</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">作者</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">标签</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">统计</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">发布时间</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">操作</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <TemplateRow
                    key={t._id}
                    template={t}
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
          template={editTarget}
          onSave={handleSave}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
};

export default VibeTemplatesAdminPage;
