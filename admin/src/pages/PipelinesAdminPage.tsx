import { useState, useEffect } from 'react';
import { GitBranch, Trash2 } from 'lucide-react';
import { fetchAdminPipelines, deletePipeline } from '../api';

interface Pipeline {
  _id: string;
  key: string;
  name: { zh: string; en: string };
  description: { zh: string; en: string };
  steps: Array<{ key: string; title: { zh: string; en: string }; modelType: string; order: number }>;
  createdAt: string;
}

const PipelinesAdminPage = () => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPipelines = async () => {
    setLoading(true);
    try {
      const result = await fetchAdminPipelines();
      setPipelines(result);
    } catch (err) {
      console.error('Failed to load pipelines', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPipelines(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此流水线？')) return;
    try {
      await deletePipeline(id);
      await loadPipelines();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-violet-600" />
          流水线管理
        </h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-5 bg-slate-100 rounded w-1/3 mb-2" />
              <div className="h-4 bg-slate-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : pipelines.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无流水线，请先同步数据</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pipelines.map((pipeline) => (
            <div key={pipeline._id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-violet-500" />
                    <h3 className="font-semibold text-slate-800">{pipeline.name.zh}</h3>
                    <span className="badge bg-slate-100 text-slate-500 text-xs">{pipeline.key}</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1 ml-6">{pipeline.description.zh}</p>
                  <div className="flex flex-wrap gap-2 mt-3 ml-6">
                    {pipeline.steps.sort((a, b) => a.order - b.order).map((step, i) => (
                      <div key={step.key} className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2 py-1">
                        <span className="text-xs text-slate-400">{i + 1}.</span>
                        <span className="text-xs text-slate-600">{step.title.zh}</span>
                        <span className="text-xs text-slate-400">{step.modelType === 'vision' ? '👁️' : '💬'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                  onClick={() => handleDelete(pipeline._id)}
                  aria-label="删除流水线"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PipelinesAdminPage;
