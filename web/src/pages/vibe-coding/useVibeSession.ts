import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../store';
import { fetchAgents, createChatSession, fetchVibeAppRuntimeStatus } from '../../api';
import type { Agent, Provider, ModelType, ChatMessage, TaskComplexity, StepStatus } from '../../types';
import type { PipelineStep, VibeSession, CodeParts, VibeHistoryItem, ServerParts, DbSchema } from './types';
import { useVibeHistory } from './useVibeHistory';
import { useFavoritePrompts } from './useFavoritePrompts';

/** Agent Plan 步骤 */
export interface AgentPlanStep {
  id: string;
  index: number;
  title: string;
  status: StepStatus;
  toolResults?: Array<{ toolName: string; success: boolean; summary?: string }>;
  error?: string;
}

/** 侧边栏视图类型 */
export type SideView = 'chat' | 'history';

/**
 * useVibeSession — 集中管理 VibeCodingPage 的所有状态和会话逻辑
 */
export const useVibeSession = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { lang, activeProvider } = useAppStore();

  // ─── 会话状态 ──────────────────────────────────────────────────────────────
  const [session, setSession] = useState<VibeSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [continuationCount, setContinuationCount] = useState(0);
  const [isContinuing, setIsContinuing] = useState(false);

  // ─── 输入状态 ──────────────────────────────────────────────────────────────
  const [input, setInput] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>(searchParams.get('agent') || '');
  const [provider, setProvider] = useState<Provider>(activeProvider);
  const [modelType, setModelType] = useState<ModelType>('text');
  const [showAgentPicker, setShowAgentPicker] = useState(false);

  // ─── UI 预览状态 ───────────────────────────────────────────────────────────
  const [codeParts, setCodeParts] = useState<CodeParts | null>(null);
  const [prevCodeParts, setPrevCodeParts] = useState<CodeParts | null>(null);
  const [isFromPreviousSession, setIsFromPreviousSession] = useState(false);

  // ─── 图片上传（Vision 参考图）────────────────────────────────────────────
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // ─── React 模式 ────────────────────────────────────────────────────────────
  const [isReactMode, setIsReactMode] = useState(true);

  // ─── 全栈模式（从 URL ?appId= 恢复） ──────────────────────────────────────
  const [isFullStackMode, setIsFullStackMode] = useState(false);
  const [serverParts, setServerParts] = useState<ServerParts | null>(null);
  const [dbSchema, setDbSchema] = useState<DbSchema | null>(null);
  const [runtimeApiBase, setRuntimeApiBase] = useState<string>('');
  const [deployedAppId, setDeployedAppId] = useState<string>('');
  const fullStackAbortRef = useRef<(() => void) | null>(null);

  // ─── Pipeline 模式状态 ─────────────────────────────────────────────────────
  const [pipelineMode, setPipelineMode] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [pipelineRunning, setPipelineRunning] = useState(false);

  // ─── Agent 规划模式状态 ────────────────────────────────────────────────────
  const [planComplexity, setPlanComplexity] = useState<TaskComplexity | null>(null);
  const [planGoal, setPlanGoal] = useState<string>('');
  const [agentPlanSteps, setAgentPlanSteps] = useState<AgentPlanStep[]>([]);
  const [isAgentPlanMode, setIsAgentPlanMode] = useState(false);
  const agentPlanAbortRef = useRef<(() => void) | null>(null);

  // ─── 侧边栏视图 ───────────────────────────────────────────────────────────
  const [sideView, setSideView] = useState<SideView>('chat');

  // ─── 发布弹窗 ──────────────────────────────────────────────────────────────
  const [publishTarget, setPublishTarget] = useState<VibeHistoryItem | null>(null);

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── 历史 & 收藏 ──────────────────────────────────────────────────────────
  const { history, saveHistory, removeHistory, clearHistory } = useVibeHistory();
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavoritePrompts();

  // ─── URL 同步：deployedAppId 变化时更新 URL 查询参数 ─────────────────────
  useEffect(() => {
    const currentAppId = searchParams.get('appId') || '';
    if (deployedAppId && deployedAppId !== currentAppId) {
      // 有新的 appId，写入 URL
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('appId', deployedAppId);
        return next;
      }, { replace: true });
    } else if (!deployedAppId && currentAppId) {
      // appId 被清除，从 URL 移除
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('appId');
        return next;
      }, { replace: true });
    }
  }, [deployedAppId, searchParams, setSearchParams]);

  // ─── 初始化：从 URL ?appId= 读取，查询后端部署状态恢复 runtimeApiBase ──────
  useEffect(() => {
    const urlAppId = searchParams.get('appId');
    if (!urlAppId) return;

    let cancelled = false;

    const restoreRuntime = async () => {
      try {
        const status = await fetchVibeAppRuntimeStatus(urlAppId);
        if (cancelled) return;

        if (status.deployed && status.basePath) {
          // 后端确认已部署，恢复全栈状态
          setRuntimeApiBase(status.basePath);
          setDeployedAppId(urlAppId);
          setIsFullStackMode(true);
          console.log(`🔄 已从服务端恢复全栈应用部署状态: ${status.title} → ${status.basePath}`);
        } else {
          // 后端未部署，清除 URL 参数
          console.warn('⚠️ 后端应用未部署，清除 URL 参数');
          setRuntimeApiBase('');
          setDeployedAppId('');
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('⚠️ 查询部署状态失败:', err);
        // 查询失败时不做任何假设，保持初始空状态
        setRuntimeApiBase('');
        setDeployedAppId('');
      }
    };

    restoreRuntime();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅在组件挂载时执行一次

  // ─── 加载 Agents ──────────────────────────────────────────────────────────
  const loadAgents = useCallback(async () => {
    try {
      const r = await fetchAgents({ limit: 100 });
      setAgents(r.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // ─── 从 URL 读取 prompt / mode 参数（从 Pipeline 场景跳转） ───────────────
  useEffect(() => {
    const urlPrompt = searchParams.get('prompt');
    const urlMode = searchParams.get('mode');

    if (urlPrompt) {
      setInput(urlPrompt);
      // 清除 URL 参数，避免刷新时重复填充
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('prompt');
        next.delete('mode');
        return next;
      }, { replace: true });

      // 根据 mode 设置全栈模式
      if (urlMode === 'fullstack') {
        setIsFullStackMode(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅在组件挂载时执行一次

  // ─── 创建或复用会话 ───────────────────────────────────────────────────────
  const ensureSession = useCallback(async (): Promise<VibeSession> => {
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
  }, [session, selectedAgent, provider, modelType]);

  // ─── 新建会话 ─────────────────────────────────────────────────────────────
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
    // 清理全栈部署状态（URL 参数会通过 useEffect 自动清除）
    setRuntimeApiBase('');
    setDeployedAppId('');
    setIsFullStackMode(false);
  }, [streaming, codeParts]);

  // ─── 保存历史 ─────────────────────────────────────────────────────────────
  const handleSaveHistory = useCallback(async (label: string, parts: CodeParts) => {
    await saveHistory(label, parts);
  }, [saveHistory]);

  // ─── 恢复历史版本 ─────────────────────────────────────────────────────────
  const handleRestoreHistory = useCallback((item: VibeHistoryItem) => {
    setCodeParts(item.codeParts);
    setIsFromPreviousSession(false);
    setSideView('chat');
  }, []);

  // ─── 停止所有流 ───────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    agentPlanAbortRef.current?.();
    fullStackAbortRef.current?.();
    setStreaming(false);
    setPipelineRunning(false);
  }, []);

  const selectedAgentObj = agents.find((a) => a.slug === selectedAgent);
  const hasMessages = messages.filter((m) => m.role !== 'system').length > 0;

  return {
    // 状态
    lang,
    session, setSession,
    messages, setMessages,
    streaming, setStreaming,
    continuationCount, setContinuationCount,
    isContinuing, setIsContinuing,
    input, setInput,
    agents, setAgents,
    selectedAgent, setSelectedAgent,
    provider, setProvider,
    modelType, setModelType,
    showAgentPicker, setShowAgentPicker,
    codeParts, setCodeParts,
    prevCodeParts, setPrevCodeParts,
    isFromPreviousSession, setIsFromPreviousSession,
    uploadedImage, setUploadedImage,
    isReactMode, setIsReactMode,
    isFullStackMode, setIsFullStackMode,
    serverParts, setServerParts,
    dbSchema, setDbSchema,
    runtimeApiBase, setRuntimeApiBase,
    deployedAppId, setDeployedAppId,
    fullStackAbortRef,
    pipelineMode, setPipelineMode,
    pipelineSteps, setPipelineSteps,
    pipelineRunning, setPipelineRunning,
    planComplexity, setPlanComplexity,
    planGoal, setPlanGoal,
    agentPlanSteps, setAgentPlanSteps,
    isAgentPlanMode, setIsAgentPlanMode,
    agentPlanAbortRef,
    sideView, setSideView,
    publishTarget, setPublishTarget,

    // Refs
    messagesEndRef,
    abortRef,
    textareaRef,

    // 历史 & 收藏
    history, saveHistory, removeHistory, clearHistory,
    favorites, addFavorite, removeFavorite, isFavorite,

    // 计算属性
    selectedAgentObj,
    hasMessages,

    // 方法
    loadAgents,
    ensureSession,
    handleNewSession,
    handleSaveHistory,
    handleRestoreHistory,
    handleStop,
  };
};

export type VibeSessionContext = ReturnType<typeof useVibeSession>;
