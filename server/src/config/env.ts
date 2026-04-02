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

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agency_agents',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173',
  adminOrigin: process.env.ADMIN_ORIGIN || 'http://127.0.0.1:5174',
  ingestRoot: process.env.INGEST_ROOT || workspaceRoot,
  activeProvider: (process.env.ACTIVE_PROVIDER || 'openai') as 'ollama' | 'openai',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  ollamaTextModel: process.env.OLLAMA_TEXT_MODEL || 'gpt-oss',
  ollamaVisionModel: process.env.OLLAMA_VISION_MODEL || 'qwen3-vl',
  openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.chatanywhere.tech/v1',
  openaiApiKey: process.env.OPENAI_API_KEY || 'sk-87Mx8OS3mraPp72NAGf9EBZJAh5aM2wiou2FFuoRzLfm6g7E',
  openaiTextModel: process.env.OPENAI_TEXT_MODEL || 'gpt-5.4-ca',
  openaiVisionModel: process.env.OPENAI_VISION_MODEL || 'gpt-4o-ca',
  jwtSecret: process.env.JWT_SECRET || 'agency-agents-secret-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  workspaceRoot,
  serverRoot
};

export const isProduction = env.nodeEnv === 'production';
