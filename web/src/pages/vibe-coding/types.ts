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

export type PreviewTab = 'preview' | 'code';
export type CodeTab = 'html' | 'css' | 'js';

export interface PromptCategory {
  label: { zh: string; en: string };
  icon: string;
  color: string;
  prompts: { zh: string; en: string }[];
}
