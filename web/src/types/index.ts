// ─── 通用类型定义 ──────────────────────────────────────────────────────────────

export interface LocalizedText {
  zh: string;
  en: string;
}

export interface Agent {
  _id: string;
  slug: string;
  categoryKey: string;
  name: LocalizedText;
  description: LocalizedText;
  vibe: LocalizedText;
  emoji: string;
  color: string;
  sourcePath: string;
  rawMarkdown: string;
  sections: Section[];
  tags: string[];
  capabilities: LocalizedText[];
  workflow: {
    summary: LocalizedText;
    nodes: WorkflowNode[];
  };
  modelPreferences: {
    primary: 'text' | 'vision';
    recommendedProvider: 'ollama' | 'openai';
  };
  stats: {
    sectionCount: number;
    wordCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  key: string;
  heading: LocalizedText;
  markdown: LocalizedText;
  order: number;
}

export interface WorkflowNode {
  nodeId: string;
  label: LocalizedText;
  type: string;
  dependsOn: string[];
  promptHint: LocalizedText;
  modelType: 'text' | 'vision';
}

export interface Category {
  _id: string;
  key: string;
  name: LocalizedText;
  description: LocalizedText;
  icon: string;
  color: string;
  sortOrder: number;
  stats: { agentCount: number };
}

export interface Pipeline {
  _id: string;
  key: string;
  name: LocalizedText;
  description: LocalizedText;
  systemPrompt: LocalizedText;
  steps: PipelineStep[];
  createdAt: string;
}

export interface PipelineStep {
  key: string;
  title: LocalizedText;
  description: LocalizedText;
  modelType: 'text' | 'vision';
  order: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  provider?: Provider;
  imageUrl?: string;
}

export interface ChatSession {
  _id: string;
  sessionId: string;
  agentSlug?: string;
  agentName?: string;
  title: string;
  messages: ChatMessage[];
  provider: Provider;
  modelType: 'text' | 'vision';
  updatedAt: string;
}

export interface KnowledgeBase {
  _id: string;
  title: LocalizedText;
  description: LocalizedText;
  sourceType: 'markdown' | 'text' | 'url';
  categoryKey?: string;
  agentSlug?: string;
  tags: string[];
  isActive: boolean;
  stats: { chunkCount: number; wordCount: number };
  createdAt: string;
}

export interface OverviewStats {
  agentCount: number;
  categoryCount: number;
  pipelineCount: number;
  knowledgeCount: number;
}

export type Provider = 'ollama' | 'openai' | 'claude' | 'gemini' | 'deepseek';
export type ModelType = 'text' | 'vision';
export type Lang = 'zh' | 'en';

export interface SystemPrompt {
  _id: string;
  key: string;
  category: 'vibe' | 'pipeline';
  name: string;
  description: string;
  content: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Agent 规划器类型 ───────────────────────────────────────────────────────────

export type TaskComplexity = 'simple' | 'moderate' | 'complex';
export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface PlanStep {
  id: string;
  index: number;
  title: string;
  description: string;
  tools: string[];
  agentSlug?: string;
  inputFrom: string[];
  expectedOutput: string;
  status: StepStatus;
  result?: string;
  error?: string;
  retryCount: number;
  skippable: boolean;
}

export interface ExecutionPlan {
  planId: string;
  userPrompt: string;
  complexity: TaskComplexity;
  complexityReason: string;
  steps: PlanStep[];
  goal: string;
  totalSteps: number;
  createdAt: string;
}

export interface ToolDefinitionParam {
  type: string;
  description: string;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, ToolDefinitionParam>;
    required: string[];
  };
}

// SSE 事件类型
export type PlanSSEEvent =
  | { type: 'start'; message: string }
  | { type: 'analyze'; complexity: TaskComplexity; reason: string }
  | { type: 'planning'; message: string }
  | { type: 'plan_ready'; plan: Omit<ExecutionPlan, 'createdAt'> }
  | { type: 'step_update'; step: { id: string; index: number; title: string; status: StepStatus; result?: string; toolResults?: Array<{ toolName: string; success: boolean; summary?: string }>; error?: string; retryCount: number } }
  | { type: 'done'; success: boolean; finalResult: string; plan: Pick<ExecutionPlan, 'planId' | 'steps'> }
  | { type: 'error'; message: string };

// ReAct SSE 事件类型
export type ReActSSEEvent =
  | { type: 'start'; mode: string; message: string }
  | { type: 'react_step'; step: { index: number; thought: string; action?: string; actionInput?: Record<string, unknown>; observation?: string; isFinal: boolean; finalAnswer?: string; duration: number } }
  | { type: 'done'; success: boolean; finalAnswer: string; totalSteps: number; toolCallCount: number; totalDuration: number }
  | { type: 'error'; message: string };

// ─── 扩展功能类型 ───────────────────────────────────────────────────────────────

/** LLM Provider 信息 */
export interface ProviderInfo {
  provider: Provider;
  configured: boolean;
  textModel: string;
  visionModel: string;
}

/** Token 用量统计 */
export interface TokenUsageStats {
  totalTokens: number;
  totalCost: number;
  callCount: number;
  avgDuration: number;
  successRate: number;
  budget: number;
  remaining: number;
}

/** Token 用量记录 */
export interface TokenUsageRecord {
  _id: string;
  provider: string;
  model: string;
  callType: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  duration: number;
  success: boolean;
  createdAt: string;
}

/** RBAC 角色 */
export interface Role {
  _id: string;
  key: string;
  name: string;
  description: string;
  permissions: Array<{ resource: string; actions: string[] }>;
  isBuiltin: boolean;
  isActive: boolean;
  createdAt: string;
}

/** 用户信息（含角色） */
export interface UserInfo {
  _id: string;
  username: string;
  email: string;
  role: string;
  avatar?: string;
  tenantId?: string;
  preferences?: {
    lang: 'zh' | 'en';
    theme: 'light' | 'dark' | 'auto';
    defaultProvider?: string;
  };
  dailyTokenQuota: number;
  todayTokenUsed: number;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

/** Agent 记忆条目 */
export interface MemoryEntry {
  memoryId: string;
  type: 'session' | 'long_term' | 'working';
  content: string;
  summary: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  accessCount: number;
  lastAccessedAt: string;
  createdAt: string;
}

/** 语义搜索结果 */
export interface SemanticSearchResult {
  knowledgeId: string;
  title: LocalizedText;
  chunkId: string;
  content: LocalizedText;
  score: number;
  categoryKey?: string;
  agentSlug?: string;
}

/** Multi-Agent 协作模式 */
export type CollaborationMode = 'sequential' | 'parallel' | 'debate';

/** 协作步骤结果 */
export interface CollaborationStepResult {
  agentSlug: string;
  agentName: string;
  output: string;
  duration: number;
  status: 'success' | 'failed';
  error?: string;
}

/** MCP 模板 */
export interface McpTemplate {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  transportType: 'stdio' | 'sse';
  installGuide: string;
  expectedTools: Array<{ name: string; description: string }>;
}

/** 扩展功能状态 */
export interface ExtensionsStatus {
  multiProvider: { enabled: boolean; activeProvider: string; configuredProviders: string[] };
  rag: { enabled: boolean; embeddingProvider: string; embeddingModel: string };
  rbac: { enabled: boolean; builtinRoles: string[] };
  multiTenant: { enabled: boolean };
  tokenBudget: { enabled: boolean; dailyBudget: number; userQuota: number };
  rateLimit: { enabled: boolean; perMinute: number };
  memory: { enabled: boolean };
  multiAgent: { enabled: boolean; modes: string[] };
  mcpMarket: { enabled: boolean; templateCount: number };
}
