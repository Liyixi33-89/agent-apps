import { useState, useEffect, useMemo } from 'react';
import { GitBranch, Loader2, ChevronDown, ChevronUp, Search, X, Filter } from 'lucide-react';
import { fetchPipelines } from '../api';
import { useAppStore } from '../store';
import type { Pipeline } from '../types';

const PipelinesPage = () => {
  const { lang } = useAppStore();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [modelFilter, setModelFilter] = useState<'all' | 'text' | 'vision'>('all');

  useEffect(() => {
    fetchPipelines()
      .then(setPipelines)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    if (expanded.size === filteredPipelines.length) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(filteredPipelines.map((p) => p._id)));
    }
  };

  // 搜索和筛选
  const filteredPipelines = useMemo(() => {
    return pipelines.filter((p) => {
      // 搜索过滤
      if (searchText) {
        const q = searchText.toLowerCase();
        const nameMatch = (lang === 'zh' ? p.name.zh : p.name.en).toLowerCase().includes(q);
        const descMatch = (lang === 'zh' ? p.description.zh : p.description.en).toLowerCase().includes(q);
        const stepMatch = p.steps.some((s) =>
          (lang === 'zh' ? s.title.zh : s.title.en).toLowerCase().includes(q)
        );
        if (!nameMatch && !descMatch && !stepMatch) return false;
      }
      // 模型类型过滤
      if (modelFilter !== 'all') {
        const hasMatchingStep = p.steps.some((s) => s.modelType === modelFilter);
        if (!hasMatchingStep) return false;
      }
      return true;
    });
  }, [pipelines, searchText, modelFilter, lang]);

  const modelTypeColor = (type: 'text' | 'vision') =>
    type === 'vision' ? 'bg-violet-50 text-violet-600 border-violet-200' : 'bg-sky-50 text-sky-600 border-sky-200';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-violet-600" />
          {lang === 'zh' ? '工作流流水线' : 'Pipelines'}
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {lang === 'zh'
            ? `Agent 编排与工作流管理 · 共 ${pipelines.length} 条`
            : `Agent orchestration and workflow management · ${pipelines.length} total`}
        </p>
      </div>

      {/* 搜索和筛选栏 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* 搜索框 */}
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-slate-200 focus-within:border-sky-400 transition-colors flex-1">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder-slate-400"
            placeholder={lang === 'zh' ? '搜索流水线名称、描述、步骤...' : 'Search pipelines...'}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-label="搜索流水线"
            tabIndex={0}
          />
          {searchText && (
            <button
              className="text-slate-400 hover:text-slate-600 transition-colors"
              onClick={() => setSearchText('')}
              tabIndex={0}
              aria-label="清除搜索"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 模型类型筛选 */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-slate-400" />
          {(['all', 'text', 'vision'] as const).map((type) => (
            <button
              key={type}
              className={`text-xs px-3 py-1.5 rounded-full transition-all font-medium ${
                modelFilter === type
                  ? 'bg-violet-50 text-violet-600 border border-violet-300'
                  : 'text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 bg-white'
              }`}
              onClick={() => setModelFilter(type)}
              tabIndex={0}
              aria-label={`筛选 ${type}`}
            >
              {type === 'all'
                ? (lang === 'zh' ? '全部' : 'All')
                : type === 'text'
                  ? '💬 Text'
                  : '👁️ Vision'}
            </button>
          ))}
        </div>

        {/* 展开/折叠全部 */}
        {filteredPipelines.length > 0 && (
          <button
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 flex-shrink-0"
            onClick={handleExpandAll}
            tabIndex={0}
            aria-label={expanded.size === filteredPipelines.length ? '折叠全部' : '展开全部'}
          >
            {expanded.size === filteredPipelines.length
              ? (lang === 'zh' ? '折叠全部' : 'Collapse All')
              : (lang === 'zh' ? '展开全部' : 'Expand All')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
        </div>
      ) : filteredPipelines.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>
            {searchText || modelFilter !== 'all'
              ? (lang === 'zh' ? '没有找到匹配的流水线' : 'No matching pipelines found')
              : (lang === 'zh' ? '暂无流水线，请先同步数据' : 'No pipelines yet. Please sync data first.')}
          </p>
          {(searchText || modelFilter !== 'all') && (
            <button
              className="text-sm text-sky-500 hover:text-sky-600 mt-2 transition-colors"
              onClick={() => { setSearchText(''); setModelFilter('all'); }}
              tabIndex={0}
              aria-label="清除筛选"
            >
              {lang === 'zh' ? '清除筛选条件' : 'Clear filters'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPipelines.map((pipeline) => (
            <div key={pipeline._id} className="card">
              <button
                className="w-full flex items-start justify-between text-left gap-3"
                onClick={() => handleToggle(pipeline._id)}
                aria-expanded={expanded.has(pipeline._id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-violet-500 flex-shrink-0" />
                    <h3 className="font-semibold text-slate-800 text-sm">
                      {lang === 'zh' ? pipeline.name.zh : pipeline.name.en}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 ml-6">
                    {lang === 'zh' ? pipeline.description.zh : pipeline.description.en}
                  </p>
                  <div className="flex items-center gap-2 mt-2 ml-6">
                    <span className="badge bg-slate-100 text-slate-500 text-xs">{pipeline.steps.length} steps</span>
                    {/* 显示包含的模型类型 */}
                    {Array.from(new Set(pipeline.steps.map((s) => s.modelType))).map((type) => (
                      <span key={type} className={`badge border text-xs ${modelTypeColor(type)}`}>
                        {type === 'vision' ? '👁️ Vision' : '💬 Text'}
                      </span>
                    ))}
                    <span className="text-xs text-slate-400">{new Date(pipeline.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                {expanded.has(pipeline._id)
                  ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
                  : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
                }
              </button>

              {expanded.has(pipeline._id) && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  {/* 系统提示词 */}
                  {pipeline.systemPrompt.zh && (
                    <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-xs text-slate-400 mb-1">System Prompt</div>
                      <p className="text-xs text-slate-600">
                        {lang === 'zh' ? pipeline.systemPrompt.zh : pipeline.systemPrompt.en}
                      </p>
                    </div>
                  )}

                  {/* 步骤列表 */}
                  <div className="space-y-3">
                    {pipeline.steps
                      .sort((a, b) => a.order - b.order)
                      .map((step, i) => (
                        <div key={step.key} className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-7 h-7 rounded-full bg-violet-50 border border-violet-200 flex items-center justify-center text-xs text-violet-600 font-bold flex-shrink-0">
                              {i + 1}
                            </div>
                            {i < pipeline.steps.length - 1 && (
                              <div className="w-px h-4 bg-slate-200 mt-1" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-700 text-sm">
                                {lang === 'zh' ? step.title.zh : step.title.en}
                              </span>
                              <span className={`badge border text-xs ${modelTypeColor(step.modelType)}`}>
                                {step.modelType === 'vision' ? '👁️ Vision' : '💬 Text'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {lang === 'zh' ? step.description.zh : step.description.en}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PipelinesPage;
