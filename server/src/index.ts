import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import { env } from './config/env.js';
import { connectToMongo, disconnectFromMongo } from './db/mongo.js';
import { agentsRouter } from './routes/agents.js';
import { adminRouter } from './routes/admin.js';

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

// ─── 全局错误处理 ──────────────────────────────────────────────────────────────

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error: any) {
    ctx.status = error.status || 500;
    ctx.body = {
      success: false,
      message: error.message || 'Internal server error'
    };
    ctx.app.emit('error', error, ctx);
  }
});

// ─── 路由注册 ──────────────────────────────────────────────────────────────────

app.use(agentsRouter.routes());
app.use(agentsRouter.allowedMethods());
app.use(adminRouter.routes());
app.use(adminRouter.allowedMethods());

// ─── 启动 ──────────────────────────────────────────────────────────────────────

const bootstrap = async () => {
  await connectToMongo();

  const server = app.listen(env.port, () => {
    console.log(`🚀 Agency Agents Platform v2.0 running on http://127.0.0.1:${env.port}`);
    console.log(`📦 Provider: ${env.activeProvider}`);
    console.log(`🤖 Text Model: ${env.activeProvider === 'ollama' ? env.ollamaTextModel : env.codebuddyTextModel}`);
    console.log(`👁️  Vision Model: ${env.activeProvider === 'ollama' ? env.ollamaVisionModel : env.codebuddyVisionModel}`);
  });

  const shutdown = async () => {
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
