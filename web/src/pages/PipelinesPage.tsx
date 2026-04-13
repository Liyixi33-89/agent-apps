import { useState, useEffect, useMemo } from 'react';
import { GitBranch, Loader2, Search, X, Filter, Play, ArrowRight, Sparkles, Zap, ChevronRight, ExternalLink, Lightbulb, LayoutGrid, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchPipelines } from '../api';
import { useLang } from '../store';
import type { Pipeline } from '../types';

// ─── 预设应用场景模板 ─────────────────────────────────────────────────────────

interface ScenarioTemplate {
  id: string;
  icon: string;
  title: { zh: string; en: string };
  desc: { zh: string; en: string };
  prompt: string;
  pipelineType: 'vibe' | 'fullstack';
  tags: string[];
  color: string;
}

const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: 'dashboard',
    icon: '📊',
    title: { zh: '数据仪表盘', en: 'Data Dashboard' },
    desc: { zh: '生成带图表和统计卡片的管理后台仪表盘', en: 'Generate admin dashboard with charts and stat cards' },
    prompt: '一个现代化的数据仪表盘，包含：4个统计卡片（用户数、收入、订单、转化率），一个折线图展示近7天趋势，一个饼图展示分类占比，一个最近订单列表。使用渐变色卡片和圆角设计。',
    pipelineType: 'vibe',
    tags: ['管理后台', '图表', 'UI'],
    color: 'from-sky-500 to-blue-600',
  },
  {
    id: 'landing',
    icon: '🚀',
    title: { zh: '产品落地页', en: 'Landing Page' },
    desc: { zh: '生成带动画效果的产品宣传页', en: 'Generate product landing page with animations' },
    prompt: '一个 SaaS 产品落地页，包含：Hero 区域（大标题+副标题+CTA按钮+产品截图）、3个核心功能介绍卡片（带图标）、用户评价轮播、价格方案对比表（3列）、FAQ 手风琴、底部 CTA。要求现代简约风格，有微动画效果。',
    pipelineType: 'vibe',
    tags: ['营销', '落地页', '动画'],
    color: 'from-violet-500 to-purple-600',
  },
  {
    id: 'todo-fullstack',
    icon: '✅',
    title: { zh: '全栈待办应用', en: 'Full-Stack Todo App' },
    desc: { zh: '前后端完整的任务管理应用，含数据库', en: 'Complete task management app with backend and database' },
    prompt: '一个全栈待办事项应用：支持添加/完成/删除任务，任务分优先级（高/中/低），支持分类标签，有进度统计，数据持久化到 MongoDB。前端用 React 风格，后端提供 RESTful API。',
    pipelineType: 'fullstack',
    tags: ['全栈', 'CRUD', '数据库'],
    color: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'chat-ui',
    icon: '💬',
    title: { zh: '聊天界面', en: 'Chat Interface' },
    desc: { zh: '仿微信/Slack 的实时聊天界面', en: 'Real-time chat UI like WeChat/Slack' },
    prompt: '一个现代聊天应用界面：左侧联系人列表（头像+名称+最后消息+时间+未读数），右侧聊天区域（消息气泡+时间戳+已读状态），底部输入框（支持表情、附件按钮），顶部显示对方信息。支持深色/浅色主题切换。',
    pipelineType: 'vibe',
    tags: ['社交', '实时', 'UI'],
    color: 'from-amber-500 to-orange-600',
  },
  {
    id: 'ecommerce',
    icon: '🛒',
    title: { zh: '全栈电商系统', en: 'Full-Stack E-Commerce' },
    desc: { zh: '含商品管理、购物车、订单的电商系统', en: 'E-commerce with products, cart, and orders' },
    prompt: '一个全栈电商系统：商品列表页（网格展示、搜索、分类筛选、价格排序）、商品详情页、购物车（增删改数量、小计合计）、简易结算页面。后端提供商品CRUD、购物车、订单API，MongoDB存储。',
    pipelineType: 'fullstack',
    tags: ['全栈', '电商', '复杂'],
    color: 'from-rose-500 to-pink-600',
  },
  {
    id: 'kanban',
    icon: '📋',
    title: { zh: '看板应用', en: 'Kanban Board' },
    desc: { zh: '可拖拽的项目管理看板', en: 'Draggable project management kanban board' },
    prompt: '一个项目管理看板：3个列（待办/进行中/已完成），每列可添加卡片，卡片包含标题、描述、优先级标签、负责人头像。支持拖拽卡片在列之间移动。顶部有项目名称和成员头像组。现代简约设计。',
    pipelineType: 'vibe',
    tags: ['项目管理', '拖拽', 'UI'],
    color: 'from-indigo-500 to-blue-600',
  },
];

// ─── 流程步骤可视化 ──────────────────────────────────────────────────────────

const StepFlow = ({ steps, lang }: { steps: Pipeline['steps']; lang: 'zh' | 'en' }) => (
  <div className="flex items-center gap-1 overflow-x-auto py-1">
    {steps
      .sort((a, b) => a.order - b.order)
      .map((step, i) => (
        <div key={step.key} className="flex items-center gap-1 flex-shrink-0">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
              {i + 1}
            </span>
            <span className="text-xs text-slate-700 font-medium whitespace-nowrap">
              {lang === 'zh' ? step.title.zh : step.title.en}
            </span>
            <span className="text-[10px]">{step.modelType === 'vision' ? '👁️' : '💬'}</span>
          </div>
          {i < steps.length - 1 && (
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
          )}
        </div>
      ))}
  </div>
);

// ─── 主页面 ──────────────────────────────────────────────────────────────────

const PipelinesPage = () => {
  const lang = useLang();
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [modelFilter, setModelFilter] = useState<'all' | 'text' | 'vision'>('all');
  const [activeTab, setActiveTab] = useState<'scenarios' | 'pipelines'>('scenarios');
  const [selectedScenario, setSelectedScenario] = useState<ScenarioTemplate | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  useEffect(() => {
    fetchPipelines()
      .then(setPipelines)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 搜索和筛选
  const filteredPipelines = useMemo(() => {
    return pipelines.filter((p) => {
      if (searchText) {
        const q = searchText.toLowerCase();
        const nameMatch = (lang === 'zh' ? p.name.zh : p.name.en).toLowerCase().includes(q);
        const descMatch = (lang === 'zh' ? p.description.zh : p.description.en).toLowerCase().includes(q);
        const stepMatch = p.steps.some((s) =>
          (lang === 'zh' ? s.title.zh : s.title.en).toLowerCase().includes(q)
        );
        if (!nameMatch && !descMatch && !stepMatch) return false;
      }
      if (modelFilter !== 'all') {
        if (!p.steps.some((s) => s.modelType === modelFilter)) return false;
      }
      return true;
    });
  }, [pipelines, searchText, modelFilter, lang]);

  // 运行场景 → 跳转到 Vibe Coding 并携带 prompt
  const handleRunScenario = (scenario: ScenarioTemplate) => {
    // 通过 URL 参数传递 prompt 到 Vibe Coding 页面
    const params = new URLSearchParams({
      prompt: scenario.prompt,
      mode: scenario.pipelineType === 'fullstack' ? 'fullstack' : 'pipeline',
    });
    navigate(`/vibe?${params.toString()}`);
  };

  const handleRunCustom = () => {
    if (!customPrompt.trim()) return;
    const params = new URLSearchParams({ prompt: customPrompt.trim(), mode: 'pipeline' });
    navigate(`/vibe?${params.toString()}`);
  };

  return (
    <div className="h-full flex flex-col">
      {/* 顶部标题 */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <GitBranch className="w-6 h-6 text-violet-600" />
              {lang === 'zh' ? '工作流中心' : 'Workflow Hub'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {lang === 'zh'
                ? '选择应用场景，一键启动 AI 多步骤协作流水线'
                : 'Select a scenario to launch AI multi-step collaboration pipeline'}
            </p>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="flex items-center gap-1 mt-4 bg-slate-100 rounded-lg p-1 w-fit">
          {([
            { key: 'scenarios' as const, icon: Lightbulb, label: lang === 'zh' ? '应用场景' : 'Scenarios' },
            { key: 'pipelines' as const, icon: GitBranch, label: lang === 'zh' ? '流水线定义' : 'Pipeline Definitions' },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === key
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setActiveTab(key)}
              aria-label={label}
              tabIndex={0}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">

        {/* ─── 应用场景 Tab ─── */}
        {activeTab === 'scenarios' && (
          <div className="max-w-6xl mx-auto px-6 py-6 space-y-8">

            {/* 自定义输入区 */}
            <div className="rounded-2xl border-2 border-dashed border-violet-200 bg-gradient-to-br from-violet-50 to-sky-50 p-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-violet-500" />
                <h2 className="text-base font-bold text-slate-800">
                  {lang === 'zh' ? '自定义需求' : 'Custom Requirement'}
                </h2>
                <span className="text-xs text-slate-400">
                  {lang === 'zh' ? '输入你的想法，AI 多 Agent 协作完成' : 'Describe your idea, AI agents will collaborate'}
                </span>
              </div>
              <div className="flex gap-3">
                <textarea
                  className="flex-1 h-20 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-400 resize-none shadow-sm"
                  placeholder={lang === 'zh'
                    ? '描述你想要生成的应用，例如：一个天气预报应用，支持城市搜索、5天预报、温度曲线图...'
                    : 'Describe the app you want to generate...'}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  aria-label="自定义需求"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRunCustom();
                  }}
                />
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm ${
                      !customPrompt.trim()
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-violet-600 text-white hover:bg-violet-700'
                    }`}
                    onClick={handleRunCustom}
                    disabled={!customPrompt.trim()}
                    aria-label="开始生成"
                    tabIndex={0}
                  >
                    <Play className="w-4 h-4" />
                    {lang === 'zh' ? '开始生成' : 'Generate'}
                  </button>
                  <span className="text-[10px] text-slate-400 text-center">Ctrl+Enter</span>
                </div>
              </div>
            </div>

            {/* 场景模板网格 */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-bold text-slate-800">
                  {lang === 'zh' ? '热门应用场景' : 'Popular Scenarios'}
                </h2>
                <span className="text-xs text-slate-400">
                  {lang === 'zh' ? '点击即可一键启动 Pipeline 生成' : 'Click to launch pipeline generation'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {SCENARIO_TEMPLATES.map((scenario) => (
                  <div
                    key={scenario.id}
                    className="group rounded-2xl border border-slate-200 bg-white hover:border-violet-300 hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer"
                    onClick={() => setSelectedScenario(selectedScenario?.id === scenario.id ? null : scenario)}
                    role="button"
                    tabIndex={0}
                    aria-label={lang === 'zh' ? scenario.title.zh : scenario.title.en}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setSelectedScenario(selectedScenario?.id === scenario.id ? null : scenario);
                    }}
                  >
                    {/* 渐变头部 */}
                    <div className={`h-2 bg-gradient-to-r ${scenario.color}`} />

                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0">{scenario.icon}</span>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-slate-800 group-hover:text-violet-700 transition-colors">
                            {lang === 'zh' ? scenario.title.zh : scenario.title.en}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            {lang === 'zh' ? scenario.desc.zh : scenario.desc.en}
                          </p>
                        </div>
                      </div>

                      {/* 标签 */}
                      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          scenario.pipelineType === 'fullstack'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-sky-100 text-sky-700'
                        }`}>
                          {scenario.pipelineType === 'fullstack' ? '🔥 全栈' : '⚡ 前端'}
                        </span>
                        {scenario.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-500">{tag}</span>
                        ))}
                      </div>

                      {/* 展开详情 */}
                      {selectedScenario?.id === scenario.id && (
                        <div className="mt-4 pt-3 border-t border-slate-100 space-y-3 animate-fade-in">
                          <div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Prompt 预览</div>
                            <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 leading-relaxed">
                              {scenario.prompt}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r ${scenario.color} hover:opacity-90 transition-opacity shadow-sm`}
                              onClick={(e) => { e.stopPropagation(); handleRunScenario(scenario); }}
                              aria-label="立即运行"
                              tabIndex={0}
                            >
                              <Play className="w-4 h-4" />
                              {lang === 'zh' ? '立即运行' : 'Run Now'}
                            </button>
                            <button
                              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                              onClick={(e) => { e.stopPropagation(); setCustomPrompt(scenario.prompt); setSelectedScenario(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                              aria-label="编辑后运行"
                              tabIndex={0}
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              {lang === 'zh' ? '编辑' : 'Edit'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pipeline 工作原理说明 */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 p-6">
              <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-violet-500" />
                {lang === 'zh' ? 'Pipeline 工作原理' : 'How Pipeline Works'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 前端 Pipeline */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-700">⚡ 前端 Pipeline</span>
                    <span className="text-xs text-slate-400">4 步生成完整 UI</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['📋 需求分析', '🎨 UI 设计', '⚡ 代码生成', '🔧 质检优化'].map((step, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 shadow-sm">{step}</span>
                        {i < 3 && <ArrowRight className="w-3 h-3 text-slate-300" />}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    {lang === 'zh'
                      ? '4 个专业 Agent 依次协作：分析需求 → 设计 UI 规范 → 生成代码 → 质检修复，输出可直接运行的 HTML/React 应用。'
                      : 'Four specialized agents collaborate sequentially to produce a runnable HTML/React application.'}
                  </p>
                </div>

                {/* 全栈 Pipeline */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">🔥 全栈 Pipeline</span>
                    <span className="text-xs text-slate-400">7 步生成前后端 + 数据库</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['📋 需求', '🗄️ 数据库', '🔌 API', '🎨 前端', '🔧 质检', '🚀 部署', '✅ 验证'].map((step, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 shadow-sm">{step}</span>
                        {i < 6 && <ArrowRight className="w-3 h-3 text-slate-300" />}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    {lang === 'zh'
                      ? '7 个 Agent 协作生成完整全栈应用：需求分析 → MongoDB Schema → Koa API → React 前端 → 质检 → 自动部署 → 端到端验证。'
                      : 'Seven agents collaborate to generate a complete full-stack application with database, API, and frontend.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 流水线定义 Tab ─── */}
        {activeTab === 'pipelines' && (
          <div className="max-w-5xl mx-auto px-6 py-6">
            {/* 搜索和筛选栏 */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
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
                    {type === 'all' ? (lang === 'zh' ? '全部' : 'All') : type === 'text' ? '💬 Text' : '👁️ Vision'}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
              </div>
            ) : filteredPipelines.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{lang === 'zh' ? '暂无流水线定义' : 'No pipeline definitions yet'}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPipelines.map((pipeline) => (
                  <div key={pipeline._id} className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-violet-200 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <GitBranch className="w-4 h-4 text-violet-500 flex-shrink-0" />
                          <h3 className="font-bold text-slate-800 text-sm">
                            {lang === 'zh' ? pipeline.name.zh : pipeline.name.en}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-violet-100 text-violet-600 font-medium">
                            {pipeline.steps.length} {lang === 'zh' ? '步骤' : 'steps'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-3 ml-6">
                          {lang === 'zh' ? pipeline.description.zh : pipeline.description.en}
                        </p>

                        {/* 步骤流程图 */}
                        <div className="ml-6">
                          <StepFlow steps={pipeline.steps} lang={lang} />
                        </div>
                      </div>

                      {/* 运行按钮 */}
                      <button
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors shadow-sm flex-shrink-0"
                        onClick={() => navigate('/vibe?mode=pipeline')}
                        aria-label="在 Vibe Coding 中运行"
                        tabIndex={0}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {lang === 'zh' ? '运行' : 'Run'}
                      </button>
                    </div>

                    {/* 系统提示词预览 */}
                    {pipeline.systemPrompt?.zh && (
                      <div className="mt-3 ml-6 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="text-[10px] text-slate-400 mb-1">System Prompt</div>
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {lang === 'zh' ? pipeline.systemPrompt.zh : pipeline.systemPrompt.en}
                        </p>
                      </div>
                    )}
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

export default PipelinesPage;
