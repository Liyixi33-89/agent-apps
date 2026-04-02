import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../store';
import { fetchAgents, createChatSession, fetchVibeAppRuntimeStatus } from '../../api';
import type { Agent, Provider, ModelType, ChatMessage, TaskComplexity, StepStatus } from '../../types';
import type { PipelineStep, VibeSession, CodeParts, VibeHistoryItem, ServerParts, DbSchema } from './types';
import { useVibeHistory } from './useVibeHistory';
import { useFavoritePrompts } from './useFavoritePrompts';

// ─── sessionStorage 持久化 Key ──────────────────────────────────────────────
const STORAGE_KEY_DEPLOYED_APP_ID = 'vibe_deployed_app_id';
const STORAGE_KEY_RUNTIME_API_BASE = 'vibe_runtime_api_base';
const STORAGE_KEY_FULLSTACK_MODE = 'vibe_fullstack_mode';

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
  const [searchParams] = useSearchParams();
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

  // ─── 全栈模式（从 sessionStorage 恢复） ──────────────────────────────────
  const [isFullStackMode, setIsFullStackMode] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY_FULLSTACK_MODE) === 'true';
  });
  const [serverParts, setServerParts] = useState<ServerParts | null>(null);
  const [dbSchema, setDbSchema] = useState<DbSchema | null>(null);
  const [runtimeApiBase, setRuntimeApiBase] = useState<string>(() => {
    return sessionStorage.getItem(STORAGE_KEY_RUNTIME_API_BASE) || '';
  });
  const [deployedAppId, setDeployedAppId] = useState<string>(() => {
    return sessionStorage.getItem(STORAGE_KEY_DEPLOYED_APP_ID) || '';
  });
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

  // ─── 持久化同步：状态变化时写入 sessionStorage ─────────────────────────────
  useEffect(() => {
    if (runtimeApiBase) {
      sessionStorage.setItem(STORAGE_KEY_RUNTIME_API_BASE, runtimeApiBase);
    } else {
      sessionStorage.removeItem(STORAGE_KEY_RUNTIME_API_BASE);
    }
  }, [runtimeApiBase]);

  useEffect(() => {
    if (deployedAppId) {
      sessionStorage.setItem(STORAGE_KEY_DEPLOYED_APP_ID, deployedAppId);
    } else {
      sessionStorage.removeItem(STORAGE_KEY_DEPLOYED_APP_ID);
    }
  }, [deployedAppId]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY_FULLSTACK_MODE, String(isFullStackMode));
  }, [isFullStackMode]);

  // ─── 初始化：查询后端部署状态，恢复 runtimeApiBase ─────────────────────────
  useEffect(() => {
    const savedAppId = sessionStorage.getItem(STORAGE_KEY_DEPLOYED_APP_ID);
    if (!savedAppId) return;

    let cancelled = false;

    const restoreRuntime = async () => {
      try {
        const status = await fetchVibeAppRuntimeStatus(savedAppId);
        if (cancelled) return;

        if (status.deployed && status.basePath) {
          // 后端确认已部署，恢复 runtimeApiBase
          setRuntimeApiBase(status.basePath);
          setDeployedAppId(savedAppId);
          setIsFullStackMode(true);
          console.log(`🔄 已恢复全栈应用部署状态: ${status.title} → ${status.basePath}`);
        } else {
          // 后端未部署（可能服务器重启后未恢复），清理本地缓存
          console.warn('⚠️ 后端应用未部署，清理本地缓存');
          setRuntimeApiBase('');
          setDeployedAppId('');
          sessionStorage.removeItem(STORAGE_KEY_RUNTIME_API_BASE);
          sessionStorage.removeItem(STORAGE_KEY_DEPLOYED_APP_ID);
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('⚠️ 查询部署状态失败，保留本地缓存:', err);
        // 查询失败时保留 sessionStorage 中的值（可能是网络暂时不可用）
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
    // 清理全栈部署持久化数据
    setRuntimeApiBase('');
    setDeployedAppId('');
    sessionStorage.removeItem(STORAGE_KEY_RUNTIME_API_BASE);
    sessionStorage.removeItem(STORAGE_KEY_DEPLOYED_APP_ID);
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
