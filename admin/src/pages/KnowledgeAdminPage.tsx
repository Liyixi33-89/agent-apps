import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { fetchAdminKnowledge, createKnowledge, deleteKnowledge } from '../api';

interface KnowledgeItem {
  _id: string;
  title: { zh: string; en: string };
  description: { zh: string; en: string };
  sourceType: string;
  categoryKey?: string;
  tags: string[];
  stats: { chunkCount: number; wordCount: number };
  createdAt: string;
}

const KnowledgeAdminPage = () => {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    titleZh: '', titleEn: '', content: '',
    sourceType: 'text' as 'markdown' | 'text' | 'url',
    categoryKey: '', tags: '', translate: true
  });

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAdminKnowledge({ page, limit: 20 });
      setItems(result.data);
      setTotal(result.pagination.total);
    } catch (err) {
      console.error('Failed to load knowledge', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titleZh || !form.content) return;
    setCreating(true);
    try {
      await createKnowledge({
        titleZh: form.titleZh,
        titleEn: form.titleEn || form.titleZh,
        content: form.content,
        sourceType: form.sourceType,
        categoryKey: form.categoryKey || undefined,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()) : [],
        translate: form.translate
      });
      setShowCreate(false);
      setForm({ titleZh: '', titleEn: '', content: '', sourceType: 'text', categoryKey: '', tags: '', translate: true });
      await loadItems();
    } catch (err) {
      console.error('Create failed', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此知识库条目？')) return;
    try {
      await deleteKnowledge(id);
      await loadItems();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-emerald-600" />
          知识库管理
          <span className="text-sm font-normal text-slate-400 ml-2">共 {total} 条</span>
        </h1>
        <button className="btn-primary" onClick={() => setShowCreate(true)} aria-label="新建知识条目">
          <Plus className="w-4 h-4" />
          新建条目
        </button>
      </div>

      {/* 创建弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">新建知识库条目</h2>
              <button className="btn-ghost p-1" onClick={() => setShowCreate(false)} aria-label="关闭">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">标题（中文）*</label>
                <input className="input" value={form.titleZh} onChange={(e) => setForm({ ...form, titleZh: e.target.value })} required aria-label="中文标题" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">标题（英文）</label>
                <input className="input" value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} aria-label="英文标题" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">内容 *</label>
                <textarea className="input resize-none min-h-32" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required aria-label="内容" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">类型</label>
                  <select className="input" value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value as any })} aria-label="来源类型">
                    <option value="text">文本</option>
                    <option value="markdown">Markdown</option>
                    <option value="url">URL</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">分类</label>
                  <input className="input" value={form.categoryKey} onChange={(e) => setForm({ ...form, categoryKey: e.target.value })} placeholder="engineering" aria-label="分类" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">标签（逗号分隔）</label>
                <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="ai, coding, react" aria-label="标签" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="translate" checked={form.translate} onChange={(e) => setForm({ ...form, translate: e.target.checked })} className="rounded accent-sky-500" />
                <label htmlFor="translate" className="text-sm text-slate-600">自动翻译（中英互译）</label>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={creating}>
                  {creating ? '创建中...' : '创建'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 列表 */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">标题</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">类型</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">分类</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">块数</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">创建时间</th>
                <th className="text-right px-4 py-3 text-xs text-slate-500 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : items.map((item) => (
                <tr key={item._id} className="table-row">
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-700 font-medium">{item.title.zh || item.title.en}</div>
                    <div className="text-xs text-slate-400 truncate max-w-48">{item.title.en}</div>
                  </td>
                  <td className="px-4 py-3"><span className="badge bg-slate-100 text-slate-500">{item.sourceType}</span></td>
                  <td className="px-4 py-3"><span className="text-xs text-slate-500">{item.categoryKey || '-'}</span></td>
                  <td className="px-4 py-3"><span className="text-xs text-slate-500">{item.stats.chunkCount}</span></td>
                  <td className="px-4 py-3"><span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      onClick={() => handleDelete(item._id)}
                      aria-label="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-400">第 {page} / {totalPages} 页</span>
            <div className="flex gap-2">
              <button className="btn-ghost text-xs px-2 py-1" disabled={page === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="w-4 h-4" /></button>
              <button className="btn-ghost text-xs px-2 py-1" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeAdminPage;
