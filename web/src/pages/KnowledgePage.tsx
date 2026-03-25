import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Search, MessageSquare, Loader2, Database } from 'lucide-react';
import { fetchKnowledge, searchKnowledge, ragQuery } from '../api';
import { useAppStore } from '../store';
import type { KnowledgeBase } from '../types';

const KnowledgePage = () => {
  const [searchParams] = useSearchParams();
  const { lang, activeProvider } = useAppStore();
  const [knowledge, setKnowledge] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [ragQuestion, setRagQuestion] = useState('');
  const [ragAnswer, setRagAnswer] = useState('');
  const [ragLoading, setRagLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ title: { zh: string; en: string }; content: { zh: string; en: string }; chunkId: string }>>([]);
  const [activeTab, setActiveTab] = useState<'browse' | 'search' | 'rag'>('browse');

  const agentSlug = searchParams.get('agent') || undefined;

  useEffect(() => {
    setLoading(true);
    fetchKnowledge({ agentSlug, limit: 20 })
      .then((r) => { setKnowledge(r.data); setTotal(r.pagination.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [agentSlug]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const results = await searchKnowledge(searchQuery, { agentSlug, lang, limit: 10 });
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed', err);
    }
  };

  const handleRagQuery = async () => {
    if (!ragQuestion.trim()) return;
    setRagLoading(true);
    setRagAnswer('');
    try {
      const result = await ragQuery(ragQuestion, { agentSlug, provider: activeProvider, lang });
      setRagAnswer(result.answer);
    } catch (err) {
      console.error('RAG query failed', err);
      setRagAnswer('❌ 查询失败，请检查服务连接');
    } finally {
      setRagLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 头部 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-emerald-600" />
          {lang === 'zh' ? '知识库' : 'Knowledge Base'}
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {lang === 'zh' ? `共 ${total} 条知识条目，支持语义搜索和 RAG 问答` : `${total} knowledge entries with semantic search and RAG Q&A`}
        </p>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1">
        {(['browse', 'search', 'rag'] as const).map((tab) => (
          <button
            key={tab}
            className={`flex-1 py-2 text-sm rounded-md transition-colors font-medium ${activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'browse' ? (lang === 'zh' ? '📚 浏览' : '📚 Browse') : tab === 'search' ? (lang === 'zh' ? '🔍 搜索' : '🔍 Search') : '🤖 RAG 问答'}
          </button>
        ))}
      </div>

      {/* 浏览 Tab */}
      {activeTab === 'browse' && (
        <div>
          {loading ? (
            <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
            </div>
          ) : knowledge.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <Database className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <p className="text-slate-600 font-medium mb-1">
                  {lang === 'zh' ? '知识库暂无数据' : 'No knowledge data yet'}
                </p>
                <p className="text-slate-400 text-sm max-w-xs">
                  {lang === 'zh'
                    ? '请前往管理后台同步 Agent 数据，或手动添加知识条目'
                    : 'Please go to the admin panel to sync agent data or add knowledge entries manually'}
                </p>
              </div>
              <a
                href="http://127.0.0.1:5174/knowledge"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
                aria-label="前往管理后台"
                tabIndex={0}
              >
                <BookOpen className="w-4 h-4" />
                {lang === 'zh' ? '前往管理后台' : 'Go to Admin Panel'}
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {knowledge.map((kb) => (
                <div key={kb._id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 text-sm">
                        {lang === 'zh' ? kb.title.zh : kb.title.en}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {lang === 'zh' ? kb.description.zh : kb.description.en}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="badge bg-slate-100 text-slate-500 text-xs">{kb.sourceType}</span>
                      <span className="text-xs text-slate-400">{kb.stats.chunkCount} chunks</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {kb.categoryKey && <span className="badge bg-sky-50 text-sky-600 border border-sky-200 text-xs">{kb.categoryKey}</span>}
                    {kb.tags.slice(0, 5).map((tag) => (
                      <span key={tag} className="badge bg-slate-100 text-slate-500 text-xs">{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 搜索 Tab */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                className="input pl-9"
                placeholder={lang === 'zh' ? '搜索知识库...' : 'Search knowledge base...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                aria-label="搜索知识库"
              />
            </div>
            <button className="btn-primary" onClick={handleSearch} aria-label="搜索">
              <Search className="w-4 h-4" />
              {lang === 'zh' ? '搜索' : 'Search'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">{lang === 'zh' ? `找到 ${searchResults.length} 条相关内容` : `Found ${searchResults.length} relevant results`}</p>
              {searchResults.map((result) => (
                <div key={result.chunkId} className="card">
                  <div className="font-medium text-slate-700 text-sm mb-2">
                    {lang === 'zh' ? result.title.zh : result.title.en}
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-4">
                    {lang === 'zh' ? result.content.zh : result.content.en}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RAG 问答 Tab */}
      {activeTab === 'rag' && (
        <div className="space-y-4">
          <div className="card">
            <label className="text-xs text-slate-500 mb-2 block">
              {lang === 'zh' ? '基于知识库提问' : 'Ask questions based on knowledge base'}
            </label>
            <textarea
              className="input resize-none min-h-20 text-sm"
              placeholder={lang === 'zh' ? '输入你的问题...' : 'Enter your question...'}
              value={ragQuestion}
              onChange={(e) => setRagQuestion(e.target.value)}
              aria-label="RAG 问题输入"
            />
            <button
              className="btn-primary mt-3"
              onClick={handleRagQuery}
              disabled={!ragQuestion.trim() || ragLoading}
              aria-label="提交问题"
            >
              {ragLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
              {ragLoading ? (lang === 'zh' ? '查询中...' : 'Querying...') : (lang === 'zh' ? '提问' : 'Ask')}
            </button>
          </div>

          {ragAnswer && (
            <div className="card border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <span className="text-xs text-emerald-700 font-medium">RAG 回答</span>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{ragAnswer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KnowledgePage;
