import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import koaStatic from 'koa-static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env, isProduction } from './config/env.js';
import { connectToMongo, disconnectFromMongo } from './db/mongo.js';
import { agentsRouter } from './routes/agents.js';
import { adminRouter } from './routes/admin.js';
import { extensionsRouter } from './routes/extensions.js';
import { Agent } from './models/Agent.js';
import { KnowledgeBase } from './models/KnowledgeBase.js';
import { ingestAgentsFromMarkdown, ingestKnowledgeFromAgents } from './services/agentIngestionService.js';
import { restoreDeployedApps } from './routes/vibeAppRuntime.js';
import { disconnectAllMcpServers } from './services/mcpService.js';
import { seedBuiltinSkills } from './lib/builtinSkills.js';
import { seedBuiltinRoles } from './models/Role.js';
import { startKnowledgeScheduler, stopKnowledgeScheduler } from './services/knowledgeScheduler.js';
import { knowledgeGraphRouter } from './routes/knowledgeGraph.js';
import { agentMarketRouter } from './routes/agentMarket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AGENTS_JSON = path.resolve(__dirname, '..', 'seed-data', 'agents.json');

const app = new Koa();

// ─── CORS ──────────────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: (ctx) => {
      const allowedOrigins = [env.clientOrigin, env.adminOrigin];
      const requestOrigin = ctx.request.headers.origin || '';
      return allowedOrigins.includes(requestOrigin) ? requestOrigin : env.clientOrigin;
    },
    credentials: true
  })
);

// ─── Body Parser ───────────────────────────────────────────────────────────────

app.use(bodyParser({ jsonLimit: '10mb' }));

// ─── 静态文件服务（uploads 目录）──────────────────────────────────────────────

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use(koaStatic(UPLOADS_DIR, { prefix: '/uploads' }));

// ─── 全局错误处理 ──────────────────────────────────────────────────────────────

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    ctx.status = err.status || 500;
    ctx.body = {
      success: false,
      message: isProduction && ctx.status === 500
        ? 'Internal server error'
        : (err.message || 'Internal server error'),
    };
    ctx.app.emit('error', error, ctx);
  }
});

// ─── 路由注册 ──────────────────────────────────────────────────────────────────

app.use(agentsRouter.routes());
app.use(agentsRouter.allowedMethods());
app.use(adminRouter.routes());
app.use(adminRouter.allowedMethods());
app.use(extensionsRouter.routes());
app.use(extensionsRouter.allowedMethods());
app.use(knowledgeGraphRouter.routes());
app.use(knowledgeGraphRouter.allowedMethods());
app.use(agentMarketRouter.routes());
app.use(agentMarketRouter.allowedMethods());

// ─── 启动 ──────────────────────────────────────────────────────────────────────

// ─── 自动初始化：数据库为空时自动 seed ────────────────────────────────────────

const autoSeedIfEmpty = async () => {
  const agentCount = await Agent.countDocuments();
  if (agentCount > 0) {
    console.log(`📦 数据库已有 ${agentCount} 个 Agent，跳过自动初始化`);
    return;
  }

  console.log('🌱 数据库为空，开始自动初始化数据...');

  try {
    const hasJsonFile = fs.existsSync(AGENTS_JSON);

    if (hasJsonFile) {
      // 优先：从 JSON 文件导入（线上部署/他人使用）
      console.log(`� 从 JSON 文件导入 Agent: ${AGENTS_JSON}`);
      const rawData = fs.readFileSync(AGENTS_JSON, 'utf-8');
      const agents: Record<string, unknown>[] = JSON.parse(rawData);
      for (const agentData of agents) {
        const slug = agentData.slug as string;
        if (slug) {
          await Agent.findOneAndUpdate(
            { slug },
            { $set: agentData },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        }
      }
      console.log(`✅ Agent 导入完成：${agents.length} 个`);
    } else {
      // 回退：从 Markdown 扫描（本地开发）
      console.log(`📁 从 Markdown 扫描 Agent: ${env.ingestRoot}`);
      const agentResult = await ingestAgentsFromMarkdown(env.ingestRoot, true);
      if (agentResult.totalAgents === 0) {
        console.warn('⚠️  未找到数据源，自动初始化跳过');
        console.warn(`   - JSON 文件路径: ${AGENTS_JSON}`);
        console.warn(`   - Markdown 路径: ${env.ingestRoot}`);
        return;
      }
      console.log(`✅ Agent 同步完成：${agentResult.totalAgents} 个（新建 ${agentResult.created}）`);
    }

    // 生成知识库
    const knowledgeCount = await KnowledgeBase.countDocuments();
    if (knowledgeCount === 0) {
      const knowledgeResult = await ingestKnowledgeFromAgents();
      console.log(`✅ 知识库生成完成：${knowledgeResult.totalChunks} 个知识块`);
    }

    console.log('🎉 自动初始化完成！');
  } catch (err) {
    console.error('❌ 自动初始化失败（不影响服务启动）:', err);
  }
};

const bootstrap = async () => {
  await connectToMongo();

  // 自动检测并初始化数据
  await autoSeedIfEmpty();

  // 初始化内置 Skill
  await seedBuiltinSkills();

  // 初始化内置角色（RBAC）
  await seedBuiltinRoles();

  // 恢复已部署的 Vibe App 后端（动态路由）
  await restoreDeployedApps();

  // 启动知识库 URL 定时更新（每 6 小时）
  startKnowledgeScheduler(6);

  const server = app.listen(env.port, () => {
    console.log(`🚀 Agency Agents Platform v2.0 running on http://127.0.0.1:${env.port}`);
    console.log(`📦 Provider: ${env.activeProvider}`);
    console.log(`🤖 Text Model: ${env.activeProvider === 'ollama' ? env.ollamaTextModel : env.openaiTextModel}`);
    console.log(`👁️  Vision Model: ${env.activeProvider === 'ollama' ? env.ollamaVisionModel : env.openaiVisionModel}`);
    console.log(`🔐 RBAC: 已启用 | 多租户: ${env.multiTenantEnabled ? '已启用' : '未启用'}`);
    console.log(`💰 Token 预算: ${env.dailyTokenBudget > 0 ? env.dailyTokenBudget + '/天' : '不限制'}`);
    console.log(`🔄 模型路由: ${env.modelRoutingStrategy}${env.fallbackProviders.length > 0 ? ' | Fallback: ' + env.fallbackProviders.join('→') : ''}`);
  });

  const shutdown = async () => {
    stopKnowledgeScheduler();
    disconnectAllMcpServers();
    server.close(async () => {
      await disconnectFromMongo();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

bootstrap().catch((error) => {
  console.error('❌ Failed to bootstrap server', error);
  process.exit(1);
});

app.on('error', (error: Error) => {
  console.error('Koa application error', error);
});
