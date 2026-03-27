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
    recommendedProvider: 'ollama' | 'codebuddy';
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
  provider?: 'ollama' | 'codebuddy';
  imageUrl?: string;
}

export interface ChatSession {
  _id: string;
  sessionId: string;
  agentSlug?: string;
  agentName?: string;
  title: string;
  messages: ChatMessage[];
  provider: 'ollama' | 'codebuddy';
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

export type Provider = 'ollama' | 'codebuddy';
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
