import { useState, useEffect } from 'react';
import { GitBranch, Trash2, Plus, X, GripVertical, Loader2, Zap } from 'lucide-react';
import { fetchAdminPipelines, createPipeline, deletePipeline } from '../api';

interface PipelineStep {
  key: string;
  title: { zh: string; en: string };
  modelType: 'text' | 'vision';
  order: number;
}

interface Pipeline {
  _id: string;
  key: string;
  name: { zh: string; en: string };
  description: { zh: string; en: string };
  steps: PipelineStep[];
  createdAt: string;
}

interface StepForm {
  key: string;
  titleZh: string;
  titleEn: string;
  modelType: 'text' | 'vision';
}

const DEFAULT_STEP: StepForm = { key: '', titleZh: '', titleEn: '', modelType: 'text' };

const PipelinesAdminPage = () => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    key: '',
    nameZh: '',
    nameEn: '',
    descZh: '',
    descEn: '',
  });
  const [steps, setSteps] = useState<StepForm[]>([{ ...DEFAULT_STEP }]);

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

  const handleAddStep = () => {
    setSteps((prev) => [...prev, { ...DEFAULT_STEP }]);
  };

  const handleRemoveStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleStepChange = (idx: number, field: keyof StepForm, value: string) => {
    setSteps((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const handleCloseCreate = () => {
    setShowCreate(false);
    setForm({ key: '', nameZh: '', nameEn: '', descZh: '', descEn: '' });
    setSteps([{ ...DEFAULT_STEP }]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.key || !form.nameZh || steps.length === 0) return;
    const invalidStep = steps.find((s) => !s.key || !s.titleZh);
    if (invalidStep) {
      alert('请填写所有步骤的 Key 和中文标题');
      return;
    }
    setCreating(true);
    try {
      await createPipeline({
        key: form.key,
        name: { zh: form.nameZh, en: form.nameEn || form.nameZh },
        description: { zh: form.descZh, en: form.descEn || form.descZh },
        steps: steps.map((s, i) => ({
          key: s.key,
          title: { zh: s.titleZh, en: s.titleEn || s.titleZh },
          modelType: s.modelType,
          order: i + 1,
        })),
      });
      handleCloseCreate();
      await loadPipelines();
    } catch (err) {
      console.error('Create pipeline failed', err);
      alert('创建失败，请检查数据格式');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-violet-600" />
          流水线管理
          <span className="text-sm font-normal text-slate-400 ml-2">共 {pipelines.length} 条</span>
        </h1>
        <button
          className="btn-primary"
          onClick={() => setShowCreate(true)}
          aria-label="新建流水线"
          tabIndex={0}
        >
          <Plus className="w-4 h-4" />
          新建流水线
        </button>
      </div>

      {/* 创建弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-violet-500" />
                新建流水线
              </h2>
              <button
                className="btn-ghost p-1"
                onClick={handleCloseCreate}
                aria-label="关闭"
                tabIndex={0}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-4 space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">流水线 Key *</label>
                  <input
                    className="input font-mono"
                    placeholder="e.g. vibe_ui_pipeline"
                    value={form.key}
                    onChange={(e) => setForm({ ...form, key: e.target.value.replace(/\s/g, '_') })}
                    required
                    aria-label="流水线 Key"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">名称（中文）*</label>
                  <input
                    className="input"
                    placeholder="UI 生成流水线"
                    value={form.nameZh}
                    onChange={(e) => setForm({ ...form, nameZh: e.target.value })}
                    required
                    aria-label="中文名称"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">名称（英文）</label>
                  <input
                    className="input"
                    placeholder="UI Generation Pipeline"
                    value={form.nameEn}
                    onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                    aria-label="英文名称"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">描述（中文）</label>
                  <input
                    className="input"
                    placeholder="多 Agent 协作生成 UI"
                    value={form.descZh}
                    onChange={(e) => setForm({ ...form, descZh: e.target.value })}
                    aria-label="中文描述"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">描述（英文）</label>
                  <input
                    className="input"
                    placeholder="Multi-agent UI generation"
                    value={form.descEn}
                    onChange={(e) => setForm({ ...form, descEn: e.target.value })}
                    aria-label="英文描述"
                  />
                </div>
              </div>

              {/* 步骤管理 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-500 font-medium">流水线步骤 *</label>
                  <button
                    type="button"
                    className="btn-ghost text-xs flex items-center gap-1 text-violet-600 hover:text-violet-700"
                    onClick={handleAddStep}
                    aria-label="添加步骤"
                    tabIndex={0}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    添加步骤
                  </button>
                </div>

                <div className="space-y-2">
                  {steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 bg-slate-50 rounded-xl p-3 border border-slate-200"
                    >
                      <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
                        <GripVertical className="w-3.5 h-3.5 text-slate-300" />
                        <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <input
                            className="input text-xs font-mono"
                            placeholder="步骤 Key (e.g. analyze)"
                            value={step.key}
                            onChange={(e) => handleStepChange(idx, 'key', e.target.value.replace(/\s/g, '_'))}
                            required
                            aria-label={`步骤 ${idx + 1} Key`}
                          />
                        </div>
                        <input
                          className="input text-xs"
                          placeholder="步骤标题（中文）"
                          value={step.titleZh}
                          onChange={(e) => handleStepChange(idx, 'titleZh', e.target.value)}
                          required
                          aria-label={`步骤 ${idx + 1} 中文标题`}
                        />
                        <input
                          className="input text-xs"
                          placeholder="步骤标题（英文）"
                          value={step.titleEn}
                          onChange={(e) => handleStepChange(idx, 'titleEn', e.target.value)}
                          aria-label={`步骤 ${idx + 1} 英文标题`}
                        />
                        <div className="col-span-2">
                          <select
                            className="input text-xs"
                            value={step.modelType}
                            onChange={(e) => handleStepChange(idx, 'modelType', e.target.value)}
                            aria-label={`步骤 ${idx + 1} 模型类型`}
                          >
                            <option value="text">💬 文本模型 (text)</option>
                            <option value="vision">👁️ 视觉模型 (vision)</option>
                          </select>
                        </div>
                      </div>
                      {steps.length > 1 && (
                        <button
                          type="button"
                          className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0 mt-1"
                          onClick={() => handleRemoveStep(idx)}
                          aria-label={`删除步骤 ${idx + 1}`}
                          tabIndex={0}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="btn-primary flex-1 justify-center"
                  disabled={creating}
                  aria-label="创建流水线"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                  {creating ? '创建中...' : '创建流水线'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseCreate}
                  aria-label="取消"
                  tabIndex={0}
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 列表 */}
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
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center">
            <Zap className="w-8 h-8 text-violet-400" />
          </div>
          <div className="text-center">
            <p className="text-slate-600 font-medium mb-1">暂无流水线</p>
            <p className="text-slate-400 text-sm">创建一个多 Agent 协作流水线，让 AI 分步骤完成复杂任务</p>
          </div>
          <button
            className="btn-primary flex items-center gap-1.5"
            onClick={() => setShowCreate(true)}
            aria-label="立即创建流水线"
            tabIndex={0}
          >
            <Plus className="w-4 h-4" />
            立即创建流水线
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {pipelines.map((pipeline) => (
            <div key={pipeline._id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <GitBranch className="w-4 h-4 text-violet-500 flex-shrink-0" />
                    <h3 className="font-semibold text-slate-800">{pipeline.name.zh}</h3>
                    <span className="badge bg-slate-100 text-slate-500 text-xs font-mono">{pipeline.key}</span>
                    <span className="badge bg-violet-50 text-violet-600 text-xs">{pipeline.steps.length} 步骤</span>
                  </div>
                  {pipeline.description.zh && (
                    <p className="text-sm text-slate-500 mt-1 ml-6">{pipeline.description.zh}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3 ml-6">
                    {pipeline.steps
                      .sort((a, b) => a.order - b.order)
                      .map((step, i) => (
                        <div key={step.key} className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2.5 py-1.5">
                          <span className="text-xs text-slate-400 font-medium">{i + 1}.</span>
                          <span className="text-xs text-slate-600">{step.title.zh}</span>
                          <span className="text-xs">{step.modelType === 'vision' ? '👁️' : '💬'}</span>
                        </div>
                      ))}
                  </div>
                </div>
                <button
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                  onClick={() => handleDelete(pipeline._id)}
                  aria-label="删除流水线"
                  tabIndex={0}
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
