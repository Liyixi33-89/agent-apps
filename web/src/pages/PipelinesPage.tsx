import { useState, useEffect } from 'react';
import { GitBranch, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchPipelines } from '../api';
import { useAppStore } from '../store';
import type { Pipeline } from '../types';

const PipelinesPage = () => {
  const { lang } = useAppStore();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPipelines()
      .then(setPipelines)
      .catch(console.error)
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
          {lang === 'zh' ? 'Agent 编排与工作流管理' : 'Agent orchestration and workflow management'}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
        </div>
      ) : pipelines.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{lang === 'zh' ? '暂无流水线，请先同步数据' : 'No pipelines yet. Please sync data first.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pipelines.map((pipeline) => (
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
