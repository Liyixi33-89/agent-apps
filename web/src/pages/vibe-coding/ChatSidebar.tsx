import {
  Zap, Send, Bot, Cpu, Eye, MessageSquare,
  ChevronDown, Plus, Clock, Store, ImagePlus,
  Wrench, CheckCircle2, XCircle, SkipForward, Loader2,
  Server,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { StepStatus } from '../../types';
import {
  PromptCategoryList,
  MessageBubble,
  HistoryPanel,
  PROMPT_CATEGORIES,
} from './index';
import type { VibeSessionContext } from './useVibeSession';

interface ChatSidebarProps {
  ctx: VibeSessionContext;
  onSend: () => void;
  onPipeline: () => void;
}

/** Agent Plan 步骤状态图标 */
const StepIcon = ({ status }: { status: StepStatus }) => {
  if (status === 'done')    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  if (status === 'failed')  return <XCircle className="w-3.5 h-3.5 text-red-400" />;
  if (status === 'skipped') return <SkipForward className="w-3.5 h-3.5 text-gray-500" />;
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />;
  return <span className="w-3.5 h-3.5 rounded-full border border-gray-600 inline-block" />;
};

/**
 * ChatSidebar — 左侧对话侧边栏
 * 包含：顶部操作栏、配置栏、消息列表、Pipeline 进度卡片、输入区
 */
const ChatSidebar = ({ ctx, onSend, onPipeline }: ChatSidebarProps) => {
  const navigate = useNavigate();
  const {
    lang,
    messages,
    streaming,
    isContinuing,
    input, setInput,
    agents,
    selectedAgent, setSelectedAgent,
    provider, setProvider,
    modelType, setModelType,
    showAgentPicker, setShowAgentPicker,
    isReactMode, setIsReactMode,
    isFullStackMode, setIsFullStackMode,
    uploadedImage,
    pipelineMode, setPipelineMode,
    pipelineSteps,
    pipelineRunning,
    planComplexity,
    planGoal,
    agentPlanSteps,
    isAgentPlanMode,
    sideView, setSideView,
    publishTarget, setPublishTarget,
    messagesEndRef,
    textareaRef,
    history,
    removeHistory,
    clearHistory,
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    selectedAgentObj,
    hasMessages,
    handleNewSession,
    handleRestoreHistory,
    handleStop,
  } = ctx;

  // 复杂度 badge 样式
  const complexityBadge = planComplexity ? {
    simple:   { label: lang === 'zh' ? '简单' : 'Simple',   cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    moderate: { label: lang === 'zh' ? '中等' : 'Moderate', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    complex:  { label: lang === 'zh' ? '复杂' : 'Complex',  cls: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  }[planComplexity] : null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (pipelineMode) onPipeline();
      else onSend();
    }
  };

  return (
    <div className="flex flex-col w-[360px] flex-shrink-0 border-r border-gray-800/80 bg-gray-950">

      {/* 侧边栏顶部 */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-800/80 flex-shrink-0 bg-gray-950">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-500/25 to-violet-600/25 flex items-center justify-center border border-yellow-500/20 shadow-inner">
            <Zap className="w-4 h-4 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none tracking-tight">Vibe Coding</h1>
            <p className="text-[10px] text-gray-500 mt-0.5">{lang === 'zh' ? 'AI UI 生成器' : 'AI UI Generator'}</p>
          </div>
        </div>

        {/* 顶部操作按钮 */}
        <div className="flex items-center gap-0.5">
          <button
            className={`p-1.5 rounded-lg transition-colors relative ${
              sideView === 'history'
                ? 'text-violet-400 bg-violet-500/15'
                : 'text-gray-500 hover:text-white hover:bg-gray-800'
            }`}
            onClick={() => setSideView((v) => v === 'history' ? 'chat' : 'history')}
            tabIndex={0}
            aria-label={lang === 'zh' ? '历史记录' : 'History'}
            title={lang === 'zh' ? '历史记录' : 'History'}
          >
            <Clock className="w-4 h-4" />
            {history.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-violet-500 text-white text-[8px] rounded-full flex items-center justify-center font-bold">
                {history.length > 9 ? '9+' : history.length}
              </span>
            )}
          </button>

          <button
            className="p-1.5 rounded-lg transition-colors text-gray-500 hover:text-white hover:bg-gray-800"
            onClick={() => navigate('/market')}
            tabIndex={0}
            aria-label={lang === 'zh' ? '模板市场' : 'Template Market'}
            title={lang === 'zh' ? '模板市场' : 'Template Market'}
          >
            <Store className="w-4 h-4" />
          </button>

          {hasMessages && (
            <button
              className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              onClick={handleNewSession}
              aria-label="新建会话"
              tabIndex={0}
              title={lang === 'zh' ? '新建会话' : 'New Session'}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── 历史面板 ── */}
      {sideView === 'history' && (
        <div className="flex-1 overflow-hidden">
          <HistoryPanel
            history={history}
            lang={lang}
            onRestore={handleRestoreHistory}
            onRemove={removeHistory}
            onClear={clearHistory}
            onPublish={(item) => setPublishTarget(item)}
            onClose={() => setSideView('chat')}
          />
        </div>
      )}

      {/* ── 对话视图 ── */}
      {sideView === 'chat' && (
        <>
          {/* 配置栏 */}
          <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-gray-800/80 flex-shrink-0 bg-gray-950/50">
            {/* Agent 选择 */}
            <div className="relative flex-1 min-w-0">
              <button
                className="w-full text-xs flex items-center gap-1.5 justify-between bg-gray-800/80 hover:bg-gray-800 rounded-lg px-2.5 py-1.5 border border-gray-700/40 hover:border-gray-600/60 transition-all"
                onClick={() => setShowAgentPicker(!showAgentPicker)}
                aria-label="选择 Agent"
                tabIndex={0}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Bot className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                  <span className="truncate text-gray-300">
                    {selectedAgentObj
                      ? (lang === 'zh' ? selectedAgentObj.name.zh : selectedAgentObj.name.en)
                      : (lang === 'zh' ? '默认 Agent' : 'Default')}
                  </span>
                </div>
                <ChevronDown className="w-3 h-3 flex-shrink-0 text-gray-500" />
              </button>
              {showAgentPicker && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-gray-800 border border-gray-700/80 rounded-xl shadow-2xl z-20 max-h-52 overflow-y-auto">
                  <button
                    className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-700/60 hover:text-white rounded-t-xl transition-colors"
                    onClick={() => { setSelectedAgent(''); setShowAgentPicker(false); }}
                  >
                    {lang === 'zh' ? '不使用 Agent' : 'No Agent'}
                  </button>
                  {agents.map((a) => (
                    <button
                      key={a.slug}
                      className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700/60 hover:text-white flex items-center gap-2 transition-colors"
                      onClick={() => { setSelectedAgent(a.slug); setShowAgentPicker(false); }}
                    >
                      <span>{a.emoji}</span>
                      <span className="truncate">{lang === 'zh' ? a.name.zh : a.name.en}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Provider */}
            <button
              className={`text-[10px] flex items-center gap-1 px-2 py-1.5 rounded-lg bg-gray-800/80 border border-gray-700/40 flex-shrink-0 transition-all hover:border-gray-600/60 ${
                provider === 'ollama' ? 'text-emerald-400' : 'text-sky-400'
              }`}
            onClick={() => setProvider(provider === 'ollama' ? 'openai' : 'ollama')}
              aria-label="切换提供商"
              tabIndex={0}
            >
              <Cpu className="w-3 h-3" />
              {provider === 'ollama' ? 'Ollama' : 'OpenAI'}
            </button>

            {/* 模型类型 */}
            <button
              className={`text-[10px] flex items-center gap-1 px-2 py-1.5 rounded-lg bg-gray-800/80 border border-gray-700/40 flex-shrink-0 transition-all hover:border-gray-600/60 ${
                modelType === 'vision' ? 'text-violet-400' : 'text-gray-400'
              }`}
              onClick={() => setModelType(modelType === 'text' ? 'vision' : 'text')}
              aria-label="切换模型类型"
              tabIndex={0}
            >
              {modelType === 'vision' ? <Eye className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
              {modelType === 'vision' ? 'Vision' : 'Text'}
            </button>

            {/* 智能 Pipeline 模式切换 */}
            <button
              className={`text-[10px] flex items-center gap-1 px-2 py-1.5 rounded-lg flex-shrink-0 transition-all ${
                pipelineMode
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40 hover:bg-amber-500/20'
                  : 'bg-gray-800/80 border border-gray-700/40 text-gray-400 hover:text-amber-400 hover:border-gray-600/60'
              }`}
              onClick={() => setPipelineMode((v) => !v)}
              aria-label="切换智能 Pipeline 模式"
              tabIndex={0}
              title={lang === 'zh'
                ? '智能 Pipeline：自动分析复杂度\n简单→直接生成 | 中等→4步Pipeline | 复杂→Agent规划+工具调用\n开启「全栈」后：中等/复杂→5步全栈Pipeline'
                : 'Smart Pipeline: auto-detect complexity\nSimple→Direct | Moderate→4-step | Complex→Agent Plan+Tools\nWith Full-Stack: Moderate/Complex→5-step Full-Stack Pipeline'}
            >
              <Zap className="w-3 h-3" />
              Pipeline
            </button>

            {/* 全栈模式切换 */}
            {pipelineMode && (
              <button
                className={`text-[10px] flex items-center gap-1 px-2 py-1.5 rounded-lg flex-shrink-0 transition-all ${
                  isFullStackMode
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/20'
                    : 'bg-gray-800/80 border border-gray-700/40 text-gray-400 hover:text-emerald-400 hover:border-gray-600/60'
                }`}
                onClick={() => {
                  setIsFullStackMode((v) => !v);
                  if (!isFullStackMode) setIsReactMode(true);
                }}
                aria-label="切换全栈模式"
                tabIndex={0}
                title={lang === 'zh'
                  ? '全栈模式：自动生成 Node 后端 + React 前端 + MongoDB\n开启后 Pipeline 将使用 5 步全栈流水线'
                  : 'Full-Stack mode: auto-generate Node backend + React frontend + MongoDB\nEnables 5-step full-stack pipeline'}
              >
                <Server className="w-3 h-3" />
                {lang === 'zh' ? '全栈' : 'Full-Stack'}
              </button>
            )}
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
            {!hasMessages ? (
              <PromptCategoryList
                categories={PROMPT_CATEGORIES}
                lang={lang}
                favorites={favorites}
                onSelect={(prompt) => setInput(prompt)}
                onAddFavorite={addFavorite}
                onRemoveFavorite={removeFavorite}
                isFavorite={isFavorite}
              />
            ) : (
              <>
                {messages.map((msg, idx) => (
                  <MessageBubble
                    key={idx}
                    msg={msg}
                    lang={lang}
                    isStreaming={streaming && idx === messages.length - 1 && msg.role === 'assistant'}
                    isContinuing={isContinuing && idx === messages.length - 1 && msg.role === 'assistant'}
                  />
                ))}

                {/* ── 智能 Pipeline / Agent 规划进度卡片 ── */}
                {(pipelineSteps.length > 0 || agentPlanSteps.length > 0) && (
                  <div className={`bg-gray-900/80 border rounded-xl p-3.5 space-y-2.5 ${
                    isAgentPlanMode ? 'border-violet-500/25' : 'border-amber-500/20'
                  }`}>
                    {/* 卡片头部 */}
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-800/60">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
                        isAgentPlanMode ? 'bg-violet-500/15' : 'bg-amber-500/15'
                      }`}>
                        <Zap className={`w-3 h-3 ${isAgentPlanMode ? 'text-violet-400' : 'text-amber-400'}`} />
                      </div>
                      <span className={`text-xs font-semibold ${
                        isAgentPlanMode ? 'text-violet-400' : 'text-amber-400'
                      }`}>
                        {isAgentPlanMode ? 'Agent Plan-Execute' : 'Multi-Agent Pipeline'}
                      </span>
                      {complexityBadge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${complexityBadge.cls}`}>
                          {complexityBadge.label}
                        </span>
                      )}
                      {pipelineRunning && (
                        <span className="ml-auto text-[10px] text-gray-500 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                          {lang === 'zh' ? '执行中' : 'Running'}
                        </span>
                      )}
                    </div>

                    {/* 目标描述（Agent Plan 模式） */}
                    {isAgentPlanMode && planGoal && (
                      <p className="text-[11px] text-gray-500 leading-relaxed px-0.5">{planGoal}</p>
                    )}

                    {/* Pipeline 固定步骤 */}
                    {!isAgentPlanMode && pipelineSteps.map((step) => (
                      <div key={step.step} className="flex items-center gap-2.5">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold transition-all ${
                          step.status === 'done'    ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30' :
                          step.status === 'running' ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40' :
                          step.status === 'error'   ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30' :
                          'bg-gray-800 text-gray-600'
                        }`}>
                          {step.status === 'done'    ? '✓' :
                           step.status === 'running' ? <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" /> :
                           step.status === 'error'   ? '×' :
                           step.step}
                        </div>
                        <span className={`text-xs flex-1 transition-colors ${
                          step.status === 'done'    ? 'text-gray-400 line-through decoration-gray-600' :
                          step.status === 'running' ? 'text-amber-300 font-medium' :
                          step.status === 'error'   ? 'text-red-400' :
                          'text-gray-600'
                        }`}>
                          {step.title}
                        </span>
                      </div>
                    ))}

                    {/* Agent Plan 动态步骤 */}
                    {isAgentPlanMode && agentPlanSteps.map((step) => (
                      <div key={step.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                            <StepIcon status={step.status} />
                          </span>
                          <span className={`text-xs flex-1 transition-colors ${
                            step.status === 'done'    ? 'text-gray-400' :
                            step.status === 'running' ? 'text-violet-300 font-medium' :
                            step.status === 'failed'  ? 'text-red-400' :
                            step.status === 'skipped' ? 'text-gray-600 line-through' :
                            'text-gray-600'
                          }`}>
                            <span className="text-gray-600 mr-1">{step.index}.</span>
                            {step.title}
                          </span>
                        </div>
                        {step.toolResults && step.toolResults.length > 0 && (
                          <div className="ml-6 space-y-0.5">
                            {step.toolResults.map((tr, ti) => (
                              <div key={ti} className="flex items-center gap-1.5 text-[10px]">
                                <Wrench className="w-2.5 h-2.5 text-gray-600 flex-shrink-0" />
                                <span className={tr.success ? 'text-gray-500' : 'text-red-500/70'}>
                                  {tr.toolName}
                                </span>
                                {tr.summary && (
                                  <span className="text-gray-600 truncate max-w-[160px]">{tr.summary}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {step.error && (
                          <p className="ml-6 text-[10px] text-red-400/70">{step.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* 输入区 */}
          <div className="px-3 py-3 border-t border-gray-800/80 flex-shrink-0 bg-gray-950/50">
            {modelType === 'vision' && !uploadedImage && (
              <div className="flex items-center gap-1.5 mb-2 text-[10px] text-violet-400/60">
                <ImagePlus className="w-3 h-3" />
                {lang === 'zh' ? 'Vision 模式：可在右侧上传参考图' : 'Vision mode: upload reference image on the right'}
              </div>
            )}
            <div className="flex gap-2 items-end bg-gray-900 rounded-xl border border-gray-700/50 focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/20 px-3 py-2.5 transition-all">
              <textarea
                ref={textareaRef}
                className="flex-1 bg-transparent text-gray-100 text-sm resize-none outline-none placeholder-gray-600 min-h-[22px] max-h-32"
                placeholder={
                  hasMessages
                    ? (lang === 'zh' ? '继续修改...' : 'Continue editing...')
                    : (lang === 'zh' ? '描述你想要的界面...' : 'Describe your UI...')
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label="输入 UI 描述"
                rows={1}
              />
              {streaming || pipelineRunning ? (
                <button
                  className="flex-shrink-0 w-7 h-7 rounded-lg bg-red-600/90 hover:bg-red-500 flex items-center justify-center transition-colors"
                  onClick={handleStop}
                  aria-label="停止生成"
                  tabIndex={0}
                >
                  <span className="w-2.5 h-2.5 bg-white rounded-sm" />
                </button>
              ) : pipelineMode ? (
                <button
                  className={`flex-shrink-0 h-7 px-2.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition-colors ${
                    isFullStackMode
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-amber-600 hover:bg-amber-500'
                  }`}
                  onClick={onPipeline}
                  disabled={!input.trim()}
                  aria-label={isFullStackMode ? '全栈 Pipeline 生成' : 'Pipeline 生成'}
                  tabIndex={0}
                >
                  {isFullStackMode ? <Server className="w-3 h-3 text-white" /> : <Zap className="w-3 h-3 text-white" />}
                  <span className="text-[10px] text-white font-medium">{isFullStackMode ? 'Full-Stack' : 'Run'}</span>
                </button>
              ) : (
                <button
                  className="flex-shrink-0 w-7 h-7 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  onClick={onSend}
                  disabled={!input.trim()}
                  aria-label="生成 UI"
                  tabIndex={0}
                >
                  <Send className="w-3.5 h-3.5 text-white" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5 text-center">
              Enter {lang === 'zh' ? '发送' : 'to send'} · Shift+Enter {lang === 'zh' ? '换行' : 'newline'}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatSidebar;
