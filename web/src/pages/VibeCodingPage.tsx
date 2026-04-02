import { useState, useRef, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Zap, Send, Bot, Cpu, Eye, MessageSquare,
  ChevronDown, Plus, Clock, Store, ImagePlus,
  Wrench, CheckCircle2, XCircle, SkipForward, Loader2,
  Server,
} from 'lucide-react';
import { fetchAgents, createChatSession, analyzeTaskComplexity, executeAgentPlan, executeFullStackPipeline } from '../api';
import type { FullStackPipelineSSEEvent } from '../api';
import { useAppStore } from '../store';
import type { Agent, Provider, ModelType, ChatMessage, TaskComplexity, StepStatus, PlanSSEEvent } from '../types';
import type { SelectedElementInfo } from './vibe-coding/UIPreviewPanel';
import {
  PromptCategoryList,
  MessageBubble,
  UIPreviewPanel,
  HistoryPanel,
  PublishModal,
  extractCodeParts,
  extractReactCodeParts,
  PROMPT_CATEGORIES,
  useVibeHistory,
  useFavoritePrompts,
} from './vibe-coding';
import type { PipelineStep, VibeSession, CodeParts, VibeHistoryItem, ServerParts, DbSchema } from './vibe-coding';

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

  // React 模式：告知 AI 生成 JSX 组件代码
const [isReactMode, setIsReactMode] = useState(true);

  // 全栈模式：生成 Node 后端 + React 前端 + MongoDB
  const [isFullStackMode, setIsFullStackMode] = useState(false);
  const [serverParts, setServerParts] = useState<ServerParts | null>(null);
  const [dbSchema, setDbSchema] = useState<DbSchema | null>(null);
  const [runtimeApiBase, setRuntimeApiBase] = useState<string>('');
  const fullStackAbortRef = useRef<(() => void) | null>(null);

  // Pipeline 模式状态
  const [pipelineMode, setPipelineMode] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [pipelineRunning, setPipelineRunning] = useState(false);

  // Agent 规划模式状态（与 Pipeline 结合）
  const [planComplexity, setPlanComplexity] = useState<TaskComplexity | null>(null);
  const [planGoal, setPlanGoal] = useState<string>('');
  const [agentPlanSteps, setAgentPlanSteps] = useState<Array<{
    id: string;
    index: number;
    title: string;
    status: StepStatus;
    toolResults?: Array<{ toolName: string; success: boolean; summary?: string }>;
    error?: string;
  }>>([]);
  const [isAgentPlanMode, setIsAgentPlanMode] = useState(false);
  const agentPlanAbortRef = useRef<(() => void) | null>(null);

  // 侧边栏视图
  const [sideView, setSideView] = useState<SideView>('chat');

  // 元素选择回调：自动填充输入框并提示用户
  const handleElementSelect = useCallback((info: SelectedElementInfo) => {
    const selectorHint = info.id ? `#${info.id}` : info.selector;
    const textHint = info.textContent
      ? `，内容为「${info.textContent.slice(0, 30)}${info.textContent.length > 30 ? '…' : ''}」`
      : '';
    // [element_modify] 标记让复杂度分析器识别为 simple，避免触发 Pipeline 重新生成
    const prompt = lang === 'zh'
      ? `[element_modify] 请修改选中的「${selectorHint}」元素${textHint}：`
      : `[element_modify] Please modify the selected "${selectorHint}" element${info.textContent ? ` with text "${info.textContent.slice(0, 30)}"` : ''}: `;
    setInput(prompt);
    setSideView('chat');
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [lang]);

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
    setAgentPlanSteps([]);
    setPlanComplexity(null);
    setPlanGoal('');
    setIsAgentPlanMode(false);
    agentPlanAbortRef.current?.();
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

  // ─── Pipeline 多 Agent 流水线（原始 4 步固定流程）────────────────────────────

  const runFixedPipeline = async (trimmed: string) => {
    const initialSteps: PipelineStep[] = [
      { step: 1, total: 4, title: '📋 需求分析', status: 'pending' },
      { step: 2, total: 4, title: '🎨 UI 设计', status: 'pending' },
      { step: 3, total: 4, title: '⚡ 代码生成', status: 'pending' },
      { step: 4, total: 4, title: '🔧 质检优化', status: 'pending' },
    ];
    setPipelineSteps(initialSteps);
    setIsAgentPlanMode(false);

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
              const parts = isReactMode
                ? extractReactCodeParts(parsed.content)
                : extractCodeParts(parsed.content);
              if (parts.jsx || parts.html || parts.css || parts.js || parts.isFullHtml) {
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
    }
  };

  // ─── 全栈 Pipeline（5步流水线：需求分析→数据库→后端→前端→质检）────────

  const runFullStackPipeline = (trimmed: string) => {
    const initialSteps: PipelineStep[] = [
      { step: 1, total: 5, title: '📋 全栈需求分析', status: 'pending' },
      { step: 2, total: 5, title: '🗄️ 数据库架构', status: 'pending' },
      { step: 3, total: 5, title: '⚙️ 后端代码', status: 'pending' },
      { step: 4, total: 5, title: '🎨 前端代码', status: 'pending' },
      { step: 5, total: 5, title: '🔧 质检整合', status: 'pending' },
    ];
    setPipelineSteps(initialSteps);
    setIsAgentPlanMode(false);

    const cleanup = executeFullStackPipeline(
      trimmed,
      { provider, modelType },
      (event: FullStackPipelineSSEEvent) => {
        if (event.type === 'step') {
          setPipelineSteps((prev) =>
            prev.map((s) =>
              s.step === event.step
                ? { ...s, title: event.title || s.title, status: event.status || s.status, content: event.content }
                : s
            )
          );
        } else if (event.type === 'done') {
          console.info('[VibeCoding] done 事件:', {
            hasRuntimeApiBase: !!event.runtimeApiBase,
            runtimeApiBase: event.runtimeApiBase,
            hasCodeParts: !!event.codeParts,
            hasJsx: !!event.codeParts?.jsx,
          });

          // 保存后端代码（不展示给用户，但保存在状态中）
          if (event.serverParts) {
            setServerParts(event.serverParts as ServerParts);
          }
          if (event.dbSchema) {
            setDbSchema(event.dbSchema as DbSchema);
          }

          // ⚠️ 关键：使用 flushSync 确保 runtimeApiBase 和 codeParts 在同一次同步渲染中更新
          // 这样 ReactPreview 首次渲染时就能同时拿到 jsx 和正确的 API 代理路径
          flushSync(() => {
            if (event.runtimeApiBase) {
              setRuntimeApiBase(event.runtimeApiBase);
            }

            // 提取前端代码（只展示前端）
            if (event.codeParts) {
              const parts: CodeParts = {
                html: event.codeParts.html || '',
                css: event.codeParts.css || '',
                js: event.codeParts.js || '',
                jsx: event.codeParts.jsx || '',
                isReact: event.codeParts.isReact ?? true,
                isFullHtml: event.codeParts.isFullHtml ?? false,
              };
              setCodeParts(parts);
              setIsFromPreviousSession(false);
              handleSaveHistory(trimmed, parts);
            }
          });

          const analysisPreview = event.analysis
            ? event.analysis.slice(0, 300) + (event.analysis.length > 300 ? '...' : '')
            : '';

          const deployStatus = event.runtimeApiBase
            ? `\n- ✅ 后端已自动部署到 \`${event.runtimeApiBase}\``
            : '\n- ⚠️ 后端自动部署失败，可稍后在 Admin 后台手动部署';
          const appIdInfo = event.appId
            ? `\n- 📦 应用 ID: \`${event.appId}\``
            : '';

          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant' as const,
              content: `✅ 全栈 Pipeline 完成！已通过 6 个 Agent 协作生成完整全栈应用。\n\n📋 **需求分析摘要**\n${analysisPreview}\n\n🗂️ 生成内容：\n- ✅ MongoDB 数据库 Schema\n- ✅ Koa 后端路由 + Service\n- ✅ React 前端页面\n- ✅ RBAC 权限配置${deployStatus}${appIdInfo}\n\n💡 前端代码已在右侧预览面板中展示，后端代码可在 Admin 后台查看和编辑。`,
              timestamp: new Date().toISOString(),
              provider,
            },
          ]);
          setPipelineRunning(false);
        } else if (event.type === 'error') {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant' as const,
              content: `❌ 全栈 Pipeline 失败：${event.message}`,
              timestamp: new Date().toISOString(),
            },
          ]);
          setPipelineRunning(false);
        }
      },
      (err) => {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant' as const,
            content: `❌ 连接失败：${err.message}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        setPipelineRunning(false);
      }
    );

    fullStackAbortRef.current = cleanup;
  };

  // ─── Agent Plan-Execute 流程（动态步骤 + 工具调用）──────────────────────────

  const runAgentPlan = (trimmed: string) => {
    setIsAgentPlanMode(true);
    setAgentPlanSteps([]);
    setPlanGoal('');

    const cleanup = executeAgentPlan(
      trimmed,
      { provider, modelType, ...(isReactMode ? { isReact: true } : {}) },
      (event: PlanSSEEvent) => {
        switch (event.type) {
          case 'analyze':
            setPlanComplexity(event.complexity);
            break;

          case 'plan_ready':
            setPlanGoal(event.plan.goal);
            setAgentPlanSteps(
              event.plan.steps.map((s) => ({
                id: s.id,
                index: s.index,
                title: s.title,
                status: s.status,
              }))
            );
            break;

          case 'step_update':
            setAgentPlanSteps((prev) => {
              const exists = prev.some((s) => s.id === event.step.id);
              const updated = {
                id: event.step.id,
                index: event.step.index,
                title: event.step.title,
                status: event.step.status,
                toolResults: event.step.toolResults,
                error: event.step.error,
              };
              return exists
                ? prev.map((s) => (s.id === event.step.id ? updated : s))
                : [...prev, updated];
            });
            break;

          case 'done': {
            // 更新最终步骤状态
            setAgentPlanSteps((prev) =>
              prev.map((s) => {
                const finalStep = event.plan.steps.find((ps) => ps.id === s.id);
                return finalStep ? { ...s, status: finalStep.status } : s;
              })
            );
            // 提取代码：优先用 finalResult，兜底遍历所有步骤结果找含 HTML 的
            const CODE_BLOCK_RE = isReactMode
              ? /```(?:jsx|tsx)[\s\S]*?```/i
              : /```html[\s\S]*?```|<!DOCTYPE\s+html[\s\S]*?<\/html>/i;
            const codeSource =
              (event.finalResult && CODE_BLOCK_RE.test(event.finalResult))
                ? event.finalResult
                : event.plan.steps
                    .slice()
                    .reverse()
                    .find((s) => s.result && CODE_BLOCK_RE.test(s.result))?.result ?? event.finalResult;

            if (codeSource) {
              const parts = isReactMode
                ? extractReactCodeParts(codeSource)
                : extractCodeParts(codeSource);
              if (parts.jsx || parts.html || parts.css || parts.js || parts.isFullHtml) {
                setCodeParts(parts);
                setIsFromPreviousSession(false);
                handleSaveHistory(trimmed, parts);
              }
            }
            const complexityLabel = { simple: '简单', moderate: '中等', complex: '复杂' }[planComplexity ?? 'moderate'];
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant' as const,
                content: event.success
                  ? `✅ Agent 规划完成！复杂度：${complexityLabel}，共执行 ${event.plan.steps.length} 个步骤。`
                  : `⚠️ Agent 规划部分完成，部分步骤失败，请查看步骤详情。`,
                timestamp: new Date().toISOString(),
                provider,
              },
            ]);
            setPipelineRunning(false);
            break;
          }

          case 'error':
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant' as const,
                content: `❌ Agent 规划失败：${event.message}`,
                timestamp: new Date().toISOString(),
              },
            ]);
            setPipelineRunning(false);
            break;
        }
      },
      (err) => {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant' as const,
            content: `❌ 连接失败：${err.message}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        setPipelineRunning(false);
      }
    );

    agentPlanAbortRef.current = cleanup;
  };

  // ─── 智能 Pipeline 入口（自动感知复杂度，路由到合适策略）────────────────────

  const handlePipeline = async () => {
    const trimmed = input.trim();
    if (!trimmed || pipelineRunning || streaming) return;

    setInput('');
    setPipelineRunning(true);
    setPipelineSteps([]);
    setAgentPlanSteps([]);
    setPlanComplexity(null);
    setPlanGoal('');

    const userMsg: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      // ── 1. 分析复杂度（极快，无 LLM 调用）──────────────────────────────────
      const analysis = await analyzeTaskComplexity(trimmed);
      setPlanComplexity(analysis.complexity);

      if (analysis.complexity === 'simple') {
        setPipelineRunning(false);
        setIsAgentPlanMode(false);
        if (analysis.intent === 'qa') {
          // 问答类（查询/解释/分析）→ 走 chat/stream 对话模式，不强制生成 HTML
          handleSendWithContent(trimmed, true);
        } else {
          // 操作类（修改样式/元素）→ 走 vibe/stream 生成/修改 HTML
          handleVibeStream(trimmed, undefined, true);
        }
        return;
      }

      if (analysis.complexity === 'moderate') {
        if (isFullStackMode) {
          // 全栈模式 → 走 6 步全栈 Pipeline
          runFullStackPipeline(trimmed);
          // pipelineRunning 由 runFullStackPipeline 内部在 done/error 时关闭
        } else {
          // 普通模式 → 走固定 4 步 Pipeline（快速稳定）
          await runFixedPipeline(trimmed);
          setPipelineRunning(false);
        }
      } else {
        if (isFullStackMode) {
          // 全栈模式 + complex → 仍走 6 步全栈 Pipeline（全栈需求统一走全栈流水线）
          runFullStackPipeline(trimmed);
        } else {
          // complex → 走 Agent Plan-Execute（动态规划 + 工具调用）
          runAgentPlan(trimmed);
        }
        // pipelineRunning 由内部在 done/error 时关闭
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant' as const,
          content: lang === 'zh' ? '❌ 智能分析失败，请检查服务连接' : '❌ Analysis failed',
          timestamp: new Date().toISOString(),
        },
      ]);
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

    // ── 意图分析：根据 intent 和 complexity 决定走哪条路径 ──────────────────
    try {
      const analysis = await analyzeTaskComplexity(trimmed);
      setPlanComplexity(analysis.complexity);

      // [element_modify] 标记：在现有页面基础上做局部修改，传入当前 HTML
      if (trimmed.startsWith('[element_modify]')) {
        const currentHtml = codeParts?.isFullHtml
          ? codeParts.html
          : codeParts
            ? `<!DOCTYPE html><html><head><style>${codeParts.css || ''}</style></head><body>${codeParts.html || ''}<script>${codeParts.js || ''}</script></body></html>`
            : undefined;
        handleVibeStream(trimmed, currentHtml);
        return;
      }

      // 问答类（查询/解释/分析）→ 走 chat/stream 对话模式，不强制生成 HTML
      if (analysis.intent === 'qa') {
        // 继续往下走 chat/stream 逻辑
      } else if (analysis.complexity !== 'simple') {
        // moderate / complex 操作类 → 走 vibe/stream（有强制 HTML 输出的 system prompt）
        handleVibeStream(trimmed);
        return;
      }
      // simple + action（修改样式等）→ 也走 vibe/stream
      else {
        handleVibeStream(trimmed);
        return;
      }
    } catch {
      // 分析失败时降级为普通对话
    }

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
      let toolStatusLines: string[] = [];

      const updateLastMsg = (text: string) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: text };
          return updated;
        });
      };

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

            if (parsed.type === 'tool_calls_start') {
              const names = (parsed.toolCalls as Array<{ name: string }>)
                .map((tc) => `🔧 \`${tc.name}\``)
                .join('、');
              toolStatusLines = [`**正在调用工具：** ${names}`];
              updateLastMsg(toolStatusLines.join('\n'));
            }

            if (parsed.type === 'tool_executing') {
              toolStatusLines.push(`⏳ 执行 \`${parsed.toolName}\`...`);
              updateLastMsg(toolStatusLines.join('\n'));
            }

            if (parsed.type === 'tool_result') {
              const idx = toolStatusLines.reduce((found, l, i) => l.includes(`\`${parsed.toolName}\``) ? i : found, -1);
              const resultLine = parsed.success
                ? `✅ \`${parsed.toolName}\` → ${parsed.summary}`
                : `❌ \`${parsed.toolName}\` 失败：${parsed.summary}`;
              if (idx >= 0) toolStatusLines[idx] = resultLine;
              else toolStatusLines.push(resultLine);
              updateLastMsg(toolStatusLines.join('\n'));
            }

            if (parsed.type === 'generating') {
              toolStatusLines = [];
              fullContent = '';
              updateLastMsg('');
            }

            if (parsed.type === 'delta') {
              if (parsed.delta === '' || parsed.delta === undefined) {
                setContinuationCount((c) => {
                  const next = c + 1;
                  setIsContinuing(next > 0);
                  return next;
                });
              } else {
                fullContent += parsed.delta;
                updateLastMsg(toolStatusLines.length > 0
                  ? toolStatusLines.join('\n') + '\n\n' + fullContent
                  : fullContent
                );
              }
            }
          } catch {
            // 忽略解析错误
          }
        }
      }

      const parts = isReactMode
        ? extractReactCodeParts(fullContent)
        : extractCodeParts(fullContent);
      if (parts.jsx || parts.html || parts.css || parts.js || parts.isFullHtml) {
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

  // ─── Vibe Stream 生成（供 simple 任务 / Pipeline 直接调用）────────────────────
  // currentHtml：传入时走"修改模式"，AI 在现有代码基础上做局部修改；不传时走"全新生成"

  const handleVibeStream = async (content: string, currentHtml?: string, skipUserMsg = false) => {
    if (!content || streaming) return;

    // skipUserMsg=true 时跳过添加用户消息（由 handlePipeline 等上层调用方已添加）
    if (!skipUserMsg) {
      const userMsg: ChatMessage = {
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
    }
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
      const response = await fetch('/api/vibe/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: content,
          agentSlug: selectedAgent || undefined,
          provider,
          modelType,
          ...(currentHtml ? { currentHtml } : {}),
          ...(isReactMode ? { isReact: true } : {}),
        }),
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
            if (parsed.type === 'delta' && parsed.delta) {
              fullContent += parsed.delta;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent };
                return updated;
              });
            }
          } catch { /* 忽略 */ }
        }
      }

      const parts = isReactMode
        ? extractReactCodeParts(fullContent)
        : extractCodeParts(fullContent);
      if (parts.jsx || parts.html || parts.css || parts.js || parts.isFullHtml) {
        setCodeParts(parts);
        setIsFromPreviousSession(false);
        handleSaveHistory(content, parts);
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          timestamp: new Date().toISOString(),
          provider,
        };
        return updated;
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: lang === 'zh' ? '❌ 生成失败，请检查服务连接' : '❌ Generation failed',
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

  // ─── 带内容的普通发送（供 handlePipeline simple 分支调用）──────────────────

  const handleSendWithContent = async (content: string, skipUserMsg = false) => {
    if (!content || streaming) return;

    // skipUserMsg=true 时跳过添加用户消息（由 handlePipeline 等上层调用方已添加）
    if (!skipUserMsg) {
      const userMsg: ChatMessage = {
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
    }
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
      const requestBody: Record<string, unknown> = { sessionId: currentSession.sessionId, message: content };
      if (uploadedImage && modelType === 'vision') requestBody.imageBase64 = uploadedImage;

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
      // 工具调用过程的临时展示内容
      let toolStatusLines: string[] = [];

      const updateLastMsg = (text: string) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: text };
          return updated;
        });
      };

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

            if (parsed.type === 'tool_calls_start') {
              // 开始工具调用，展示工具名列表
              const names = (parsed.toolCalls as Array<{ name: string }>)
                .map((tc) => `🔧 \`${tc.name}\``)
                .join('、');
              toolStatusLines = [`**正在调用工具：** ${names}`];
              updateLastMsg(toolStatusLines.join('\n'));
            }

            if (parsed.type === 'tool_executing') {
              toolStatusLines.push(`⏳ 执行 \`${parsed.toolName}\`...`);
              updateLastMsg(toolStatusLines.join('\n'));
            }

            if (parsed.type === 'tool_result') {
              // 替换最后一条 executing 为结果
              const idx = toolStatusLines.reduce((found, l, i) => l.includes(`\`${parsed.toolName}\``) ? i : found, -1);
              const resultLine = parsed.success
                ? `✅ \`${parsed.toolName}\` → ${parsed.summary}`
                : `❌ \`${parsed.toolName}\` 失败：${parsed.summary}`;
              if (idx >= 0) toolStatusLines[idx] = resultLine;
              else toolStatusLines.push(resultLine);
              updateLastMsg(toolStatusLines.join('\n'));
            }

            if (parsed.type === 'generating') {
              // 工具调用完毕，开始生成最终回答，清空工具状态，准备流式输出
              toolStatusLines = [];
              fullContent = '';
              updateLastMsg('');
            }

            if (parsed.type === 'delta' && parsed.delta) {
              fullContent += parsed.delta;
              updateLastMsg(toolStatusLines.length > 0
                ? toolStatusLines.join('\n') + '\n\n' + fullContent
                : fullContent
              );
            }
          } catch { /* 忽略 */ }
        }
      }

      const parts = isReactMode
        ? extractReactCodeParts(fullContent)
        : extractCodeParts(fullContent);
      if (parts.jsx || parts.html || parts.css || parts.js || parts.isFullHtml) {
        setCodeParts(parts);
        setIsFromPreviousSession(false);
        handleSaveHistory(content, parts);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: lang === 'zh' ? '❌ 生成失败，请检查服务连接' : '❌ Generation failed',
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
    agentPlanAbortRef.current?.();
    fullStackAbortRef.current?.();
    setStreaming(false);
    setPipelineRunning(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (pipelineMode) handlePipeline();
      else handleSend();
    }
  };

  // 复杂度 badge 样式
  const complexityBadge = planComplexity ? {
    simple:   { label: lang === 'zh' ? '简单' : 'Simple',   cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    moderate: { label: lang === 'zh' ? '中等' : 'Moderate', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    complex:  { label: lang === 'zh' ? '复杂' : 'Complex',  cls: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  }[planComplexity] : null;

  // Agent Plan 步骤状态图标
  const StepIcon = ({ status }: { status: StepStatus }) => {
    if (status === 'done')    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    if (status === 'failed')  return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    if (status === 'skipped') return <SkipForward className="w-3.5 h-3.5 text-gray-500" />;
    if (status === 'running') return <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />;
    return <span className="w-3.5 h-3.5 rounded-full border border-gray-600 inline-block" />;
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
                  ? '智能 Pipeline：自动分析复杂度\n简单→直接生成 | 中等→4步Pipeline | 复杂→Agent规划+工具调用\n开启「全栈」后：中等/复杂→6步全栈Pipeline'
                  : 'Smart Pipeline: auto-detect complexity\nSimple→Direct | Moderate→4-step | Complex→Agent Plan+Tools\nWith Full-Stack: Moderate/Complex→6-step Full-Stack Pipeline'}
              >
                <Zap className="w-3 h-3" />
                Pipeline
              </button>

              {/* 全栈模式切换（仅在 Pipeline 模式开启时显示） */}
              {pipelineMode && (
                <button
                  className={`text-[10px] flex items-center gap-1 px-2 py-1.5 rounded-lg flex-shrink-0 transition-all ${
                    isFullStackMode
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/20'
                      : 'bg-gray-800/80 border border-gray-700/40 text-gray-400 hover:text-emerald-400 hover:border-gray-600/60'
                  }`}
                  onClick={() => {
                    setIsFullStackMode((v) => !v);
                    // 全栈模式自动开启 React 模式
                    if (!isFullStackMode) setIsReactMode(true);
                  }}
                  aria-label="切换全栈模式"
                  tabIndex={0}
                  title={lang === 'zh'
                    ? '全栈模式：自动生成 Node 后端 + React 前端 + MongoDB + 权限配置\n开启后 Pipeline 将使用 6 步全栈流水线'
                    : 'Full-Stack mode: auto-generate Node backend + React frontend + MongoDB + RBAC\nEnables 6-step full-stack pipeline'}
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
                        {/* 复杂度 badge */}
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
                          {/* 工具调用结果 */}
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
                          {/* 错误信息 */}
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
                    className={`flex-shrink-0 h-7 px-2.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition-colors ${
                      isFullStackMode
                        ? 'bg-emerald-600 hover:bg-emerald-500'
                        : 'bg-amber-600 hover:bg-amber-500'
                    }`}
                    onClick={handlePipeline}
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
        isReactMode={isReactMode}
        isFullStackMode={isFullStackMode}
        runtimeApiBase={runtimeApiBase}
        onReactModeChange={setIsReactMode}
        onCodePartsChange={setCodeParts}
        onClearPreview={() => {
          setPrevCodeParts(null);
          setIsFromPreviousSession(false);
        }}
        onImageUpload={(base64) => setUploadedImage(base64)}
        onImageClear={() => setUploadedImage(null)}
        onElementSelect={handleElementSelect}
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
          isFullStack={isFullStackMode}
          serverParts={serverParts}
          dbSchema={dbSchema}
          onSuccess={(_, deployInfo) => {
            setPublishTarget(null);
            if (deployInfo?.runtimeApiBase) {
              setRuntimeApiBase(deployInfo.runtimeApiBase);
            }
          }}
          onClose={() => setPublishTarget(null)}
        />
      )}
    </div>
  );
};

export default VibeCodingPage;
