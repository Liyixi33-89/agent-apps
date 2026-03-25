import { useState, useEffect, useCallback } from 'react';
import { Bot, Search, Trash2, ChevronLeft, ChevronRight, Download, CheckCircle, AlertCircle, Loader2, Languages, Pencil, X, Save } from 'lucide-react';
import { fetchAdminAgents, deleteAgent, triggerAdminIngest, updateAgent } from '../api';

interface IngestResult {
  totalAgents: number;
  totalCategories: number;
  created: number;
  updated: number;
  errors: Array<{ file: string; error: string }>;
}

interface Agent {
  _id: string;
  slug: string;
  categoryKey: string;
  name: { zh: string; en: string };
  description: { zh: string; en: string };
  emoji: string;
  color: string;
  modelPreferences: { primary: string; recommendedProvider: string };
  stats: { wordCount: number };
}

interface EditForm {
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  emoji: string;
}

const AgentsAdminPage = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [translateOnIngest, setTranslateOnIngest] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ nameZh: '', nameEn: '', descZh: '', descEn: '', emoji: '' });
  const [saving, setSaving] = useState(false);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAdminAgents({ page, limit: 20, search: search || undefined });
      setAgents(result.data);
      setTotal(result.pagination.total);
    } catch (err) {
      console.error('Failed to load agents', err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const handleOpenEdit = (agent: Agent) => {
    setEditAgent(agent);
    setEditForm({
      nameZh: agent.name.zh,
      nameEn: agent.name.en,
      descZh: agent.description.zh,
      descEn: agent.description.en,
      emoji: agent.emoji,
    });
  };

  const handleSaveEdit = async () => {
    if (!editAgent) return;
    setSaving(true);
    try {
      await updateAgent(editAgent._id, {
        name: { zh: editForm.nameZh, en: editForm.nameEn },
        description: { zh: editForm.descZh, en: editForm.descEn },
        emoji: editForm.emoji,
      });
      setEditAgent(null);
      await loadAgents();
    } catch (err) {
      console.error('Update failed', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此 Agent？')) return;
    setDeletingId(id);
    try {
      await deleteAgent(id);
      await loadAgents();
    } catch (err) {
      console.error('Delete failed', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleIngest = async () => {
    const translateTip = translateOnIngest ? '\n\n⚠️ 已开启「翻译为中文」，将调用 AI 翻译每个 Agent，耗时较长。' : '';
    if (!confirm(`将扫描项目根目录下所有 .md 文件并导入/更新到数据库，确认继续？${translateTip}`)) return;
    setIngesting(true);
    setIngestResult(null);
    setIngestError(null);
    try {
      const result = await triggerAdminIngest(translateOnIngest);
      setIngestResult(result);
      await loadAgents();
    } catch (err: any) {
      setIngestError(err?.response?.data?.message || err?.message || '导入失败');
    } finally {
      setIngesting(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Bot className="w-6 h-6 text-sky-600" />
          Agent 管理
          <span className="text-sm font-normal text-slate-400 ml-2">共 {total} 个</span>
        </h1>
        <div className="flex items-center gap-3">
          {/* 翻译开关 */}
          <label
            className="flex items-center gap-2 cursor-pointer select-none"
            title="开启后导入时将调用 AI 把英文字段翻译为中文（耗时较长）"
          >
            <div
              role="switch"
              aria-checked={translateOnIngest}
              tabIndex={0}
            className={`relative w-9 h-5 rounded-full transition-colors ${
                translateOnIngest ? 'bg-sky-500' : 'bg-slate-200'
              }`}
              onClick={() => setTranslateOnIngest((v) => !v)}
              onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? setTranslateOnIngest((v) => !v) : null}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  translateOnIngest ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
            <Languages className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500">翻译为中文</span>
          </label>

          <button
            className="btn-primary flex items-center gap-2 text-sm"
            onClick={handleIngest}
            disabled={ingesting}
            aria-label="从 Markdown 文件导入 Agent"
          >
            {ingesting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Download className="w-4 h-4" />}
            {ingesting ? (translateOnIngest ? '导入并翻译中...' : '导入中...') : '从 MD 导入'}
          </button>
        </div>
      </div>

      {/* 导入结果 */}
      {ingestResult && (
        <div className="mb-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="text-emerald-700 font-medium">导入完成</p>
            <p className="text-slate-500 mt-1">
              共处理 <span className="text-slate-800 font-medium">{ingestResult.totalAgents}</span> 个 Agent，
              新建 <span className="text-emerald-600 font-medium">{ingestResult.created}</span>，
              更新 <span className="text-sky-600 font-medium">{ingestResult.updated}</span>，
              分类 <span className="text-slate-800 font-medium">{ingestResult.totalCategories}</span> 个
              {ingestResult.errors.length > 0 && (
                <span className="text-amber-600">，{ingestResult.errors.length} 个文件失败</span>
              )}
            </p>
          </div>
          <button
            className="ml-auto text-slate-400 hover:text-slate-600 text-xs"
            onClick={() => setIngestResult(null)}
            aria-label="关闭导入结果"
          >
            ✕
          </button>
        </div>
      )}

      {/* 导入错误 */}
      {ingestError && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="text-red-600 font-medium">导入失败</p>
            <p className="text-slate-500 mt-1">{ingestError}</p>
          </div>
          <button
            className="ml-auto text-slate-400 hover:text-slate-600 text-xs"
            onClick={() => setIngestError(null)}
            aria-label="关闭错误提示"
          >
            ✕
          </button>
        </div>
      )}

      {/* 搜索 */}
      <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          className="input pl-9 max-w-sm"
          placeholder="搜索 Agent..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          aria-label="搜索 Agent"
        />
      </div>

      {/* 表格 */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">Agent</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">分类</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">模型</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">字数</th>
                <th className="text-right px-4 py-3 text-xs text-slate-500 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : agents.map((agent) => (
                <tr key={agent._id} className="table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{agent.emoji}</span>
                      <div>
                        <div className="text-sm text-slate-700 font-medium">{agent.name.zh || agent.name.en}</div>
                        <div className="text-xs text-slate-400 truncate max-w-48">{agent.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge bg-slate-100 text-slate-500">{agent.categoryKey}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-500">
                      {agent.modelPreferences.primary === 'vision' ? '👁️ Vision' : '💬 Text'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-400">{agent.stats.wordCount.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        onClick={() => handleOpenEdit(agent)}
                        onKeyDown={(e) => e.key === 'Enter' && handleOpenEdit(agent)}
                        aria-label="编辑 Agent"
                        tabIndex={0}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        onClick={() => handleDelete(agent._id)}
                        disabled={deletingId === agent._id}
                        aria-label="删除 Agent"
                        tabIndex={0}
                      >
                        {deletingId === agent._id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-400">第 {page} / {totalPages} 页</span>
            <div className="flex gap-2">
              <button className="btn-ghost text-xs px-2 py-1" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="btn-ghost text-xs px-2 py-1" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 编辑 Agent 弹窗 */}
      {editAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl shadow-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <Pencil className="w-4 h-4 text-amber-500" />
                编辑 Agent
              </h2>
              <button
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                onClick={() => setEditAgent(null)}
                aria-label="关闭"
                tabIndex={0}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Emoji</label>
                  <input
                    type="text"
                    className="input w-16 text-center text-xl"
                    value={editForm.emoji}
                    onChange={(e) => setEditForm({ ...editForm, emoji: e.target.value })}
                    aria-label="Emoji"
                    tabIndex={0}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-500 mb-1 block">Slug</label>
                  <div className="input bg-slate-50 text-slate-400 text-xs font-mono cursor-not-allowed">{editAgent.slug}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">名称（中文）</label>
                  <input
                    type="text"
                    className="input"
                    value={editForm.nameZh}
                    onChange={(e) => setEditForm({ ...editForm, nameZh: e.target.value })}
                    aria-label="中文名称"
                    tabIndex={0}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">名称（英文）</label>
                  <input
                    type="text"
                    className="input"
                    value={editForm.nameEn}
                    onChange={(e) => setEditForm({ ...editForm, nameEn: e.target.value })}
                    aria-label="英文名称"
                    tabIndex={0}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">描述（中文）</label>
                <textarea
                  className="input resize-none min-h-16 text-xs"
                  value={editForm.descZh}
                  onChange={(e) => setEditForm({ ...editForm, descZh: e.target.value })}
                  aria-label="中文描述"
                  tabIndex={0}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">描述（英文）</label>
                <textarea
                  className="input resize-none min-h-16 text-xs"
                  value={editForm.descEn}
                  onChange={(e) => setEditForm({ ...editForm, descEn: e.target.value })}
                  aria-label="英文描述"
                  tabIndex={0}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  className="btn-primary flex-1 justify-center"
                  onClick={handleSaveEdit}
                  disabled={saving}
                  aria-label="保存"
                  tabIndex={0}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => setEditAgent(null)}
                  aria-label="取消"
                  tabIndex={0}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentsAdminPage;