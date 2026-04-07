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
  jsx?: string;         // React JSX 代码
  compiledJs?: string;  // 服务端预编译后的 JS 代码（有则浏览器直接渲染，跳过二次编译）
  isFullHtml?: boolean;
  isReact?: boolean;    // 标记为 React 渲染模式
}

/** 后端代码（全栈模式） */
export interface ServerParts {
  model: string;       // Mongoose Model 代码
  route: string;       // Koa Router 代码
  service: string;     // Service 层代码
  middleware: string;   // 中间件代码
  envTemplate: string;  // .env 模板
}

/** 数据库 Schema（全栈模式） */
export interface DbSchema {
  collections: string; // MongoDB 集合定义 JSON
  indexes: string;     // 索引定义
  seedData: string;    // 种子数据
}

/** 全栈项目完整数据 */
export interface FullStackParts {
  codeParts: CodeParts;
  serverParts: ServerParts;
  dbSchema: DbSchema;
}

export type PreviewTab = 'preview' | 'code' | 'history';
export type CodeTab = 'html' | 'css' | 'js' | 'jsx';

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
  serverParts?: ServerParts;   // 全栈模式下的后端代码
  dbSchema?: DbSchema;         // 全栈模式下的数据库 Schema
  isFullStack?: boolean;       // 是否为全栈项目
  createdAt: string;      // ISO 时间
  thumbnail?: string;     // base64 截图（可选）
}

// ─── 收藏提示词 ──────────────────────────────────────────────────────────────

export interface FavoritePrompt {
  id: string;
  text: string;
  createdAt: string;
}

