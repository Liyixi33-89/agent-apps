import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..', '..');
// apps/ 目录（server 的上一级）
const appsRoot = path.resolve(serverRoot, '..');
// 项目根目录（apps/ 的上一级）
const workspaceRoot = path.resolve(appsRoot, '..');

const envCandidates = [
  // 优先读取 apps/.env（新的独立配置位置）
  path.join(appsRoot, '.env'),
  path.join(appsRoot, '.env.local'),
  // 兼容旧的根目录 .env
  path.join(workspaceRoot, '.env'),
  path.join(workspaceRoot, '.env.local'),
  // server 本地 .env
  path.join(serverRoot, '.env'),
  path.join(serverRoot, '.env.local')
];

envCandidates.forEach((filePath) => {
  dotenv.config({ path: filePath, override: false });
});

import crypto from 'node:crypto';

const _nodeEnv = process.env.NODE_ENV || 'development';
const _isProd = _nodeEnv === 'production';

// 生产环境必须通过环境变量配置敏感信息，开发环境使用安全的随机默认值
const _devJwtSecret = `dev-secret-${crypto.randomBytes(16).toString('hex')}`;

/** 支持的 LLM Provider 类型 */
export type LLMProvider = 'ollama' | 'openai' | 'claude' | 'gemini' | 'deepseek';

export const env = {
  nodeEnv: _nodeEnv,
  port: Number(process.env.PORT || 4000),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agency_agents',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173',
  adminOrigin: process.env.ADMIN_ORIGIN || 'http://127.0.0.1:5174',
  ingestRoot: process.env.INGEST_ROOT || workspaceRoot,
  activeProvider: (process.env.ACTIVE_PROVIDER || 'openai') as LLMProvider,

  // ─── Ollama 配置 ──────────────────────────────────────────────────────────
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  ollamaTextModel: process.env.OLLAMA_TEXT_MODEL || 'gpt-oss',
  ollamaVisionModel: process.env.OLLAMA_VISION_MODEL || 'qwen3-vl',

  // ─── OpenAI 配置 ──────────────────────────────────────────────────────────
  openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiTextModel: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
  openaiVisionModel: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',

  // ─── Claude (Anthropic) 配置 ──────────────────────────────────────────────
  claudeBaseUrl: process.env.CLAUDE_BASE_URL || 'https://api.anthropic.com',
  claudeApiKey: process.env.CLAUDE_API_KEY || '',
  claudeTextModel: process.env.CLAUDE_TEXT_MODEL || 'claude-sonnet-4-20250514',
  claudeVisionModel: process.env.CLAUDE_VISION_MODEL || 'claude-sonnet-4-20250514',

  // ─── Gemini (Google) 配置 ─────────────────────────────────────────────────
  geminiBaseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiTextModel: process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash',
  geminiVisionModel: process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash',

  // ─── DeepSeek 配置 ────────────────────────────────────────────────────────
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekTextModel: process.env.DEEPSEEK_TEXT_MODEL || 'deepseek-chat',
  deepseekVisionModel: process.env.DEEPSEEK_VISION_MODEL || 'deepseek-chat',

  // ─── 模型路由策略 ─────────────────────────────────────────────────────────
  /** 模型路由策略：manual=手动指定, auto=根据任务自动选择, fallback=主模型失败自动降级 */
  modelRoutingStrategy: (process.env.MODEL_ROUTING_STRATEGY || 'manual') as 'manual' | 'auto' | 'fallback',
  /** Fallback Provider 链（逗号分隔，如 'openai,claude,deepseek'） */
  fallbackProviders: (process.env.FALLBACK_PROVIDERS || '').split(',').filter(Boolean) as LLMProvider[],

  // ─── Pipeline 配置 ────────────────────────────────────────────────────────
  pipelineStrongModel: process.env.PIPELINE_STRONG_MODEL || '',
  pipelineTemperature: Number(process.env.PIPELINE_TEMPERATURE || '0.3'),
  pipelineModelTier: (process.env.PIPELINE_MODEL_TIER || 'auto') as 'high' | 'medium' | 'low' | 'auto',
  pipelineMaxTokens: Number(process.env.PIPELINE_MAX_TOKENS || '0'),

  // ─── Token 配额管理 ───────────────────────────────────────────────────────
  /** 全局每日 Token 预算（0=不限制） */
  dailyTokenBudget: Number(process.env.DAILY_TOKEN_BUDGET || '0'),
  /** 单用户每日 Token 配额（0=不限制） */
  userDailyTokenQuota: Number(process.env.USER_DAILY_TOKEN_QUOTA || '0'),
  /** API 限流：每分钟最大请求数（0=不限制） */
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE || '0'),

  // ─── 认证与权限 ───────────────────────────────────────────────────────────
  jwtSecret: process.env.JWT_SECRET || (_isProd ? '' : _devJwtSecret),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  /** 是否启用多租户模式 */
  multiTenantEnabled: process.env.MULTI_TENANT_ENABLED === 'true',

  // ─── OAuth 第三方登录 ──────────────────────────────────────────────────────
  /** GitHub OAuth */
  githubClientId: process.env.GITHUB_CLIENT_ID || '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  /** Google OAuth */
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  /** 企业微信 OAuth */
  wechatCorpId: process.env.WECHAT_CORP_ID || '',
  wechatCorpSecret: process.env.WECHAT_CORP_SECRET || '',
  wechatAgentId: process.env.WECHAT_AGENT_ID || '',
  /** OAuth 回调基础 URL */
  oauthCallbackBase: process.env.OAUTH_CALLBACK_BASE || 'http://127.0.0.1:4000',

  // ─── RAG 向量检索 ─────────────────────────────────────────────────────────
  /** 向量嵌入 Provider（使用 LLM Provider 的 embedding 接口） */
  embeddingProvider: (process.env.EMBEDDING_PROVIDER || 'openai') as LLMProvider,
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  /** 向量维度（text-embedding-3-small=1536） */
  embeddingDimension: Number(process.env.EMBEDDING_DIMENSION || '1536'),

  workspaceRoot,
  serverRoot
};

export const isProduction = _isProd;

// ─── 启动校验：生产环境必须配置的环境变量 ────────────────────────────────────────
if (_isProd) {
  const missing: string[] = [];
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  // 根据激活的 Provider 检查对应的 API Key
  const providerKeyMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    claude: 'CLAUDE_API_KEY',
    gemini: 'GEMINI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
  };
  const requiredKey = providerKeyMap[env.activeProvider];
  if (requiredKey && !process.env[requiredKey]) missing.push(requiredKey);
  if (missing.length > 0) {
    console.error(`❌ 生产环境缺少必要的环境变量: ${missing.join(', ')}`);
    console.error('   请在 .env 文件或系统环境变量中配置后重启');
    process.exit(1);
  }
} else {
  // 开发环境提示
  const providerWarnings: Record<string, [string, string]> = {
    openai: ['OPENAI_API_KEY', 'OpenAI'],
    claude: ['CLAUDE_API_KEY', 'Claude'],
    gemini: ['GEMINI_API_KEY', 'Gemini'],
    deepseek: ['DEEPSEEK_API_KEY', 'DeepSeek'],
  };
  const warn = providerWarnings[env.activeProvider];
  if (warn && !process.env[warn[0]]) {
    console.warn(`⚠️  未配置 ${warn[0]}，${warn[1]} 调用将失败。请在 .env 中配置。`);
  }
}
