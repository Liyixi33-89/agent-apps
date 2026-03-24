import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Search, MessageSquare, Loader2 } from 'lucide-react';
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
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-emerald-400" />
          {lang === 'zh' ? '知识库' : 'Knowledge Base'}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {lang === 'zh' ? `共 ${total} 条知识条目，支持语义搜索和 RAG 问答` : `${total} knowledge entries with semantic search and RAG Q&A`}
        </p>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 border border-gray-800">
        {(['browse', 'search', 'rag'] as const).map((tab) => (
          <button
            key={tab}
            className={`flex-1 py-2 text-sm rounded-md transition-colors ${activeTab === tab ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
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
              <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
            </div>
          ) : knowledge.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{lang === 'zh' ? '暂无知识库条目，请先同步 Agent 数据' : 'No knowledge entries yet. Please sync agent data first.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {knowledge.map((kb) => (
                <div key={kb._id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-100 text-sm">
                        {lang === 'zh' ? kb.title.zh : kb.title.en}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {lang === 'zh' ? kb.description.zh : kb.description.en}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="badge bg-gray-800 text-gray-500 text-xs">{kb.sourceType}</span>
                      <span className="text-xs text-gray-600">{kb.stats.chunkCount} chunks</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {kb.categoryKey && <span className="badge bg-sky-600/20 text-sky-400 border border-sky-600/30 text-xs">{kb.categoryKey}</span>}
                    {kb.tags.slice(0, 5).map((tag) => (
                      <span key={tag} className="badge bg-gray-800 text-gray-500 text-xs">{tag}</span>
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
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
              <p className="text-xs text-gray-500">{lang === 'zh' ? `找到 ${searchResults.length} 条相关内容` : `Found ${searchResults.length} relevant results`}</p>
              {searchResults.map((result) => (
                <div key={result.chunkId} className="card">
                  <div className="font-medium text-gray-200 text-sm mb-2">
                    {lang === 'zh' ? result.title.zh : result.title.en}
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-4">
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
            <label className="text-xs text-gray-500 mb-2 block">
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
            <div className="card border-emerald-700/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-emerald-600/20 flex items-center justify-center">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <span className="text-xs text-emerald-400 font-medium">RAG 回答</span>
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{ragAnswer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KnowledgePage;
