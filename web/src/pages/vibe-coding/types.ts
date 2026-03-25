import type { Provider, ModelType } from '../../types';

export interface PipelineStep {
  step: number;
  total: number;
  title: string;
  status: 'pending' | 'running' | 'done' | 'error';
  content?: string;
}

export interface VibeSession {
  sessionId: string;
  agentName: string;
  provider: Provider;
  modelType: ModelType;
}

export interface CodeParts {
  html: string;
  css: string;
  js: string;
  isFullHtml?: boolean;
}

export type PreviewTab = 'preview' | 'code' | 'history';
export type CodeTab = 'html' | 'css' | 'js';

export interface PromptCategory {
  label: { zh: string; en: string };
  icon: string;
  color: string;
  prompts: { zh: string; en: string }[];
}

// ─── 历史版本 ────────────────────────────────────────────────────────────────

export interface VibeHistoryItem {
  id: string;
  label: string;          // 用户输入的前 40 字
  codeParts: CodeParts;
  createdAt: string;      // ISO 时间
  thumbnail?: string;     // base64 截图（可选）
}

// ─── 收藏提示词 ──────────────────────────────────────────────────────────────

export interface FavoritePrompt {
  id: string;
  text: string;
  createdAt: string;
}

