import { useState, useEffect, useCallback } from 'react';
import { Bot, Search, Trash2, ChevronLeft, ChevronRight, Download, CheckCircle, AlertCircle, Loader2, Languages } from 'lucide-react';
import { fetchAdminAgents, deleteAgent, triggerAdminIngest } from '../api';

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
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bot className="w-6 h-6 text-sky-400" />
          Agent 管理
          <span className="text-sm font-normal text-gray-500 ml-2">共 {total} 个</span>
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
                translateOnIngest ? 'bg-sky-600' : 'bg-gray-700'
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
            <Languages className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-400">翻译为中文</span>
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
        <div className="mb-4 p-4 rounded-lg bg-emerald-900/20 border border-emerald-700/40 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="text-emerald-300 font-medium">导入完成</p>
            <p className="text-gray-400 mt-1">
              共处理 <span className="text-white">{ingestResult.totalAgents}</span> 个 Agent，
              新建 <span className="text-emerald-400">{ingestResult.created}</span>，
              更新 <span className="text-sky-400">{ingestResult.updated}</span>，
              分类 <span className="text-white">{ingestResult.totalCategories}</span> 个
              {ingestResult.errors.length > 0 && (
                <span className="text-yellow-400">，{ingestResult.errors.length} 个文件失败</span>
              )}
            </p>
          </div>
          <button
            className="ml-auto text-gray-600 hover:text-gray-400 text-xs"
            onClick={() => setIngestResult(null)}
            aria-label="关闭导入结果"
          >
            ✕
          </button>
        </div>
      )}

      {/* 导入错误 */}
      {ingestError && (
        <div className="mb-4 p-4 rounded-lg bg-red-900/20 border border-red-700/40 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="text-red-300 font-medium">导入失败</p>
            <p className="text-gray-400 mt-1">{ingestError}</p>
          </div>
          <button
            className="ml-auto text-gray-600 hover:text-gray-400 text-xs"
            onClick={() => setIngestError(null)}
            aria-label="关闭错误提示"
          >
            ✕
          </button>
        </div>
      )}

      {/* 搜索 */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
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
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Agent</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">分类</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">模型</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">字数</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-800">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-800 rounded animate-pulse" />
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
                        <div className="text-sm text-gray-200 font-medium">{agent.name.zh || agent.name.en}</div>
                        <div className="text-xs text-gray-600 truncate max-w-48">{agent.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge bg-gray-800 text-gray-400">{agent.categoryKey}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-400">
                      {agent.modelPreferences.primary === 'vision' ? '👁️ Vision' : '💬 Text'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-500">{agent.stats.wordCount.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-900/20 text-xs px-2 py-1"
                      onClick={() => handleDelete(agent._id)}
                      disabled={deletingId === agent._id}
                      aria-label="删除 Agent"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {deletingId === agent._id ? '删除中...' : '删除'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <span className="text-xs text-gray-500">第 {page} / {totalPages} 页</span>
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
    </div>
  );
};

export default AgentsAdminPage;
