import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Cpu, Play, Zap, ChevronDown, ChevronRight, CheckCircle2,
  XCircle, Clock, SkipForward, Loader2, Wrench, ListChecks,
  AlertCircle, Send, RotateCcw, ChevronUp, Brain, Eye, Lightbulb,
} from 'lucide-react';
import clsx from 'clsx';
import {
  analyzeTaskComplexity,
  generateAgentPlan,
  executeAgentPlan,
  fetchAgentTools,
  callAgentTool,
  executeReActLoop,
} from '../api';
import type { ExecutionPlan, PlanStep, StepStatus, TaskComplexity, ToolDefinition, PlanSSEEvent, ReActSSEEvent } from '../types';
import { useActiveProvider } from '../store';

// ─── 常量 ──────────────────────────────────────────────────────────────────────

const COMPLEXITY_CONFIG: Record<TaskComplexity, { label: string; color: string; bg: string; desc: string }> = {
  simple:   { label: '简单',   color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200',  desc: '单步直出，无需规划' },
  moderate: { label: '中等',   color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',      desc: '生成 + 验证（2-3步）' },
  complex:  { label: '复杂',   color: 'text-rose-600',    bg: 'bg-rose-50 border-rose-200',        desc: '多步规划（3-6步）' },
};

const STATUS_CONFIG: Record<StepStatus, { icon: React.ElementType; color: string; label: string }> = {
  pending:  { icon: Clock,         color: 'text-slate-400',   label: '等待中' },
  running:  { icon: Loader2,       color: 'text-sky-500',     label: '执行中' },
  done:     { icon: CheckCircle2,  color: 'text-emerald-500', label: '完成'   },
  failed:   { icon: XCircle,       color: 'text-rose-500',    label: '失败'   },
  skipped:  { icon: SkipForward,   color: 'text-slate-400',   label: '已跳过' },
};

const EXAMPLE_PROMPTS = [
  '创建一个任务管理工具页面，支持添加、删除、标记完成',
  '生成一个数据可视化仪表盘，包含折线图、饼图和统计卡片',
  '修改按钮颜色为蓝色，字体大小改为 16px',
  '构建一个完整的电商商品管理系统，包含商品列表、详情、购物车',
];

// ─── 子组件：步骤卡片 ──────────────────────────────────────────────────────────

interface StepCardProps {
  step: PlanStep;
  isActive: boolean;
}

const StepCard = ({ step, isActive }: StepCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[step.status];
  const Icon = cfg.icon;

  return (
    <div
      className={clsx(
        'rounded-xl border transition-all duration-200',
        isActive ? 'border-sky-300 bg-sky-50 shadow-sm' : 'border-slate-200 bg-white',
        step.status === 'failed' && 'border-rose-200 bg-rose-50'
      )}
    >
      {/* 头部 */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        role="button"
        tabIndex={0}
        aria-label={`步骤 ${step.index}：${step.title}`}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded((v) => !v)}
      >
        {/* 序号 */}
        <div className={clsx(
          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
          step.status === 'done'    && 'bg-emerald-100 text-emerald-700',
          step.status === 'running' && 'bg-sky-100 text-sky-700',
          step.status === 'failed'  && 'bg-rose-100 text-rose-700',
          step.status === 'pending' && 'bg-slate-100 text-slate-500',
          step.status === 'skipped' && 'bg-slate-100 text-slate-400',
        )}>
          {step.index}
        </div>

        {/* 标题 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800 truncate">{step.title}</span>
            {step.tools.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Wrench className="w-3 h-3" />
                {step.tools.length}
              </span>
            )}
            {step.retryCount > 0 && (
              <span className="text-xs text-amber-500 flex items-center gap-0.5">
                <RotateCcw className="w-3 h-3" />
                {step.retryCount}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 truncate mt-0.5">{step.description}</p>
        </div>

        {/* 状态 */}
        <div className={clsx('flex items-center gap-1.5 text-xs font-medium flex-shrink-0', cfg.color)}>
          <Icon className={clsx('w-4 h-4', step.status === 'running' && 'animate-spin')} />
          <span className="hidden sm:inline">{cfg.label}</span>
        </div>

        {/* 展开箭头 */}
        {(step.result || step.error || step.tools.length > 0) && (
          expanded ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
          {/* 工具列表 */}
          {step.tools.length > 0 && (
            <div className="pt-3">
              <p className="text-xs font-medium text-slate-500 mb-1.5">使用工具</p>
              <div className="flex flex-wrap gap-1.5">
                {step.tools.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-mono">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 预期输出 */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">预期输出</p>
            <p className="text-xs text-slate-600">{step.expectedOutput}</p>
          </div>

          {/* 实际结果 */}
          {step.result && (
            <div>
              <p className="text-xs font-medium text-emerald-600 mb-1">执行结果</p>
              <pre className="text-xs text-slate-700 bg-slate-50 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words">
                {step.result}
              </pre>
            </div>
          )}

          {/* 错误信息 */}
          {step.error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700">{step.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── 子组件：工具面板 ──────────────────────────────────────────────────────────

interface ToolsPanelProps {
  tools: ToolDefinition[];
}

const ToolsPanel = ({ tools }: ToolsPanelProps) => {
  const [selected, setSelected] = useState<ToolDefinition | null>(null);
  const [args, setArgs] = useState('{}');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleRun = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    setResult('');
    try {
      const parsed = JSON.parse(args);
      const res = await callAgentTool(selected.name, parsed);
      setResult(JSON.stringify(res, null, 2));
    } catch (err) {
      setResult(`错误：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [selected, args]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {tools.map((tool) => (
          <button
            key={tool.name}
            className={clsx(
              'text-left px-3 py-2.5 rounded-xl border text-sm transition-all duration-150',
              selected?.name === tool.name
                ? 'border-sky-400 bg-sky-50 text-sky-700'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            )}
            onClick={() => { setSelected(tool); setArgs('{}'); setResult(''); }}
            aria-label={`选择工具 ${tool.name}`}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setSelected(tool)}
          >
            <div className="font-mono text-xs font-semibold mb-0.5">{tool.name}</div>
            <div className="text-xs text-slate-500 line-clamp-2">{tool.description}</div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800 font-mono">{selected.name}</span>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 transition-colors disabled:opacity-50"
              onClick={handleRun}
              disabled={loading}
              aria-label="执行工具"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              执行
            </button>
          </div>

          {/* 参数编辑 */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">参数（JSON）</p>
            <textarea
              className="w-full h-24 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono text-slate-700 focus:outline-none focus:border-sky-400 resize-none"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              aria-label="工具参数"
              spellCheck={false}
            />
          </div>

          {/* 参数说明 */}
          {Object.keys(selected.parameters.properties).length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">参数说明</p>
              <div className="space-y-1">
                {Object.entries(selected.parameters.properties).map(([key, param]) => (
                  <div key={key} className="flex gap-2 text-xs">
                    <span className="font-mono text-sky-600 flex-shrink-0">{key}</span>
                    <span className="text-slate-400">—</span>
                    <span className="text-slate-600">{param.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 执行结果 */}
          {result && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">执行结果</p>
              <pre className="text-xs text-slate-700 bg-slate-50 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap break-words border border-slate-100">
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── 主页面 ────────────────────────────────────────────────────────────────────

type TabKey = 'plan' | 'react' | 'tools';

const AgentPlanPage = () => {
  const activeProvider = useActiveProvider();

  // 输入
  const [prompt, setPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('plan');

  // 规划状态
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [steps, setSteps] = useState<PlanStep[]>([]);
  const [complexity, setComplexity] = useState<{ value: TaskComplexity; reason: string } | null>(null);
  const [finalResult, setFinalResult] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [activeStepId, setActiveStepId] = useState('');

  // 工具
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [toolsLoaded, setToolsLoaded] = useState(false);

  // ReAct 状态
  const [reactSteps, setReactSteps] = useState<Array<{ index: number; thought: string; action?: string; actionInput?: Record<string, unknown>; observation?: string; isFinal: boolean; finalAnswer?: string; duration: number }>>([]);
  const [reactRunning, setReactRunning] = useState(false);
  const [reactResult, setReactResult] = useState<{ finalAnswer: string; totalSteps: number; toolCallCount: number; totalDuration: number } | null>(null);

  const cleanupRef = useRef<(() => void) | null>(null);

  // 加载工具列表
  useEffect(() => {
    if (activeTab !== 'tools' || toolsLoaded) return;
    fetchAgentTools()
      .then((res) => { setTools(res.tools); setToolsLoaded(true); })
      .catch(() => {});
  }, [activeTab, toolsLoaded]);

  // ReAct 执行
  const handleReActExecute = useCallback(() => {
    if (!prompt.trim() || reactRunning) return;
    setReactSteps([]);
    setReactResult(null);
    setReactRunning(true);
    setErrorMsg('');

    const cleanup = executeReActLoop(
      prompt.trim(),
      { provider: activeProvider },
      (event: ReActSSEEvent) => {
        switch (event.type) {
          case 'react_step':
            setReactSteps((prev) => [...prev, event.step]);
            break;
          case 'done':
            setReactResult({
              finalAnswer: event.finalAnswer,
              totalSteps: event.totalSteps,
              toolCallCount: event.toolCallCount,
              totalDuration: event.totalDuration,
            });
            setReactRunning(false);
            break;
          case 'error':
            setErrorMsg(event.message);
            setReactRunning(false);
            break;
        }
      },
      (err) => {
        setErrorMsg(err.message);
        setReactRunning(false);
      }
    );
    cleanupRef.current = cleanup;
  }, [prompt, reactRunning, activeProvider]);

  // 重置
  const handleReset = useCallback(() => {
    cleanupRef.current?.();
    setPlan(null);
    setSteps([]);
    setComplexity(null);
    setFinalResult('');
    setIsRunning(false);
    setIsDone(false);
    setErrorMsg('');
    setStatusMsg('');
    setActiveStepId('');
  }, []);

  // 执行
  const handleExecute = useCallback(() => {
    if (!prompt.trim() || isRunning) return;
    handleReset();
    setIsRunning(true);
    setStatusMsg('正在分析任务...');

    const cleanup = executeAgentPlan(
      prompt.trim(),
      { provider: activeProvider },
      (event: PlanSSEEvent) => {
        switch (event.type) {
          case 'start':
            setStatusMsg(event.message);
            break;

          case 'analyze':
            setComplexity({ value: event.complexity, reason: event.reason });
            setStatusMsg(`复杂度：${event.complexity}`);
            break;

          case 'planning':
            setStatusMsg(event.message);
            break;

          case 'plan_ready': {
            const p = event.plan as ExecutionPlan;
            setPlan(p);
            setSteps(p.steps ?? []);
            setStatusMsg(`计划已生成，共 ${p.totalSteps} 步`);
            break;
          }

          case 'step_update': {
            const s = event.step;
            setActiveStepId(s.status === 'running' ? s.id : '');
            setSteps((prev) =>
              prev.map((st) =>
                st.id === s.id
                  ? { ...st, status: s.status, result: s.result, error: s.error, retryCount: s.retryCount }
                  : st
              )
            );
            if (s.status === 'running') setStatusMsg(`执行第 ${s.index} 步：${s.title}`);
            break;
          }

          case 'done':
            setFinalResult(event.finalResult);
            setIsRunning(false);
            setIsDone(true);
            setActiveStepId('');
            setStatusMsg(event.success ? '✅ 全部步骤执行完成' : '⚠️ 部分步骤未完成');
            // 同步最终步骤状态
            if (event.plan?.steps) {
              setSteps((prev) =>
                prev.map((st) => {
                  const updated = (event.plan.steps as PlanStep[]).find((s) => s.id === st.id);
                  return updated ? { ...st, ...updated } : st;
                })
              );
            }
            break;

          case 'error':
            setErrorMsg(event.message);
            setIsRunning(false);
            setStatusMsg('');
            break;
        }
      },
      (err) => {
        setErrorMsg(err.message);
        setIsRunning(false);
        setStatusMsg('');
      }
    );

    cleanupRef.current = cleanup;
  }, [prompt, isRunning, activeProvider, handleReset]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleExecute();
    },
    [handleExecute]
  );

  const complexityCfg = complexity ? COMPLEXITY_CONFIG[complexity.value] : null;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* 顶部标题栏 */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <ListChecks className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">Agent 任务规划器</h1>
            <p className="text-xs text-slate-400">Plan-Execute 模式 · 自动分析复杂度 · 多步执行</p>
          </div>

          {/* Tab 切换 */}
          <div className="ml-auto flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {([['plan', '规划执行', ListChecks], ['react', 'ReAct 自主', Brain], ['tools', '工具调试', Wrench]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  activeTab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
                onClick={() => setActiveTab(key)}
                aria-label={label}
                tabIndex={0}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 主体 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

          {/* ── 规划执行 Tab ── */}
          {activeTab === 'plan' && (
            <>
              {/* 输入区 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                <label className="text-sm font-semibold text-slate-700" htmlFor="plan-prompt">
                  描述你的任务
                </label>
                <textarea
                  id="plan-prompt"
                  className="w-full h-28 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:bg-white resize-none transition-colors"
                  placeholder="例如：创建一个任务管理工具页面，支持添加、删除、标记完成..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  aria-label="任务描述输入框"
                  disabled={isRunning}
                />

                {/* 示例提示 */}
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p}
                      className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs hover:bg-sky-50 hover:text-sky-600 transition-colors truncate max-w-[200px]"
                      onClick={() => setPrompt(p)}
                      tabIndex={0}
                      aria-label={`使用示例：${p}`}
                    >
                      {p.slice(0, 24)}…
                    </button>
                  ))}
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    onClick={handleExecute}
                    disabled={!prompt.trim() || isRunning}
                    aria-label="开始执行规划"
                    tabIndex={0}
                  >
                    {isRunning
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Send className="w-4 h-4" />}
                    {isRunning ? '执行中...' : '开始规划'}
                  </button>

                  {(plan || errorMsg) && (
                    <button
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
                      onClick={handleReset}
                      aria-label="重置"
                      tabIndex={0}
                    >
                      <RotateCcw className="w-4 h-4" />
                      重置
                    </button>
                  )}

                  <span className="ml-auto text-xs text-slate-400">Ctrl+Enter 快速执行</span>
                </div>
              </div>

              {/* 错误提示 */}
              {errorMsg && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200">
                  <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-rose-700">执行出错</p>
                    <p className="text-xs text-rose-600 mt-0.5">{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* 复杂度分析结果 */}
              {complexityCfg && complexity && (
                <div className={clsx('flex items-start gap-3 p-4 rounded-xl border', complexityCfg.bg)}>
                  <Cpu className={clsx('w-5 h-5 flex-shrink-0 mt-0.5', complexityCfg.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={clsx('text-sm font-semibold', complexityCfg.color)}>
                        {complexityCfg.label}任务
                      </span>
                      <span className="text-xs text-slate-400">— {complexityCfg.desc}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{complexity.reason}</p>
                  </div>
                </div>
              )}

              {/* 状态消息 */}
              {statusMsg && (isRunning || isDone) && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm">
                  {isRunning && <Loader2 className="w-4 h-4 animate-spin text-sky-500 flex-shrink-0" />}
                  {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                  {statusMsg}
                </div>
              )}

              {/* 计划概览 */}
              {plan && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-sky-500" />
                    <span className="text-sm font-semibold text-slate-800">执行计划</span>
                    <span className="ml-auto text-xs text-slate-400">{plan.totalSteps} 步</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">{plan.goal}</p>

                  {/* 步骤列表 */}
                  <div className="space-y-2">
                    {steps.map((step) => (
                      <StepCard key={step.id} step={step} isActive={activeStepId === step.id} />
                    ))}
                  </div>
                </div>
              )}

              {/* 最终结果 */}
              {isDone && finalResult && (
                <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-semibold text-slate-800">最终结果</span>
                  </div>
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
                    {finalResult}
                  </pre>
                </div>
              )}
            </>
          )}

          {/* ── ReAct 自主决策 Tab ── */}
          {activeTab === 'react' && (
            <>
              {/* 输入区 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2" htmlFor="react-prompt">
                  <Brain className="w-4 h-4 text-violet-500" />
                  ReAct 自主决策模式
                </label>
                <p className="text-xs text-slate-400">
                  Agent 会自主思考、调用工具、观察结果，循环直到找到答案。适合复杂的探索性任务。
                </p>
                <textarea
                  id="react-prompt"
                  className="w-full h-28 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:bg-white resize-none transition-colors"
                  placeholder="例如：帮我分析一下项目中有哪些 Agent，并推荐最适合做代码审查的..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={reactRunning}
                  aria-label="ReAct 任务描述"
                />
                <div className="flex items-center gap-2">
                  <button
                    className={clsx(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                      reactRunning
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
                    )}
                    onClick={handleReActExecute}
                    disabled={reactRunning || !prompt.trim()}
                    tabIndex={0}
                    aria-label="开始 ReAct 循环"
                  >
                    {reactRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                    {reactRunning ? '思考中...' : '开始思考'}
                  </button>
                  {(reactSteps.length > 0 || reactResult) && (
                    <button
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-slate-500 hover:bg-slate-100 transition-colors"
                      onClick={() => { setReactSteps([]); setReactResult(null); setErrorMsg(''); }}
                      tabIndex={0}
                      aria-label="重置"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      重置
                    </button>
                  )}
                </div>
              </div>

              {/* ReAct 步骤时间线 */}
              {reactSteps.length > 0 && (
                <div className="space-y-3">
                  {reactSteps.map((step, i) => (
                    <div key={i} className={clsx(
                      'rounded-xl border p-4 space-y-2 transition-all',
                      step.isFinal ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
                    )}>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-mono">#{step.index}</span>
                        <span className="text-slate-300">|</span>
                        <span>{step.duration}ms</span>
                      </div>

                      {/* Thought */}
                      <div className="flex items-start gap-2">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-slate-700">
                          <span className="text-xs font-semibold text-amber-600 mr-1">Thought:</span>
                          {step.thought}
                        </div>
                      </div>

                      {/* Action */}
                      {step.action && (
                        <div className="flex items-start gap-2">
                          <Wrench className="w-3.5 h-3.5 text-sky-500 mt-0.5 flex-shrink-0" />
                          <div className="text-sm">
                            <span className="text-xs font-semibold text-sky-600 mr-1">Action:</span>
                            <code className="text-xs bg-sky-50 px-1.5 py-0.5 rounded text-sky-700">{step.action}</code>
                            {step.actionInput && Object.keys(step.actionInput).length > 0 && (
                              <pre className="mt-1 text-[10px] bg-slate-50 rounded-lg p-2 text-slate-600 overflow-auto max-h-24">
                                {JSON.stringify(step.actionInput, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Observation */}
                      {step.observation && (
                        <div className="flex items-start gap-2">
                          <Eye className="w-3.5 h-3.5 text-violet-500 mt-0.5 flex-shrink-0" />
                          <div className="text-sm">
                            <span className="text-xs font-semibold text-violet-600 mr-1">Observation:</span>
                            <pre className="mt-1 text-[10px] bg-slate-50 rounded-lg p-2 text-slate-600 overflow-auto max-h-32 whitespace-pre-wrap">
                              {step.observation}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Final Answer */}
                      {step.finalAnswer && (
                        <div className="flex items-start gap-2 mt-2 pt-2 border-t border-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-emerald-800 whitespace-pre-wrap">
                            {step.finalAnswer}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ReAct 结果统计 */}
              {reactResult && (
                <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-4">
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>✅ 完成</span>
                    <span>步骤: {reactResult.totalSteps}</span>
                    <span>工具调用: {reactResult.toolCallCount} 次</span>
                    <span>总耗时: {(reactResult.totalDuration / 1000).toFixed(1)}s</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── 工具调试 Tab ── */}
          {activeTab === 'tools' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-4">
                <Wrench className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-800">工具调试面板</span>
                {toolsLoaded && (
                  <span className="ml-auto text-xs text-slate-400">{tools.length} 个工具</span>
                )}
              </div>

              {!toolsLoaded ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span className="text-sm">加载工具列表...</span>
                </div>
              ) : (
                <ToolsPanel tools={tools} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentPlanPage;
