import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Filter, Bot, Eye, MessageSquare } from 'lucide-react';
import clsx from 'clsx';
import { fetchAgents, fetchCategories } from '../api';
import { useAppStore } from '../store';
import type { Agent, Category } from '../types';

const colorMap: Record<string, string> = {
  sky: 'bg-sky-600/20 text-sky-400 border-sky-600/30',
  violet: 'bg-violet-600/20 text-violet-400 border-violet-600/30',
  emerald: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30',
  rose: 'bg-rose-600/20 text-rose-400 border-rose-600/30',
  amber: 'bg-amber-600/20 text-amber-400 border-amber-600/30',
  pink: 'bg-pink-600/20 text-pink-400 border-pink-600/30',
  cyan: 'bg-cyan-600/20 text-cyan-400 border-cyan-600/30',
  orange: 'bg-orange-600/20 text-orange-400 border-orange-600/30',
  lime: 'bg-lime-600/20 text-lime-400 border-lime-600/30',
  indigo: 'bg-indigo-600/20 text-indigo-400 border-indigo-600/30',
  teal: 'bg-teal-600/20 text-teal-400 border-teal-600/30',
  blue: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
  fuchsia: 'bg-fuchsia-600/20 text-fuchsia-400 border-fuchsia-600/30',
  slate: 'bg-slate-600/20 text-slate-400 border-slate-600/30'
};

const AgentsPage = () => {
  const { lang } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const selectedCategory = searchParams.get('category') || '';
  const searchQuery = searchParams.get('search') || '';
  const modelFilter = searchParams.get('model') || '';

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAgents({
        category: selectedCategory || undefined,
        search: searchQuery || undefined,
        modelType: modelFilter || undefined,
        page,
        limit: 24
      });
      setAgents(result.data);
      setTotal(result.pagination.total);
    } catch (err) {
      console.error('Failed to load agents', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery, modelFilter, page]);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleSearch = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set('search', value);
    else params.delete('search');
    params.delete('page');
    setSearchParams(params);
    setPage(1);
  };

  const handleCategoryFilter = (key: string) => {
    const params = new URLSearchParams(searchParams);
    if (key) params.set('category', key);
    else params.delete('category');
    params.delete('page');
    setSearchParams(params);
    setPage(1);
  };

  const handleModelFilter = (model: string) => {
    const params = new URLSearchParams(searchParams);
    if (model) params.set('model', model);
    else params.delete('model');
    setSearchParams(params);
    setPage(1);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 头部 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bot className="w-6 h-6 text-sky-400" />
          {lang === 'zh' ? 'Agent 库' : 'Agent Library'}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {lang === 'zh' ? `共 ${total} 个 Agent` : `${total} agents total`}
        </p>
      </div>

      {/* 搜索和过滤 */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            className="input pl-9"
            placeholder={lang === 'zh' ? '搜索 Agent...' : 'Search agents...'}
            defaultValue={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            aria-label="搜索 Agent"
          />
        </div>
        <div className="flex gap-2">
          <button
            className={clsx('btn-ghost text-sm', !modelFilter && 'text-sky-400 bg-sky-600/10')}
            onClick={() => handleModelFilter('')}
          >
            全部
          </button>
          <button
            className={clsx('btn-ghost text-sm', modelFilter === 'text' && 'text-sky-400 bg-sky-600/10')}
            onClick={() => handleModelFilter('text')}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Text
          </button>
          <button
            className={clsx('btn-ghost text-sm', modelFilter === 'vision' && 'text-sky-400 bg-sky-600/10')}
            onClick={() => handleModelFilter('vision')}
          >
            <Eye className="w-3.5 h-3.5" /> Vision
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* 分类侧边栏 */}
        <aside className="hidden lg:block w-48 flex-shrink-0">
          <div className="sticky top-0">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2 px-2">
              <Filter className="w-3 h-3" />
              {lang === 'zh' ? '分类筛选' : 'Filter by Category'}
            </div>
            <div className="space-y-1">
              <button
                className={clsx('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors', !selectedCategory ? 'bg-sky-600/20 text-sky-400' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800')}
                onClick={() => handleCategoryFilter('')}
              >
                {lang === 'zh' ? '全部分类' : 'All Categories'}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  className={clsx('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2', selectedCategory === cat.key ? 'bg-sky-600/20 text-sky-400' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800')}
                  onClick={() => handleCategoryFilter(cat.key)}
                >
                  <span>{cat.icon}</span>
                  <span className="truncate">{lang === 'zh' ? cat.name.zh : cat.name.en}</span>
                  <span className="ml-auto text-xs text-gray-600">{cat.stats.agentCount}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Agent 网格 */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-800" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-800 rounded w-3/4" />
                      <div className="h-3 bg-gray-800 rounded w-full" />
                      <div className="h-3 bg-gray-800 rounded w-2/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{lang === 'zh' ? '没有找到匹配的 Agent' : 'No agents found'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {agents.map((agent) => {
                const colorClass = colorMap[agent.color] || colorMap.slate;
                return (
                  <Link
                    key={agent._id}
                    to={`/agents/${agent.slug}`}
                    className="card-hover group animate-fade-in"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg border flex items-center justify-center text-xl flex-shrink-0 ${colorClass}`}>
                        {agent.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-100 text-sm truncate group-hover:text-sky-400 transition-colors">
                          {lang === 'zh' ? agent.name.zh : agent.name.en}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {lang === 'zh' ? agent.description.zh : agent.description.en}
                        </div>
                      </div>
                    </div>
                    {agent.vibe.en && (
                      <div className="mt-2 text-xs text-gray-600 italic line-clamp-1">
                        "{lang === 'zh' ? agent.vibe.zh : agent.vibe.en}"
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className={`badge border ${colorClass}`}>
                        {agent.categoryKey}
                      </span>
                      <span className="badge bg-gray-800 text-gray-500">
                        {agent.modelPreferences.primary === 'vision' ? '👁️ Vision' : '💬 Text'}
                      </span>
                      <span className="badge bg-gray-800 text-gray-600 ml-auto">
                        {agent.stats.wordCount.toLocaleString()} words
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* 分页 */}
          {total > 24 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                className="btn-secondary text-sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                上一页
              </button>
              <span className="flex items-center text-sm text-gray-400 px-3">
                {page} / {Math.ceil(total / 24)}
              </span>
              <button
                className="btn-secondary text-sm"
                disabled={page >= Math.ceil(total / 24)}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentsPage;
