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

export const env = {
  nodeEnv: _nodeEnv,
  port: Number(process.env.PORT || 4000),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agency_agents',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173',
  adminOrigin: process.env.ADMIN_ORIGIN || 'http://127.0.0.1:5174',
  ingestRoot: process.env.INGEST_ROOT || workspaceRoot,
  activeProvider: (process.env.ACTIVE_PROVIDER || 'openai') as 'ollama' | 'openai',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  ollamaTextModel: process.env.OLLAMA_TEXT_MODEL || 'gpt-oss',
  ollamaVisionModel: process.env.OLLAMA_VISION_MODEL || 'qwen3-vl',
  openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  /** OpenAI API Key — 必须通过 .env 或环境变量配置，不提供默认值 */
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiTextModel: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
  openaiVisionModel: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
  pipelineStrongModel: process.env.PIPELINE_STRONG_MODEL || '',
  pipelineTemperature: Number(process.env.PIPELINE_TEMPERATURE || '0.3'),
  pipelineModelTier: (process.env.PIPELINE_MODEL_TIER || 'auto') as 'high' | 'medium' | 'low' | 'auto',
  pipelineMaxTokens: Number(process.env.PIPELINE_MAX_TOKENS || '0'),
  /** JWT Secret — 生产环境必须通过环境变量配置 */
  jwtSecret: process.env.JWT_SECRET || (_isProd ? '' : _devJwtSecret),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  workspaceRoot,
  serverRoot
};

export const isProduction = _isProd;

// ─── 启动校验：生产环境必须配置的环境变量 ────────────────────────────────────────
if (_isProd) {
  const missing: string[] = [];
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!process.env.OPENAI_API_KEY && env.activeProvider === 'openai') missing.push('OPENAI_API_KEY');
  if (missing.length > 0) {
    console.error(`❌ 生产环境缺少必要的环境变量: ${missing.join(', ')}`);
    console.error('   请在 .env 文件或系统环境变量中配置后重启');
    process.exit(1);
  }
} else {
  // 开发环境提示
  if (!process.env.OPENAI_API_KEY && env.activeProvider === 'openai') {
    console.warn('⚠️  未配置 OPENAI_API_KEY，OpenAI 调用将失败。请在 .env 中配置。');
  }
}
