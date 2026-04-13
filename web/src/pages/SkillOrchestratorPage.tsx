import { useState, useEffect, useCallback } from 'react';
import {
  Zap, Plus, Play, Trash2, ChevronRight, Search, Filter, BarChart3,
  Settings, Eye, EyeOff, ArrowRight, Loader2, RefreshCw, GitBranch,
  Cpu, MessageSquare, GitMerge, Code, Layers, X, Check, AlertCircle,
} from 'lucide-react';
import { fetchSkills, toggleSkill, executeSkill, fetchSkillOverviewStats } from '../api';
import { useAppStore } from '../store';
import type { Skill, SkillStep, SkillStepType } from '../types';

// ─── 步骤类型配置 ─────────────────────────────────────────────────────────────

const STEP_TYPE_CONFIG: Record<SkillStepType, { icon: typeof Zap; label: string; color: string; bg: string }> = {
  tool:      { icon: Settings,     label: '工具调用',   color: 'text-sky-600',    bg: 'bg-sky-50 border-sky-200' },
  llm:       { icon: MessageSquare, label: 'LLM 调用',  color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
  condition: { icon: GitMerge,     label: '条件分支',   color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200' },
  transform: { icon: Code,         label: '数据转换',   color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  parallel:  { icon: Layers,       label: '并行执行',   color: 'text-rose-600',   bg: 'bg-rose-50 border-rose-200' },
  sub_skill: { icon: GitBranch,    label: '嵌套 Skill', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
};

const CATEGORY_LABELS: Record<string, { zh: string; en: string; emoji: string }> = {
  research: { zh: '调研', en: 'Research', emoji: '🔍' },
  coding:   { zh: '编码', en: 'Coding',   emoji: '💻' },
  analysis: { zh: '分析', en: 'Analysis', emoji: '📊' },
  creative: { zh: '创意', en: 'Creative', emoji: '🎨' },
  workflow: { zh: '流程', en: 'Workflow', emoji: '⚙️' },
  custom:   { zh: '自定义', en: 'Custom', emoji: '🔧' },
};

// ─── 步骤流程可视化 ──────────────────────────────────────────────────────────

const StepFlowVisualization = ({ steps }: { steps: SkillStep[] }) => {
  if (!steps.length) {
    return <div className="text-xs text-slate-400 italic py-2">暂无步骤</div>;
  }

  return (
    <div className="flex items-start gap-1 overflow-x-auto py-2">
      {steps.map((step, i) => {
        const config = STEP_TYPE_CONFIG[step.type] || STEP_TYPE_CONFIG.tool;
        const Icon = config.icon;
        return (
          <div key={step.id} className="flex items-center gap-1 flex-shrink-0">
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${config.bg} shadow-sm`}>
              <Icon className={`w-3.5 h-3.5 ${config.color}`} />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 leading-none">{config.label}</span>
                <span className="text-xs font-medium text-slate-700 leading-tight whitespace-nowrap">{step.label}</span>
              </div>
              {step.type === 'sub_skill' && step.subSkillKey && (
                <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded">
                  →{step.subSkillKey}
                </span>
              )}
            </div>
            {i < steps.length - 1 && (
              step.type === 'condition' ? (
                <GitMerge className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              ) : step.type === 'parallel' ? (
                <Layers className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
              ) : (
                <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
              )
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Skill 卡片 ──────────────────────────────────────────────────────────────

interface SkillCardProps {
  skill: Skill;
  onToggle: (key: string) => void;
  onExecute: (key: string) => void;
  onSelect: (skill: Skill) => void;
  isSelected: boolean;
}

const SkillCard = ({ skill, onToggle, onExecute, onSelect, isSelected }: SkillCardProps) => {
  const catInfo = CATEGORY_LABELS[skill.category] || CATEGORY_LABELS.custom;

  return (
    <div
      className={`rounded-2xl border bg-white p-4 transition-all cursor-pointer ${
        isSelected ? 'border-violet-400 shadow-lg ring-2 ring-violet-100' : 'border-slate-200 hover:border-violet-200 hover:shadow-md'
      }`}
      onClick={() => onSelect(skill)}
      role="button"
      tabIndex={0}
      aria-label={skill.name}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(skill)}
    >
      {/* 头部 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl flex-shrink-0">{skill.icon}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800 truncate">{skill.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                {catInfo.emoji} {catInfo.zh}
              </span>
              <span className="text-[10px] text-slate-400">v{skill.version}</span>
              {skill.isBuiltin && (
                <span className="text-[10px] bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded-full">内置</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            className={`p-1 rounded-lg transition-colors ${skill.isActive ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-300 hover:bg-slate-50'}`}
            onClick={(e) => { e.stopPropagation(); onToggle(skill.key); }}
            tabIndex={0}
            aria-label={skill.isActive ? '禁用' : '启用'}
            title={skill.isActive ? '已启用' : '已禁用'}
          >
            {skill.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            className="p-1 rounded-lg text-violet-500 hover:bg-violet-50 transition-colors"
            onClick={(e) => { e.stopPropagation(); onExecute(skill.key); }}
            tabIndex={0}
            aria-label="执行"
            title="测试执行"
          >
            <Play className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 描述 */}
      <p className="text-xs text-slate-500 line-clamp-2 mb-3">{skill.description}</p>

      {/* 步骤流程图 */}
      <StepFlowVisualization steps={skill.steps} />

      {/* 统计 */}
      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-slate-100">
        <span className="text-[10px] text-slate-400">
          {skill.steps.length} 步骤
        </span>
        <span className="text-[10px] text-slate-400">
          调用 {skill.usageCount} 次
        </span>
        <span className="text-[10px] text-slate-400">
          成功率 {(skill.successRate * 100).toFixed(0)}%
        </span>
        {skill.avgDuration > 0 && (
          <span className="text-[10px] text-slate-400">
            ~{(skill.avgDuration / 1000).toFixed(1)}s
          </span>
        )}
        {skill.dependsOn.length > 0 && (
          <span className="text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full">
            依赖 {skill.dependsOn.length} 个
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Skill 详情面板 ──────────────────────────────────────────────────────────

const SkillDetailPanel = ({ skill, onClose }: { skill: Skill; onClose: () => void }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{skill.icon}</span>
        <div>
          <h2 className="text-base font-bold text-slate-800">{skill.name}</h2>
          <p className="text-xs text-slate-400">key: {skill.key} · v{skill.version}</p>
        </div>
      </div>
      <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" onClick={onClose} tabIndex={0} aria-label="关闭">
        <X className="w-4 h-4" />
      </button>
    </div>

    <p className="text-sm text-slate-600">{skill.description}</p>

    {/* 触发条件 */}
    <div>
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">触发条件</h3>
      <div className="space-y-1">
        {skill.triggers.keywords.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-slate-400">关键词:</span>
            {skill.triggers.keywords.map(kw => (
              <span key={kw} className="text-[10px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded-full">{kw}</span>
            ))}
          </div>
        )}
        {skill.triggers.patterns.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-slate-400">正则:</span>
            {skill.triggers.patterns.map(p => (
              <code key={p} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{p}</code>
            ))}
          </div>
        )}
        {skill.triggers.intentDescription && (
          <p className="text-[10px] text-slate-500">意图: {skill.triggers.intentDescription}</p>
        )}
      </div>
    </div>

    {/* 输入 Schema */}
    {Object.keys(skill.inputSchema.properties || {}).length > 0 && (
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">输入参数</h3>
        <div className="space-y-1">
          {Object.entries(skill.inputSchema.properties).map(([name, schema]: [string, any]) => (
            <div key={name} className="flex items-center gap-2 text-xs">
              <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{name}</code>
              <span className="text-slate-400">{schema.type}</span>
              {skill.inputSchema.required.includes(name) && (
                <span className="text-[10px] text-red-400">必填</span>
              )}
              {schema.description && <span className="text-slate-500">{schema.description}</span>}
            </div>
          ))}
        </div>
      </div>
    )}

    {/* 步骤详情 */}
    <div>
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
        执行步骤 ({skill.steps.length})
      </h3>
      <div className="space-y-2">
        {skill.steps.map((step, i) => {
          const config = STEP_TYPE_CONFIG[step.type] || STEP_TYPE_CONFIG.tool;
          const Icon = config.icon;
          return (
            <div key={step.id} className={`flex items-start gap-3 p-3 rounded-xl border ${config.bg}`}>
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${config.color} bg-white border shadow-sm`}>
                  <span className="text-xs font-bold">{i + 1}</span>
                </div>
                {i < skill.steps.length - 1 && <div className="w-px h-3 bg-slate-200 mt-1" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                  <span className="text-sm font-medium text-slate-700">{step.label}</span>
                  <span className="text-[10px] text-slate-400">{config.label}</span>
                  {step.optional && <span className="text-[10px] bg-slate-200 text-slate-500 px-1 rounded">可选</span>}
                </div>
                {step.toolName && <p className="text-xs text-slate-500 mt-0.5">工具: {step.toolName}</p>}
                {step.promptKey && <p className="text-xs text-slate-500 mt-0.5">Prompt: {step.promptKey}</p>}
                {step.subSkillKey && <p className="text-xs text-indigo-500 mt-0.5">嵌套 Skill: {step.subSkillKey}</p>}
                {step.condition && <p className="text-xs text-amber-600 mt-0.5">条件: {step.condition}</p>}
                <p className="text-[10px] text-slate-400 mt-0.5">输出 → {step.outputKey}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* 依赖关系 */}
    {skill.dependsOn.length > 0 && (
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">依赖 Skill</h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          {skill.dependsOn.map(dep => (
            <span key={dep} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg border border-indigo-200">
              {dep}
            </span>
          ))}
        </div>
      </div>
    )}

    {/* 配置 */}
    <div className="grid grid-cols-2 gap-2">
      <div className="text-xs text-slate-500">超时: {skill.config.timeout / 1000}s</div>
      <div className="text-xs text-slate-500">重试: {skill.config.retryCount} 次</div>
      <div className="text-xs text-slate-500">并发: {skill.config.concurrency}</div>
      <div className="text-xs text-slate-500">缓存: {skill.config.cacheTTL > 0 ? `${skill.config.cacheTTL}s` : '无'}</div>
    </div>
  </div>
);

// ─── 主页面 ──────────────────────────────────────────────────────────────────

const SkillOrchestratorPage = () => {
  const { lang } = useAppStore();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [stats, setStats] = useState<{ totalSkills: number; activeSkills: number; totalExecutions: number; recentSuccessRate: number } | null>(null);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const [skillsRes, statsRes] = await Promise.all([
        fetchSkills({ limit: 100, category: categoryFilter !== 'all' ? categoryFilter : undefined, search: searchText || undefined }),
        fetchSkillOverviewStats(),
      ]);
      setSkills(skillsRes.data);
      setStats(statsRes);
    } catch { /* 拦截器已处理 */ }
    finally { setLoading(false); }
  }, [categoryFilter, searchText]);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  const handleToggle = async (key: string) => {
    try {
      await toggleSkill(key);
      setSkills(prev => prev.map(s => s.key === key ? { ...s, isActive: !s.isActive } : s));
    } catch { /* 拦截器已处理 */ }
  };

  const handleExecute = async (key: string) => {
    setExecuting(key);
    try {
      const result = await executeSkill(key, { message: '测试执行' });
      alert(`执行${result.success ? '成功' : '失败'}: ${result.totalDuration}ms, ${result.totalTokens} tokens`);
    } catch { /* 拦截器已处理 */ }
    finally { setExecuting(null); }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 顶部 */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Zap className="w-6 h-6 text-amber-500" />
              {lang === 'zh' ? 'Skill 编排器' : 'Skill Orchestrator'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {lang === 'zh' ? '可视化编排和管理 Skill 工作流，支持组合嵌套' : 'Visual orchestration and management of Skill workflows'}
            </p>
          </div>
          <button
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100"
            onClick={loadSkills}
            tabIndex={0}
            aria-label="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="flex items-center gap-4 mt-4">
            {[
              { label: '总 Skill', value: stats.totalSkills, icon: '⚡' },
              { label: '已启用', value: stats.activeSkills, icon: '✅' },
              { label: '总执行', value: stats.totalExecutions, icon: '🔄' },
              { label: '成功率', value: `${(stats.recentSuccessRate * 100).toFixed(0)}%`, icon: '📊' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                <span className="text-sm">{s.icon}</span>
                <div>
                  <div className="text-xs text-slate-400">{s.label}</div>
                  <div className="text-sm font-bold text-slate-700">{s.value}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 搜索和筛选 */}
        <div className="flex items-center gap-3 mt-4">
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 focus-within:border-violet-400 flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder-slate-400"
              placeholder={lang === 'zh' ? '搜索 Skill...' : 'Search skills...'}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              aria-label="搜索 Skill"
              tabIndex={0}
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-slate-400" />
            {['all', ...Object.keys(CATEGORY_LABELS)].map(cat => (
              <button
                key={cat}
                className={`text-xs px-2.5 py-1.5 rounded-full transition-all font-medium ${
                  categoryFilter === cat
                    ? 'bg-violet-50 text-violet-600 border border-violet-300'
                    : 'text-slate-500 hover:text-slate-700 border border-slate-200 bg-white'
                }`}
                onClick={() => setCategoryFilter(cat)}
                tabIndex={0}
                aria-label={cat}
              >
                {cat === 'all' ? (lang === 'zh' ? '全部' : 'All') : `${CATEGORY_LABELS[cat]?.emoji} ${CATEGORY_LABELS[cat]?.zh}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            </div>
          ) : (
            <div className="flex gap-6">
              {/* Skill 列表 */}
              <div className={`${selectedSkill ? 'w-1/2' : 'w-full'} transition-all`}>
                {skills.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{lang === 'zh' ? '暂无 Skill' : 'No skills yet'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {skills.map(skill => (
                      <SkillCard
                        key={skill.key}
                        skill={skill}
                        onToggle={handleToggle}
                        onExecute={handleExecute}
                        onSelect={setSelectedSkill}
                        isSelected={selectedSkill?.key === skill.key}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* 详情面板 */}
              {selectedSkill && (
                <div className="w-1/2 sticky top-0">
                  <SkillDetailPanel skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SkillOrchestratorPage;
