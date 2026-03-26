import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Zap, Send, Bot, Cpu, Eye, MessageSquare,
  ChevronDown, Plus, Clock, Store, ImagePlus,
} from 'lucide-react';
import { fetchAgents, createChatSession } from '../api';
import { useAppStore } from '../store';
import type { Agent, Provider, ModelType, ChatMessage } from '../types';
import {
  PromptCategoryList,
  MessageBubble,
  UIPreviewPanel,
  HistoryPanel,
  PublishModal,
  extractCodeParts,
  PROMPT_CATEGORIES,
  useVibeHistory,
  useFavoritePrompts,
} from './vibe-coding';
import type { PipelineStep, VibeSession, CodeParts, VibeHistoryItem } from './vibe-coding';

// ─── 侧边栏视图类型 ───────────────────────────────────────────────────────────

type SideView = 'chat' | 'history';

// ─── 主页面 ────────────────────────────────────────────────────────────────────

const VibeCodingPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, activeProvider } = useAppStore();

  // 会话状态
  const [session, setSession] = useState<VibeSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [continuationCount, setContinuationCount] = useState(0);
  const [isContinuing, setIsContinuing] = useState(false);

  // 输入状态
  const [input, setInput] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>(searchParams.get('agent') || '');
  const [provider, setProvider] = useState<Provider>(activeProvider);
  const [modelType, setModelType] = useState<ModelType>('text');
  const [showAgentPicker, setShowAgentPicker] = useState(false);

  // UI 预览状态
  const [codeParts, setCodeParts] = useState<CodeParts | null>(null);
  const [prevCodeParts, setPrevCodeParts] = useState<CodeParts | null>(null);
  const [isFromPreviousSession, setIsFromPreviousSession] = useState(false);

  // 图片上传（Vision 参考图）
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Pipeline 模式状态
  const [pipelineMode, setPipelineMode] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [pipelineRunning, setPipelineRunning] = useState(false);

  // 侧边栏视图
  const [sideView, setSideView] = useState<SideView>('chat');

  // 接收模板市场传来的模板数据
  useEffect(() => {
    const state = location.state as { templateCodeParts?: CodeParts; templateTitle?: string } | null;
    if (state?.templateCodeParts) {
      setCodeParts(state.templateCodeParts);
      setIsFromPreviousSession(false);
      if (state.templateTitle) setInput(state.templateTitle);
      navigate('/vibe', { replace: true, state: null });
    }
  }, [location.state, navigate]);

  // 发布弹窗
  const [publishTarget, setPublishTarget] = useState<VibeHistoryItem | null>(null);

  // 历史 & 收藏 Hook
  const { history, saveHistory, removeHistory, clearHistory } = useVibeHistory();
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavoritePrompts();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchAgents({ limit: 100 }).then((r) => setAgents(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const selectedAgentObj = agents.find((a) => a.slug === selectedAgent);

  // ─── 新建会话 ────────────────────────────────────────────────────────────────

  const handleNewSession = useCallback(async () => {
    if (streaming) {
      abortRef.current?.abort();
      setStreaming(false);
    }
    setMessages([]);
    setSession(null);
    if (codeParts) {
      setPrevCodeParts(codeParts);
      setIsFromPreviousSession(true);
    }
    setInput('');
    setContinuationCount(0);
    setIsContinuing(false);
    setPipelineSteps([]);
    setPipelineRunning(false);
    setSideView('chat');
  }, [streaming, codeParts]);

  // ─── 保存历史（生成完成后调用）──────────────────────────────────────────────

  const handleSaveHistory = useCallback(async (label: string, parts: CodeParts) => {
    await saveHistory(label, parts);
  }, [saveHistory]);

  // ─── 恢复历史版本 ────────────────────────────────────────────────────────────

  const handleRestoreHistory = useCallback((item: VibeHistoryItem) => {
    setCodeParts(item.codeParts);
    setIsFromPreviousSession(false);
    setSideView('chat');
  }, []);

  // ─── Pipeline 多 Agent 流水线 ────────────────────────────────────────────────

  const handlePipeline = async () => {
    const trimmed = input.trim();
    if (!trimmed || pipelineRunning || streaming) return;

    setInput('');
    setPipelineRunning(true);
    setPipelineSteps([]);

    const initialSteps: PipelineStep[] = [
      { step: 1, total: 4, title: '📋 需求分析', status: 'pending' },
      { step: 2, total: 4, title: '🎨 UI 设计', status: 'pending' },
      { step: 3, total: 4, title: '⚡ 代码生成', status: 'pending' },
      { step: 4, total: 4, title: '🔧 质检优化', status: 'pending' },
    ];
    setPipelineSteps(initialSteps);

    const userMsg: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    abortRef.current = new AbortController();

    try {
      const response = await fetch('/api/vibe/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed, provider, modelType }),
        signal: abortRef.current.signal,
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'step') {
              setPipelineSteps((prev) =>
                prev.map((s) =>
                  s.step === parsed.step
                    ? { ...s, title: parsed.title, status: parsed.status, content: parsed.content }
                    : s
                )
              );
            } else if (parsed.type === 'done' && parsed.content) {
              const parts = extractCodeParts(parsed.content);
              if (parts.html || parts.css || parts.js || parts.isFullHtml) {
                setCodeParts(parts);
                setIsFromPreviousSession(false);
                handleSaveHistory(trimmed, parts);
              }
              const analysisPreview = parsed.analysis
                ? parsed.analysis.slice(0, 200) + (parsed.analysis.length > 200 ? '...' : '')
                : '';
              const designPreview = parsed.design
                ? '\n\n🎨 **设计规范**\n' + parsed.design.slice(0, 200) + (parsed.design.length > 200 ? '...' : '')
                : '';
              setMessages((prev) => [
                ...prev,
                {
                  role: 'assistant' as const,
              content: `✅ Pipeline 完成！已通过 4 个 Agent 协作生成完整应用。\n\n${analysisPreview}${designPreview}`,
                  timestamp: new Date().toISOString(),
                  provider,
                },
              ]);
            } else if (parsed.type === 'error') {
              setMessages((prev) => [
                ...prev,
                {
                  role: 'assistant' as const,
                  content: `❌ Pipeline 失败：${parsed.message}`,
                  timestamp: new Date().toISOString(),
                },
              ]);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant' as const,
            content: lang === 'zh' ? '❌ Pipeline 执行失败，请检查服务连接' : '❌ Pipeline failed',
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setPipelineRunning(false);
    }
  };

  // ─── 创建或复用会话 ──────────────────────────────────────────────────────────

  const ensureSession = async (): Promise<VibeSession> => {
    if (session) return session;
    const newSession = await createChatSession({
      agentSlug: selectedAgent || undefined,
      provider,
      modelType,
      sessionType: 'vibe',
    } as any);
    const vibeSession: VibeSession = {
      sessionId: newSession.sessionId,
      agentName: newSession.agentName,
      provider: newSession.provider,
      modelType: newSession.modelType,
    };
    setSession(vibeSession);
    return vibeSession;
  };

  // ─── 发送消息（流式）────────────────────────────────────────────────────────

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    setInput('');

    const userMsg: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);

    const aiMsg: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, aiMsg]);

    abortRef.current = new AbortController();
    setContinuationCount(0);
    setIsContinuing(false);

    try {
      const currentSession = await ensureSession();

      // 构建请求体（支持图片）
      const requestBody: Record<string, unknown> = {
        sessionId: currentSession.sessionId,
        message: trimmed,
      };
      if (uploadedImage && modelType === 'vision') {
        requestBody.imageBase64 = uploadedImage;
      }

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortRef.current.signal,
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'delta') {
              if (parsed.delta === '' || parsed.delta === undefined) {
                setContinuationCount((c) => {
                  const next = c + 1;
                  setIsContinuing(next > 0);
                  return next;
                });
              } else {
                fullContent += parsed.delta;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: fullContent,
                  };
                  return updated;
                });
              }
            }
          } catch {
            // 忽略解析错误
          }
        }
      }

      const parts = extractCodeParts(fullContent);
      if (parts.html || parts.css || parts.js || parts.isFullHtml) {
        setCodeParts(parts);
        setIsFromPreviousSession(false);
        // 自动保存到历史
        handleSaveHistory(trimmed, parts);
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          timestamp: new Date().toISOString(),
          provider: currentSession.provider,
        };
        return updated;
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: lang === 'zh' ? '❌ 生成失败，请检查服务连接' : '❌ Generation failed, please check service connection',
            timestamp: new Date().toISOString(),
          };
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      setIsContinuing(false);
      setContinuationCount(0);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      pipelineMode ? handlePipeline() : handleSend();
    }
  };

  const hasMessages = messages.filter((m) => m.role !== 'system').length > 0;

  // ─── 渲染 ─────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ── 左侧：对话侧边栏 ──────────────────────────────────────────────── */}
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
            {/* 历史记录 */}
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

            {/* 模板市场 — 跳转路由 */}
            <button
              className="p-1.5 rounded-lg transition-colors text-gray-500 hover:text-white hover:bg-gray-800"
              onClick={() => navigate('/market')}
              tabIndex={0}
              aria-label={lang === 'zh' ? '模板市场' : 'Template Market'}
              title={lang === 'zh' ? '模板市场' : 'Template Market'}
            >
              <Store className="w-4 h-4" />
            </button>

            {/* 新建会话 */}
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

        {/* ── 历史面板 ──────────────────────────────────────────────────────── */}
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

        {/* ── 对话视图 ──────────────────────────────────────────────────────── */}
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
                onClick={() => setProvider(provider === 'ollama' ? 'codebuddy' : 'ollama')}
                aria-label="切换提供商"
                tabIndex={0}
              >
                <Cpu className="w-3 h-3" />
                {provider === 'ollama' ? 'Ollama' : 'CB'}
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

              {/* Pipeline 模式切换 */}
              <button
                className={`text-[10px] flex items-center gap-1 px-2 py-1.5 rounded-lg flex-shrink-0 transition-all ${
                  pipelineMode
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40 hover:bg-amber-500/20'
                    : 'bg-gray-800/80 border border-gray-700/40 text-gray-400 hover:text-amber-400 hover:border-gray-600/60'
                }`}
                onClick={() => setPipelineMode((v) => !v)}
                aria-label="切换 Pipeline 模式"
                tabIndex={0}
                title={lang === 'zh' ? 'Pipeline 模式：多 Agent 协作生成完整应用' : 'Pipeline: Multi-Agent collaboration'}
              >
                <Zap className="w-3 h-3" />
                Pipeline
              </button>
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

                  {/* Pipeline 进度卡片 */}
                  {pipelineSteps.length > 0 && (
                    <div className="bg-gray-900/80 border border-amber-500/20 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-800/60">
                        <div className="w-5 h-5 rounded-md bg-amber-500/15 flex items-center justify-center">
                          <Zap className="w-3 h-3 text-amber-400" />
                        </div>
                        <span className="text-xs font-semibold text-amber-400">Multi-Agent Pipeline</span>
                        {pipelineRunning && (
                          <span className="ml-auto text-[10px] text-amber-400/60 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            {lang === 'zh' ? '执行中' : 'Running'}
                          </span>
                        )}
                      </div>
                      {pipelineSteps.map((step) => (
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
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* 输入区 */}
            <div className="px-3 py-3 border-t border-gray-800/80 flex-shrink-0 bg-gray-950/50">
              {/* Vision 模式图片上传提示 */}
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
                    className="flex-shrink-0 h-7 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                    onClick={handlePipeline}
                    disabled={!input.trim()}
                    aria-label="Pipeline 生成"
                    tabIndex={0}
                  >
                    <Zap className="w-3 h-3 text-white" />
                    <span className="text-[10px] text-white font-medium">Run</span>
                  </button>
                ) : (
                  <button
                    className="flex-shrink-0 w-7 h-7 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    onClick={handleSend}
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

      {/* ── 右侧：UI 预览主区域 ───────────────────────────────────────────── */}
      <UIPreviewPanel
        codeParts={codeParts}
        prevCodeParts={prevCodeParts}
        lang={lang}
        isStreaming={streaming}
        isFromPreviousSession={isFromPreviousSession}
        uploadedImage={uploadedImage}
        onCodePartsChange={setCodeParts}
        onClearPreview={() => {
          setPrevCodeParts(null);
          setIsFromPreviousSession(false);
        }}
        onImageUpload={(base64) => setUploadedImage(base64)}
        onImageClear={() => setUploadedImage(null)}
        onPublish={() => {
          if (!codeParts) return;
          setPublishTarget({
            id: `direct-${Date.now()}`,
            label: '当前作品',
            codeParts,
            createdAt: new Date().toISOString(),
          });
        }}
      />

      {/* ── 发布弹窗 ──────────────────────────────────────────────────────── */}
      {publishTarget && (
        <PublishModal
          item={publishTarget}
          lang={lang}
          onSuccess={() => {
            setPublishTarget(null);
            navigate('/market');
          }}
          onClose={() => setPublishTarget(null)}
        />
      )}
    </div>
  );
};

export default VibeCodingPage;
