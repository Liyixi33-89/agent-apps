import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Store, Download, Upload, Share2, Search, Filter, Loader2, RefreshCw,
  ChevronRight, ChevronLeft, ArrowUpDown, X, FileJson, Check, AlertCircle,
  ExternalLink, Copy,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  fetchAgentMarket, exportAgent, importAgent, shareAgent, unshareAgent,
  fetchAgents,
} from '../api';
import { useAppStore } from '../store';
import type { AgentMarketItem, AgentExportFormat, Agent } from '../types';

// ─── Agent 市场卡片 ──────────────────────────────────────────────────────────

interface AgentCardProps {
  agent: AgentMarketItem;
  lang: 'zh' | 'en';
  onExport: (slug: string) => void;
  onView: (slug: string) => void;
}

const AgentCard = ({ agent, lang, onExport, onView }: AgentCardProps) => (
  <div className="group rounded-2xl border border-slate-200 bg-white hover:border-violet-200 hover:shadow-md transition-all overflow-hidden">
    {/* 渐变头部 */}
    <div className={`h-2 bg-gradient-to-r from-${agent.color}-400 to-${agent.color}-600`} style={{
      background: `linear-gradient(to right, var(--tw-gradient-from, #3b82f6), var(--tw-gradient-to, #8b5cf6))`,
    }} />

    <div className="p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">{agent.emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-800 truncate group-hover:text-violet-700 transition-colors">
            {lang === 'zh' ? agent.name.zh : agent.name.en}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
            {lang === 'zh' ? agent.description.zh : agent.description.en}
          </p>
        </div>
      </div>

      {/* 标签 */}
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        {agent.category && (
          <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full">
            {agent.category.icon} {lang === 'zh' ? agent.category.name.zh : agent.category.name.en}
          </span>
        )}
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
          agent.modelPreferences.primary === 'vision' ? 'bg-purple-50 text-purple-600' : 'bg-sky-50 text-sky-600'
        }`}>
          {agent.modelPreferences.primary === 'vision' ? '👁️ Vision' : '💬 Text'}
        </span>
        {agent.tags.slice(0, 2).map(tag => (
          <span key={tag} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{tag}</span>
        ))}
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span>{agent.stats.sectionCount} 章节</span>
          <span>{agent.stats.wordCount} 字</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-600 px-2 py-1 rounded-lg hover:bg-violet-50 transition-colors"
            onClick={() => onView(agent.slug)}
            tabIndex={0}
            aria-label="查看详情"
          >
            <ExternalLink className="w-3 h-3" />
            查看
          </button>
          <button
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
            onClick={() => onExport(agent.slug)}
            tabIndex={0}
            aria-label="导出"
          >
            <Download className="w-3 h-3" />
            导出
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── 导入弹窗 ────────────────────────────────────────────────────────────────

interface ImportModalProps {
  lang: 'zh' | 'en';
  onImport: (data: AgentExportFormat) => void;
  onClose: () => void;
}

const ImportModal = ({ lang, onImport, onClose }: ImportModalProps) => {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<AgentExportFormat | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleParse = () => {
    try {
      const data = JSON.parse(jsonText) as AgentExportFormat;
      if (!data.formatVersion || !data.agent?.slug) {
        setError('无效的 Agent 导入格式');
        return;
      }
      setPreview(data);
      setError('');
    } catch {
      setError('JSON 解析失败，请检查格式');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setJsonText(text);
      try {
        const data = JSON.parse(text) as AgentExportFormat;
        if (data.formatVersion && data.agent?.slug) {
          setPreview(data);
          setError('');
        }
      } catch { /* 用户可手动点击解析 */ }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-violet-500" />
            <h2 className="text-base font-bold text-slate-800">
              {lang === 'zh' ? '导入 Agent' : 'Import Agent'}
            </h2>
          </div>
          <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" onClick={onClose} tabIndex={0} aria-label="关闭">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 文件上传 */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 hover:border-violet-300 text-sm text-slate-500 hover:text-violet-600 transition-colors w-full justify-center"
              onClick={() => fileInputRef.current?.click()}
              tabIndex={0}
              aria-label="选择文件"
            >
              <FileJson className="w-4 h-4" />
              {lang === 'zh' ? '选择 JSON 文件' : 'Select JSON file'}
            </button>
          </div>

          {/* JSON 输入 */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">
              {lang === 'zh' ? '或直接粘贴 JSON' : 'Or paste JSON directly'}
            </label>
            <textarea
              className="w-full h-40 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 resize-none"
              placeholder='{"formatVersion": "1.0.0", "agent": {...}}'
              value={jsonText}
              onChange={(e) => { setJsonText(e.target.value); setPreview(null); setError(''); }}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          {/* 预览 */}
          {preview && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-emerald-700">格式验证通过</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>名称: <strong>{preview.agent.name.zh}</strong></div>
                <div>Slug: <strong>{preview.agent.slug}</strong></div>
                <div>分类: <strong>{preview.agent.categoryKey}</strong></div>
                <div>章节: <strong>{preview.agent.sections.length}</strong></div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          {!preview ? (
            <button
              className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
              onClick={handleParse}
              disabled={!jsonText.trim()}
              tabIndex={0}
              aria-label="解析"
            >
              解析 JSON
            </button>
          ) : (
            <button
              className="px-5 py-2 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
              onClick={() => { onImport(preview); onClose(); }}
              tabIndex={0}
              aria-label="确认导入"
            >
              确认导入
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── 主页面 ──────────────────────────────────────────────────────────────────

const AgentMarketPage = () => {
  const { lang } = useAppStore();
  const navigate = useNavigate();

  const [marketAgents, setMarketAgents] = useState<AgentMarketItem[]>([]);
  const [myAgents, setMyAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'market' | 'my'>('market');
  const [searchText, setSearchText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadMarket = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAgentMarket({ page, limit: 20, search: searchText || undefined });
      setMarketAgents(res.data);
      setTotal(res.pagination.total);
    } catch { /* 拦截器已处理 */ }
    finally { setLoading(false); }
  }, [page, searchText]);

  const loadMyAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAgents({ limit: 100 });
      setMyAgents(res.data);
    } catch { /* 拦截器已处理 */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'market') loadMarket();
    else loadMyAgents();
  }, [activeTab, loadMarket, loadMyAgents]);

  const handleExport = async (slug: string) => {
    try {
      const data = await exportAgent(slug);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agent-${slug}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* 拦截器已处理 */ }
  };

  const handleImport = async (data: AgentExportFormat) => {
    try {
      const result = await importAgent(data);
      alert(result.message);
      loadMarket();
      loadMyAgents();
    } catch { /* 拦截器已处理 */ }
  };

  const handleShare = async (slug: string) => {
    try {
      await shareAgent(slug);
      alert('Agent 已分享到市场');
      loadMyAgents();
    } catch { /* 拦截器已处理 */ }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="h-full flex flex-col">
      {/* 顶部 */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Store className="w-6 h-6 text-violet-500" />
              {lang === 'zh' ? 'Agent 市场' : 'Agent Market'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {lang === 'zh' ? '发现、分享和导入 Agent 配置' : 'Discover, share and import Agent configurations'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              onClick={() => setShowImport(true)}
              tabIndex={0}
              aria-label="导入 Agent"
            >
              <Upload className="w-4 h-4" />
              {lang === 'zh' ? '导入' : 'Import'}
            </button>
          </div>
        </div>

        {/* Tab + 搜索 */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {[
              { key: 'market' as const, label: lang === 'zh' ? '🏪 市场' : '🏪 Market' },
              { key: 'my' as const, label: lang === 'zh' ? '📦 我的 Agent' : '📦 My Agents' },
            ].map(tab => (
              <button
                key={tab.key}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setActiveTab(tab.key)}
                tabIndex={0}
                aria-label={tab.label}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'market' && (
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 focus-within:border-violet-400 flex-1 max-w-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder-slate-400"
                placeholder={lang === 'zh' ? '搜索 Agent...' : 'Search agents...'}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                aria-label="搜索"
                tabIndex={0}
              />
            </div>
          )}
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            </div>
          ) : activeTab === 'market' ? (
            <>
              {marketAgents.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Store className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{lang === 'zh' ? '暂无分享的 Agent' : 'No shared agents yet'}</p>
                  <p className="text-xs mt-1">{lang === 'zh' ? '切换到「我的 Agent」标签页分享你的 Agent' : 'Switch to "My Agents" tab to share your agents'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {marketAgents.map(agent => (
                    <AgentCard
                      key={agent._id}
                      agent={agent}
                      lang={lang}
                      onExport={handleExport}
                      onView={(slug) => navigate(`/agents/${slug}`)}
                    />
                  ))}
                </div>
              )}

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6 pt-4 border-t border-slate-100">
                  <button
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-30 px-3 py-1.5 rounded-lg hover:bg-slate-100"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    tabIndex={0}
                    aria-label="上一页"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    上一页
                  </button>
                  <span className="text-xs text-slate-400">{page} / {totalPages}</span>
                  <button
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-30 px-3 py-1.5 rounded-lg hover:bg-slate-100"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    tabIndex={0}
                    aria-label="下一页"
                  >
                    下一页
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          ) : (
            /* 我的 Agent 列表 */
            <div className="space-y-3">
              {myAgents.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p>{lang === 'zh' ? '暂无 Agent' : 'No agents yet'}</p>
                </div>
              ) : (
                myAgents.map(agent => (
                  <div key={agent._id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white hover:border-violet-200 transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl flex-shrink-0">{agent.emoji}</span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-800 truncate">
                          {lang === 'zh' ? agent.name.zh : agent.name.en}
                        </h3>
                        <p className="text-xs text-slate-500 truncate">
                          {lang === 'zh' ? agent.description.zh : agent.description.en}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(agent.frontmatter)?.shared ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full border border-emerald-200">
                          ✅ 已分享
                        </span>
                      ) : (
                        <button
                          className="flex items-center gap-1 text-xs text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg transition-colors"
                          onClick={() => handleShare(agent.slug)}
                          tabIndex={0}
                          aria-label="分享"
                        >
                          <Share2 className="w-3 h-3" />
                          分享
                        </button>
                      )}
                      <button
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                        onClick={() => handleExport(agent.slug)}
                        tabIndex={0}
                        aria-label="导出"
                      >
                        <Download className="w-3 h-3" />
                        导出
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* 导入弹窗 */}
      {showImport && (
        <ImportModal
          lang={lang}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
};

export default AgentMarketPage;
