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
