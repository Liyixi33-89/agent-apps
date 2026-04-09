/**
 * JSX/TSX 编译 API 路由
 *
 * POST /api/compile
 *   Body: { code: string }
 *   Response: { success, code, error, compiler, autoFixed }
 *
 * 安全措施：
 *   - 代码长度限制（最大 500KB）
 *   - 编译超时保护（10 秒）
 *   - 输入验证
 */

import Router from '@koa/router';
import { compileJsx, type CompileResult } from '../services/compileService.js';

const router = new Router({ prefix: '/compile' });

/** 最大代码长度（500KB） */
const MAX_CODE_LENGTH = 500 * 1024;

/** 编译超时时间（10 秒） */
const COMPILE_TIMEOUT_MS = 10_000;

/**
 * 带超时的 Promise 包装
 */
const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} 超时（${ms}ms）`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
};

/**
 * POST /api/compile
 * 编译 AI 生成的 JSX/TSX 代码
 */
router.post('/', async (ctx) => {
  const body = ctx.request.body as Record<string, unknown> | undefined;

  // 输入验证
  if (!body || typeof body.code !== 'string') {
    ctx.status = 400;
    ctx.body = { success: false, error: '缺少 code 参数', code: null, compiler: null, autoFixed: false } satisfies CompileResult;
    return;
  }

  const code = body.code as string;

  if (!code.trim()) {
    ctx.status = 400;
    ctx.body = { success: false, error: '代码为空', code: null, compiler: null, autoFixed: false } satisfies CompileResult;
    return;
  }

  if (code.length > MAX_CODE_LENGTH) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: `代码过长（${(code.length / 1024).toFixed(1)}KB），最大允许 ${MAX_CODE_LENGTH / 1024}KB`,
      code: null,
      compiler: null,
      autoFixed: false,
    } satisfies CompileResult;
    return;
  }

  try {
    const result = await withTimeout(compileJsx(code), COMPILE_TIMEOUT_MS, '编译');

    ctx.status = result.success ? 200 : 422;
    ctx.body = result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[compile] 编译异常:', message);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: `服务端编译异常: ${message}`,
      code: null,
      compiler: null,
      autoFixed: false,
    } satisfies CompileResult;
  }
});

export const compileRouter = router;
