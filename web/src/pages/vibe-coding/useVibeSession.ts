import { useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../store';
import { fetchAgents, createChatSession } from '../../api';
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

  // ─── 全栈模式 ──────────────────────────────────────────────────────────────
  const [isFullStackMode, setIsFullStackMode] = useState(false);
  const [serverParts, setServerParts] = useState<ServerParts | null>(null);
  const [dbSchema, setDbSchema] = useState<DbSchema | null>(null);
  const [runtimeApiBase, setRuntimeApiBase] = useState<string>('');
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
