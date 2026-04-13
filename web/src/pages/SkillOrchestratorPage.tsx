import { useState, useEffect, useCallback } from 'react';
import {
  Zap, Play, Search, Filter, ArrowRight, Loader2, RefreshCw, GitBranch,
  Settings, MessageSquare, GitMerge, Code, Layers, X, Send, Target,
  CheckCircle, XCircle, Clock, Hash, ChevronDown, ChevronUp, History,
  Sparkles, BarChart3, AlertTriangle,
} from 'lucide-react';
import {
  fetchSkills, executeSkill, fetchSkillOverviewStats, testSkillMatch,
  fetchSkillExecutions,
} from '../api';
import { useAppStore } from '../store';
import type { Skill, SkillStep, SkillStepType, SkillExecutionResult } from '../types';

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
  if (!steps.length) return <div className="text-xs text-slate-400 italic py-2">暂无步骤</div>;

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
                <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded">→{step.subSkillKey}</span>
              )}
            </div>
            {i < steps.length - 1 && (
              step.type === 'condition'
                ? <GitMerge className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                : step.type === 'parallel'
                  ? <Layers className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                  : <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Skill 卡片（用户视角，无管理按钮）──────────────────────────────────────

interface SkillCardProps {
  skill: Skill;
  onTry: (skill: Skill) => void;
  isSelected: boolean;
}

const SkillCard = ({ skill, onTry, isSelected }: SkillCardProps) => {
  const catInfo = CATEGORY_LABELS[skill.category] || CATEGORY_LABELS.custom;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-2xl border bg-white transition-all ${
        isSelected ? 'border-violet-400 shadow-lg ring-2 ring-violet-100' : 'border-slate-200 hover:border-violet-200 hover:shadow-md'
      }`}
    >
      <div className="p-4">
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
                {!skill.isActive && (
                  <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">未启用</span>
                )}
              </div>
            </div>
          </div>
          <button
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-50 text-violet-600 hover:bg-violet-100 border border-violet-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => onTry(skill)}
            disabled={!skill.isActive}
            tabIndex={0}
            aria-label={`试用 ${skill.name}`}
          >
            <Play className="w-3 h-3" />
            试用
          </button>
        </div>

        {/* 描述 */}
        <p className="text-xs text-slate-500 line-clamp-2 mb-3">{skill.description}</p>

        {/* 触发关键词预览 */}
        {skill.triggers.keywords.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mb-2">
            <span className="text-[10px] text-slate-400">触发词:</span>
            {skill.triggers.keywords.slice(0, 5).map(kw => (
              <span key={kw} className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full border border-amber-200">{kw}</span>
            ))}
            {skill.triggers.keywords.length > 5 && (
              <span className="text-[10px] text-slate-400">+{skill.triggers.keywords.length - 5}</span>
            )}
          </div>
        )}

        {/* 步骤流程图 */}
        <StepFlowVisualization steps={skill.steps} />

        {/* 统计 */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-400">{skill.steps.length} 步骤</span>
            <span className="text-[10px] text-slate-400">调用 {skill.usageCount} 次</span>
            <span className="text-[10px] text-slate-400">成功率 {(skill.successRate * 100).toFixed(0)}%</span>
            {skill.avgDuration > 0 && (
              <span className="text-[10px] text-slate-400">~{(skill.avgDuration / 1000).toFixed(1)}s</span>
            )}
          </div>
          <button
            className="text-[10px] text-slate-400 hover:text-violet-500 flex items-center gap-0.5"
            onClick={() => setExpanded(!expanded)}
            tabIndex={0}
            aria-label={expanded ? '收起详情' : '展开详情'}
          >
            详情 {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* 展开详情 */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-slate-100">
          {/* 输入参数 */}
          {Object.keys(skill.inputSchema.properties || {}).length > 0 && (
            <div className="mt-3">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">输入参数</h4>
              <div className="space-y-1">
                {Object.entries(skill.inputSchema.properties).map(([name, schema]: [string, any]) => (
                  <div key={name} className="flex items-center gap-2 text-xs">
                    <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{name}</code>
                    <span className="text-slate-400">{schema.type}</span>
                    {skill.inputSchema.required.includes(name) && <span className="text-[10px] text-red-400">必填</span>}
                    {schema.description && <span className="text-slate-500 truncate">{schema.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 步骤详情 */}
          <div className="mt-2">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">执行步骤 ({skill.steps.length})</h4>
            <div className="space-y-1.5">
              {skill.steps.map((step, i) => {
                const config = STEP_TYPE_CONFIG[step.type] || STEP_TYPE_CONFIG.tool;
                const Icon = config.icon;
                return (
                  <div key={step.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${config.bg}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${config.color} bg-white border shadow-sm text-[10px] font-bold flex-shrink-0`}>
                      {i + 1}
                    </div>
                    <Icon className={`w-3 h-3 ${config.color} flex-shrink-0`} />
                    <span className="text-xs font-medium text-slate-700">{step.label}</span>
                    <span className="text-[10px] text-slate-400">{config.label}</span>
                    {step.optional && <span className="text-[10px] bg-slate-200 text-slate-500 px-1 rounded">可选</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 依赖 */}
          {skill.dependsOn.length > 0 && (
            <div className="mt-2">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">依赖 Skill</h4>
              <div className="flex items-center gap-1.5 flex-wrap">
                {skill.dependsOn.map(dep => (
                  <span key={dep} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg border border-indigo-200">{dep}</span>
                ))}
              </div>
            </div>
          )}

          {/* 配置 */}
          <div className="grid grid-cols-4 gap-2 mt-2">
            <div className="text-[10px] text-slate-500">超时: {skill.config.timeout / 1000}s</div>
            <div className="text-[10px] text-slate-500">重试: {skill.config.retryCount} 次</div>
            <div className="text-[10px] text-slate-500">并发: {skill.config.concurrency}</div>
            <div className="text-[10px] text-slate-500">缓存: {skill.config.cacheTTL > 0 ? `${skill.config.cacheTTL}s` : '无'}</div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 试用 Skill 面板 ─────────────────────────────────────────────────────────

interface TrySkillPanelProps {
  skill: Skill;
  onClose: () => void;
  lang: 'zh' | 'en';
}

const TrySkillPanel = ({ skill, onClose, lang }: TrySkillPanelProps) => {
  const [inputFields, setInputFields] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<SkillExecutionResult | null>(null);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [execHistory, setExecHistory] = useState<Array<{
    executionId: string; status: string; totalDuration: number;
    totalTokens: number; triggerMethod: string; createdAt: string;
    stepResults?: Array<{ stepId: string; status: string; duration: number; outputSummary: string }>;
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 初始化输入字段
  useEffect(() => {
    const fields: Record<string, string> = {};
    if (Object.keys(skill.inputSchema.properties || {}).length > 0) {
      for (const [name, schema] of Object.entries(skill.inputSchema.properties) as [string, any][]) {
        fields[name] = schema.default != null ? String(schema.default) : '';
      }
    } else {
      fields.message = '';
    }
    setInputFields(fields);
    setResult(null);
    setError('');
  }, [skill.key]);

  const handleExecute = async () => {
    setExecuting(true);
    setResult(null);
    setError('');
    try {
      const input: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(inputFields)) {
        input[k] = v;
      }
      const res = await executeSkill(skill.key, input);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : '执行失败');
    } finally {
      setExecuting(false);
    }
  };

  const handleLoadHistory = async () => {
    setShowHistory(!showHistory);
    if (!showHistory && execHistory.length === 0) {
      setHistoryLoading(true);
      try {
        const res = await fetchSkillExecutions(skill.key, 1, 5);
        setExecHistory(res.executions || []);
      } catch { /* 忽略 */ }
      finally { setHistoryLoading(false); }
    }
  };

  const hasCustomInput = Object.keys(skill.inputSchema.properties || {}).length > 0;

  return (
    <div className="rounded-2xl border border-violet-200 bg-white shadow-lg overflow-hidden">
      {/* 头部 */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 px-5 py-4 border-b border-violet-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{skill.icon}</span>
            <div>
              <h2 className="text-base font-bold text-slate-800">{skill.name}</h2>
              <p className="text-xs text-slate-500">{lang === 'zh' ? '试用 Skill — 输入参数并执行' : 'Try Skill — Enter input and execute'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="p-1.5 rounded-lg hover:bg-white/60 text-slate-400 hover:text-slate-600 transition-colors"
              onClick={handleLoadHistory}
              tabIndex={0}
              aria-label="执行历史"
              title="执行历史"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              className="p-1.5 rounded-lg hover:bg-white/60 text-slate-400 hover:text-slate-600 transition-colors"
              onClick={onClose}
              tabIndex={0}
              aria-label="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* 输入表单 */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            {hasCustomInput ? '输入参数' : '输入消息'}
          </h3>
          {hasCustomInput ? (
            <div className="space-y-2">
              {Object.entries(skill.inputSchema.properties).map(([name, schema]: [string, any]) => (
                <div key={name}>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 mb-1">
                    <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">{name}</code>
                    <span className="text-slate-400">{schema.type}</span>
                    {skill.inputSchema.required.includes(name) && <span className="text-red-400">*</span>}
                  </label>
                  {schema.enum ? (
                    <select
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:outline-none focus:border-violet-400"
                      value={inputFields[name] || ''}
                      onChange={(e) => setInputFields(prev => ({ ...prev, [name]: e.target.value }))}
                      aria-label={name}
                      tabIndex={0}
                    >
                      <option value="">请选择...</option>
                      {schema.enum.map((v: string) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  ) : (
                    <input
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400"
                      placeholder={schema.description || `输入 ${name}...`}
                      value={inputFields[name] || ''}
                      onChange={(e) => setInputFields(prev => ({ ...prev, [name]: e.target.value }))}
                      aria-label={name}
                      tabIndex={0}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <textarea
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 resize-none"
              rows={3}
              placeholder={lang === 'zh' ? '输入你想让 Skill 处理的内容...' : 'Enter what you want the Skill to process...'}
              value={inputFields.message || ''}
              onChange={(e) => setInputFields(prev => ({ ...prev, message: e.target.value }))}
              aria-label="输入消息"
              tabIndex={0}
            />
          )}
        </div>

        {/* 执行按钮 */}
        <button
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleExecute}
          disabled={executing}
          tabIndex={0}
          aria-label="执行 Skill"
        >
          {executing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {lang === 'zh' ? '执行中...' : 'Executing...'}</>
          ) : (
            <><Play className="w-4 h-4" /> {lang === 'zh' ? '执行 Skill' : 'Execute Skill'}</>
          )}
        </button>

        {/* 错误提示 */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-red-700">执行失败</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* 执行结果 */}
        {result && (
          <div className={`rounded-xl border ${result.success ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'} overflow-hidden`}>
            {/* 结果头部 */}
            <div className={`flex items-center justify-between px-4 py-2.5 ${result.success ? 'bg-emerald-50' : 'bg-red-50'} border-b ${result.success ? 'border-emerald-200' : 'border-red-200'}`}>
              <div className="flex items-center gap-2">
                {result.success
                  ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                  : <XCircle className="w-4 h-4 text-red-500" />
                }
                <span className={`text-sm font-medium ${result.success ? 'text-emerald-700' : 'text-red-700'}`}>
                  {result.success ? '执行成功' : '执行失败'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{result.totalDuration}ms</span>
                <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{result.totalTokens} tokens</span>
              </div>
            </div>

            {/* 步骤结果 */}
            {result.stepResults && result.stepResults.length > 0 && (
              <div className="px-4 py-3 border-b border-slate-100">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">步骤执行</h4>
                <div className="space-y-1">
                  {result.stepResults.map((sr) => (
                    <div key={sr.stepId} className="flex items-center gap-2 text-xs">
                      {sr.status === 'success'
                        ? <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        : sr.status === 'skipped'
                          ? <AlertTriangle className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          : <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                      }
                      <span className="text-slate-700 font-medium">{sr.stepId}</span>
                      <span className="text-slate-400">{sr.duration}ms</span>
                      {sr.outputSummary && <span className="text-slate-500 truncate">{sr.outputSummary}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 输出内容 */}
            <div className="px-4 py-3">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">输出结果</h4>
              <pre className="bg-white rounded-lg border border-slate-200 p-3 text-xs text-slate-700 max-h-[300px] overflow-auto whitespace-pre-wrap font-mono">
                {typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* 执行历史 */}
        {showHistory && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-bold text-slate-600">最近执行记录</span>
            </div>
            {historyLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
            ) : execHistory.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">暂无执行记录</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {execHistory.map(exec => (
                  <div key={exec.executionId} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                    {exec.status === 'success'
                      ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    }
                    <span className="text-slate-600 font-medium">{exec.status === 'success' ? '成功' : '失败'}</span>
                    <span className="text-slate-400">{exec.totalDuration}ms</span>
                    <span className="text-slate-400">{exec.totalTokens} tokens</span>
                    <span className="text-slate-400 ml-auto">{new Date(exec.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 路由匹配测试面板 ────────────────────────────────────────────────────────

const RouteMatchPanel = ({ lang }: { lang: 'zh' | 'en' }) => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    matched: boolean; skillKey?: string; skillName?: string;
    confidence?: number; method?: string; matchedTrigger?: string;
  } | null>(null);

  const handleTest = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await testSkillMatch(message);
      setResult(res);
    } catch { /* 拦截器已处理 */ }
    finally { setLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTest();
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* 说明 */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
        <Target className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold text-amber-800">
            {lang === 'zh' ? '路由匹配测试' : 'Route Match Test'}
          </h3>
          <p className="text-xs text-amber-700 mt-1">
            {lang === 'zh'
              ? '输入一条用户消息，系统会自动匹配最合适的 Skill。这可以帮助你理解 Skill 的触发机制，以及在对话中哪些消息会自动调用 Skill。'
              : 'Enter a user message and the system will automatically match the most suitable Skill. This helps you understand how Skills are triggered.'}
          </p>
        </div>
      </div>

      {/* 输入区 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex gap-2">
          <textarea
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 resize-none"
            rows={3}
            placeholder={lang === 'zh'
              ? '输入用户消息，例如：\n• 帮我搜索一下 React 19 的新特性\n• 审查一下这段代码的安全性\n• 翻译这段话成英文'
              : 'Enter a user message, e.g.:\n• Search for React 19 new features\n• Review this code for security\n• Translate this text to English'}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="输入测试消息"
            tabIndex={0}
          />
        </div>
        <button
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
          onClick={handleTest}
          disabled={loading || !message.trim()}
          tabIndex={0}
          aria-label="测试匹配"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> 匹配中...</>
          ) : (
            <><Send className="w-4 h-4" /> {lang === 'zh' ? '测试匹配' : 'Test Match'}</>
          )}
        </button>
      </div>

      {/* 匹配结果 */}
      {result && (
        <div className={`rounded-2xl border overflow-hidden ${result.matched ? 'border-emerald-200' : 'border-slate-200'}`}>
          <div className={`flex items-center gap-2 px-5 py-3 ${result.matched ? 'bg-emerald-50' : 'bg-slate-50'} border-b ${result.matched ? 'border-emerald-200' : 'border-slate-200'}`}>
            {result.matched
              ? <CheckCircle className="w-4 h-4 text-emerald-500" />
              : <XCircle className="w-4 h-4 text-slate-400" />
            }
            <span className={`text-sm font-bold ${result.matched ? 'text-emerald-700' : 'text-slate-500'}`}>
              {result.matched ? '匹配成功' : '未匹配到 Skill'}
            </span>
          </div>
          <div className="bg-white p-5">
            {result.matched ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">匹配 Skill</span>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">{result.skillName}</p>
                    <p className="text-xs text-slate-500">{result.skillKey}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">置信度</span>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">{((result.confidence || 0) * 100).toFixed(0)}%</p>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${(result.confidence || 0) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">匹配方式</span>
                    <p className="text-xs text-slate-700 mt-0.5">
                      {result.method === 'keyword' ? '🔤 关键词匹配 (L1)' :
                       result.method === 'pattern' ? '🔣 正则匹配 (L2)' :
                       result.method === 'context' ? '📋 上下文规则 (L2)' :
                       result.method === 'llm' ? '🧠 LLM 意图识别 (L3)' :
                       result.method}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">触发项</span>
                    <p className="text-xs text-slate-700 mt-0.5">{result.matchedTrigger || '-'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {lang === 'zh'
                  ? '该消息未匹配到任何 Skill，将降级到普通 Chat 对话。你可以尝试使用 Skill 的触发关键词。'
                  : 'No Skill matched. The message will fall back to normal Chat. Try using Skill trigger keywords.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 主页面 ──────────────────────────────────────────────────────────────────

type TabKey = 'gallery' | 'try' | 'match';

const SkillOrchestratorPage = () => {
  const { lang } = useAppStore();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [trySkill, setTrySkill] = useState<Skill | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('gallery');
  const [stats, setStats] = useState<{
    totalSkills: number; activeSkills: number; totalExecutions: number;
    recentSuccessRate: number; avgDuration: number; topSkills: Array<{ key: string; count: number }>;
  } | null>(null);

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

  const handleTrySkill = (skill: Skill) => {
    setTrySkill(skill);
    setActiveTab('try');
  };

  const TAB_CONFIG: Array<{ key: TabKey; label: string; labelEn: string; icon: typeof Zap }> = [
    { key: 'gallery', label: '🎯 Skill 能力库', labelEn: '🎯 Skill Gallery', icon: Sparkles },
    { key: 'try',     label: '🧪 试用 Skill',   labelEn: '🧪 Try Skill',     icon: Play },
    { key: 'match',   label: '🔍 路由匹配测试', labelEn: '🔍 Route Match',   icon: Target },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* 顶部 */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Zap className="w-6 h-6 text-amber-500" />
              {lang === 'zh' ? 'Skill 能力中心' : 'Skill Center'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {lang === 'zh'
                ? '探索和试用 AI Skill，了解自动化能力编排'
                : 'Explore and try AI Skills, understand automated capability orchestration'}
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
              { label: '平均耗时', value: stats.avgDuration > 0 ? `${(stats.avgDuration / 1000).toFixed(1)}s` : '-', icon: '⏱️' },
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

        {/* Tab 切换 */}
        <div className="flex items-center gap-1 mt-4 bg-slate-100 rounded-lg p-1 w-fit">
          {TAB_CONFIG.map(tab => (
            <button
              key={tab.key}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setActiveTab(tab.key)}
              tabIndex={0}
              aria-label={tab.label}
            >
              {lang === 'zh' ? tab.label : tab.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">

          {/* Tab: Skill 能力库 */}
          {activeTab === 'gallery' && (
            <>
              {/* 搜索和筛选 */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-slate-200 focus-within:border-violet-400 flex-1 max-w-xs">
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

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                </div>
              ) : skills.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{lang === 'zh' ? '暂无 Skill' : 'No skills yet'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {skills.map(skill => (
                    <SkillCard
                      key={skill.key}
                      skill={skill}
                      onTry={handleTrySkill}
                      isSelected={trySkill?.key === skill.key}
                    />
                  ))}
                </div>
              )}

              {/* 热门 Skill 排行 */}
              {stats && stats.topSkills.length > 0 && (
                <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-amber-500" />
                    {lang === 'zh' ? '热门 Skill 排行' : 'Top Skills'}
                  </h3>
                  <div className="space-y-2">
                    {stats.topSkills.map((ts, i) => {
                      const skill = skills.find(s => s.key === ts.key);
                      const maxCount = stats.topSkills[0]?.count || 1;
                      return (
                        <div key={ts.key} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-400 w-5 text-right">#{i + 1}</span>
                          <span className="text-sm flex-shrink-0">{skill?.icon || '⚡'}</span>
                          <span className="text-xs font-medium text-slate-700 w-32 truncate">{skill?.name || ts.key}</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-violet-400 to-purple-500 rounded-full transition-all"
                              style={{ width: `${(ts.count / maxCount) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 w-12 text-right">{ts.count} 次</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Tab: 试用 Skill */}
          {activeTab === 'try' && (
            <div className="max-w-3xl mx-auto">
              {trySkill ? (
                <TrySkillPanel
                  skill={trySkill}
                  onClose={() => { setTrySkill(null); setActiveTab('gallery'); }}
                  lang={lang}
                />
              ) : (
                <div className="text-center py-12">
                  <Sparkles className="w-12 h-12 text-violet-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-700 mb-2">
                    {lang === 'zh' ? '选择一个 Skill 开始试用' : 'Select a Skill to try'}
                  </h3>
                  <p className="text-sm text-slate-400 mb-6">
                    {lang === 'zh'
                      ? '回到「Skill 能力库」标签页，点击任意 Skill 的「试用」按钮'
                      : 'Go to "Skill Gallery" tab and click "Try" on any Skill'}
                  </p>
                  <button
                    className="px-5 py-2 rounded-xl text-sm font-medium bg-violet-50 text-violet-600 hover:bg-violet-100 border border-violet-200 transition-colors"
                    onClick={() => setActiveTab('gallery')}
                    tabIndex={0}
                    aria-label="前往 Skill 能力库"
                  >
                    {lang === 'zh' ? '前往 Skill 能力库' : 'Go to Skill Gallery'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab: 路由匹配测试 */}
          {activeTab === 'match' && (
            <RouteMatchPanel lang={lang} />
          )}
        </div>
      </div>
    </div>
  );
};

export default SkillOrchestratorPage;
