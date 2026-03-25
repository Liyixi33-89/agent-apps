import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Plus, Pencil, Trash2, RefreshCw,
  ChevronDown, ChevronUp, Save, X, Loader2, Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import {
  fetchAdminPrompts, createAdminPrompt, updateAdminPrompt,
  deleteAdminPrompt, seedAdminPrompts,
  type SystemPrompt,
} from '../api';

// ─── 常量 ──────────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<SystemPrompt['category'], { label: string; color: string }> = {
  vibe:     { label: 'Vibe Coding', color: 'bg-violet-50 text-violet-600 border-violet-200' },
  pipeline: { label: 'Pipeline',    color: 'bg-sky-50 text-sky-600 border-sky-200' },
};

// ─── 子组件：提示词编辑器 ──────────────────────────────────────────────────────

interface PromptEditorProps {
  initial?: Partial<SystemPrompt>;
  onSave: (data: Omit<SystemPrompt, '_id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
}

const PromptEditor = ({ initial, onSave, onCancel }: PromptEditorProps) => {
  const [key, setKey]             = useState(initial?.key ?? '');
  const [category, setCategory]   = useState<SystemPrompt['category']>(initial?.category ?? 'vibe');
  const [name, setName]           = useState(initial?.name ?? '');
  const [description, setDesc]    = useState(initial?.description ?? '');
  const [content, setContent]     = useState(initial?.content ?? '');
  const [isActive, setIsActive]   = useState(initial?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const isEdit = Boolean(initial?.key);

  const handleSave = async () => {
    if (!key.trim() || !name.trim() || !content.trim()) {
      setError('key、名称、内容为必填项');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ key, category, name, description, content, isActive, sortOrder });
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) handleSave();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">
        {isEdit ? '✏️ 编辑提示词' : '➕ 新建提示词'}
      </h3>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Key（唯一标识）</label>
          <input
            type="text"
            className="input w-full font-mono text-sm"
            placeholder="e.g. vibe_chat"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={isEdit}
            aria-label="提示词 Key"
            tabIndex={0}
          />
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">分类</label>
          <select
            className="input w-full"
            value={category}
            onChange={(e) => setCategory(e.target.value as SystemPrompt['category'])}
            aria-label="分类"
            tabIndex={0}
          >
            <option value="vibe">Vibe Coding</option>
            <option value="pipeline">Pipeline</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">名称</label>
          <input
            type="text"
            className="input w-full"
            placeholder="显示名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="名称"
            tabIndex={0}
          />
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">排序权重</label>
          <input
            type="number"
            className="input w-full"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            aria-label="排序权重"
            tabIndex={0}
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-500 mb-1 block">描述说明</label>
        <input
          type="text"
          className="input w-full"
          placeholder="简要说明该提示词的用途"
          value={description}
          onChange={(e) => setDesc(e.target.value)}
          aria-label="描述"
          tabIndex={0}
        />
      </div>

      <div>
        <label className="text-xs text-slate-500 mb-1 block">
          提示词内容
          <span className="text-slate-300 ml-2 font-normal">（Ctrl+Enter 快速保存）</span>
        </label>
        <textarea
          className="input w-full font-mono text-xs resize-y min-h-48"
          placeholder="在此输入系统提示词..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="提示词内容"
          tabIndex={0}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none" tabIndex={0}>
        <input
          type="checkbox"
          className="w-4 h-4 accent-sky-500"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          aria-label="是否启用"
        />
        <span className="text-sm text-slate-600">启用此提示词</span>
      </label>

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
          onClick={onCancel}
          aria-label="取消"
          tabIndex={0}
        >
          <X className="w-4 h-4" />
          取消
        </button>
      </div>
    </div>
  );
};

// ─── 子组件：提示词卡片 ────────────────────────────────────────────────────────

interface PromptCardProps {
  prompt: SystemPrompt;
  onEdit: (p: SystemPrompt) => void;
  onDelete: (key: string) => void;
}

const PromptCard = ({ prompt, onEdit, onDelete }: PromptCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORY_LABELS[prompt.category];

  const handleToggleExpand = () => setExpanded((v) => !v);
  const handleEdit = () => onEdit(prompt);
  const handleDelete = () => onDelete(prompt.key);

  return (
    <div className={clsx('card transition-all', !prompt.isActive && 'opacity-50')}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx('badge border text-xs', cat.color)}>{cat.label}</span>
            <code className="text-xs text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded">{prompt.key}</code>
            {!prompt.isActive && (
              <span className="badge bg-slate-100 text-slate-400 text-xs border border-slate-200">已禁用</span>
            )}
          </div>
          <h3 className="font-semibold text-slate-800 text-sm mt-1.5">{prompt.name}</h3>
          {prompt.description && (
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{prompt.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
            onClick={handleToggleExpand}
            onKeyDown={(e) => e.key === 'Enter' && handleToggleExpand()}
            aria-label={expanded ? '收起内容' : '展开内容'}
            tabIndex={0}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
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
      </div>

      {expanded && (
        <pre className="mt-3 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 font-mono whitespace-pre-wrap overflow-x-auto border border-slate-200 max-h-64 overflow-y-auto">
          {prompt.content}
        </pre>
      )}
    </div>
  );
};

// ─── 主页面 ────────────────────────────────────────────────────────────────────

const PromptsAdminPage = () => {
  const [prompts, setPrompts]       = useState<SystemPrompt[]>([]);
  const [loading, setLoading]       = useState(false);
  const [filterCat, setFilterCat]   = useState<'all' | 'vibe' | 'pipeline'>('all');
  const [editTarget, setEditTarget] = useState<SystemPrompt | null | 'new'>(null);
  const [seeding, setSeeding]       = useState(false);
  const [seedMsg, setSeedMsg]       = useState('');

  const loadPrompts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchAdminPrompts(filterCat === 'all' ? undefined : filterCat);
      setPrompts(data);
      return data;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filterCat]);

  // 首次加载：若数据库无提示词则自动初始化默认数据
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const data = await fetchAdminPrompts(undefined);
        if (data.length === 0) {
          await seedAdminPrompts(false);
          const seeded = await fetchAdminPrompts(filterCat === 'all' ? undefined : filterCat);
          setPrompts(seeded);
        } else {
          const filtered = filterCat === 'all' ? data : data.filter((p) => p.category === filterCat);
          setPrompts(filtered);
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 分类切换时重新加载
  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const handleSave = async (data: Omit<SystemPrompt, '_id' | 'createdAt' | 'updatedAt'>) => {
    if (editTarget === 'new') {
      await createAdminPrompt(data);
    } else if (editTarget) {
      const { key, ...rest } = data;
      await updateAdminPrompt(key, rest);
    }
    setEditTarget(null);
    await loadPrompts();
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm(`确认删除提示词 "${key}"？`)) return;
    await deleteAdminPrompt(key);
    await loadPrompts();
  };

  const handleSeed = async (force: boolean) => {
    setSeeding(true);
    setSeedMsg('');
    try {
      const results = await seedAdminPrompts(force);
      const created = results.filter((r) => r.action === 'created').length;
      const reset   = results.filter((r) => r.action === 'reset').length;
      const skipped = results.filter((r) => r.action === 'skipped').length;
      setSeedMsg(`✅ 完成：新建 ${created} 条，重置 ${reset} 条，跳过 ${skipped} 条`);
      await loadPrompts();
    } catch {
      setSeedMsg('❌ 初始化失败');
    } finally {
      setSeeding(false);
    }
  };

  const filtered = filterCat === 'all' ? prompts : prompts.filter((p) => p.category === filterCat);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* 头部 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-sky-600" />
            系统提示词管理
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            管理 Vibe Coding 和 Pipeline 各步骤的系统提示词，修改后实时生效
          </p>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* 分类过滤 */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['all', 'vibe', 'pipeline'] as const).map((cat) => (
            <button
              key={cat}
              className={clsx(
                'px-3 py-1.5 text-xs rounded-md transition-colors font-medium',
                filterCat === cat ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
              onClick={() => setFilterCat(cat)}
              onKeyDown={(e) => e.key === 'Enter' && setFilterCat(cat)}
              aria-label={`过滤：${cat}`}
              tabIndex={0}
            >
              {cat === 'all' ? '全部' : cat === 'vibe' ? 'Vibe Coding' : 'Pipeline'}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* 初始化 / 重置 */}
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost text-xs"
            onClick={() => handleSeed(false)}
            disabled={seeding}
            aria-label="初始化默认提示词"
            tabIndex={0}
          >
            {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            初始化默认
          </button>
          <button
            className="btn-ghost text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
            onClick={() => handleSeed(true)}
            disabled={seeding}
            aria-label="强制重置所有提示词"
            tabIndex={0}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            强制重置
          </button>
        </div>

        {/* 新建 */}
        <button
          className="btn-primary text-sm"
          onClick={() => setEditTarget('new')}
          onKeyDown={(e) => e.key === 'Enter' && setEditTarget('new')}
          aria-label="新建提示词"
          tabIndex={0}
        >
          <Plus className="w-4 h-4" />
          新建
        </button>
      </div>

      {/* 种子消息 */}
      {seedMsg && (
        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
          {seedMsg}
        </div>
      )}

      {/* 编辑器 */}
      {editTarget !== null && (
        <PromptEditor
          initial={editTarget === 'new' ? undefined : editTarget}
          onSave={handleSave}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {/* 列表 */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">暂无提示词</p>
          <p className="text-xs mt-1">点击「初始化默认」导入内置提示词，或点击「新建」手动创建</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <PromptCard
              key={p._id}
              prompt={p}
              onEdit={(target) => setEditTarget(target)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PromptsAdminPage;
