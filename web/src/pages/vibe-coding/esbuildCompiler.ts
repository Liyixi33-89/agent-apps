/**
 * 前端编译器 — 服务端编译代理
 *
 * 将 AI 生成的 JSX/TSX 代码发送到服务端 /api/compile 进行编译。
 * 服务端使用原生 esbuild（比 WASM 快 3-5 倍）+ Sucrase 兜底。
 *
 * 前端不再需要 esbuild-wasm，大幅减小包体积和初始化时间。
 */

// ─── 编译结果类型 ────────────────────────────────────────────────────────────

export type CompileResult =
  | { code: string; error: null }
  | { code: null; error: string };

// ─── 服务端编译 API 响应类型 ─────────────────────────────────────────────────

interface ServerCompileResponse {
  success: boolean;
  code: string | null;
  error: string | null;
  compiler: 'esbuild' | 'sucrase' | null;
  autoFixed: boolean;
}

// ─── 编译 API 地址 ──────────────────────────────────────────────────────────

const getCompileApiUrl = (): string => {
  // 优先使用环境变量中的 API 地址
  const base = import.meta.env?.VITE_API_BASE || '';
  if (base) return `${base}/api/compile`;
  // 默认使用相对路径（同源部署）或开发环境地址
  return '/api/compile';
};

// ─── 核心编译函数 ────────────────────────────────────────────────────────────

/**
 * 将 AI 生成的 JSX/TSX 代码发送到服务端编译
 *
 * @param jsxCode - AI 生成的原始 JSX/TSX 代码
 * @returns 编译结果（code 或 error）
 */
export const compileJsx = async (jsxCode: string): Promise<CompileResult> => {
  if (!jsxCode?.trim()) {
    return { code: null, error: '代码为空' };
  }

  try {
    const apiUrl = getCompileApiUrl();

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: jsxCode }),
    });

    // 网络层错误
    if (!response.ok && response.status >= 500) {
      const text = await response.text().catch(() => '');
      return { code: null, error: `服务端编译服务异常 (${response.status}): ${text}` };
    }

    const result: ServerCompileResponse = await response.json();

    if (result.success && result.code) {
      // 编译成功
      if (result.compiler === 'sucrase') {
        console.info('[compile] 使用 Sucrase 兜底编译成功');
      }
      if (result.autoFixed) {
        console.info('[compile] 代码经过自动括号修复');
      }
      return { code: result.code, error: null };
    }

    // 编译失败
    return { code: null, error: result.error || '编译失败（未知错误）' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // 网络错误（服务端不可达）
    if (message.includes('fetch') || message.includes('network') || message.includes('Failed')) {
      console.error('[compile] 服务端不可达，请确保后端服务已启动:', message);
      return { code: null, error: `编译服务不可达，请确保后端服务已启动。\n${message}` };
    }

    return { code: null, error: message };
  }
};

// ─── 预初始化（兼容旧接口，现在是空操作）────────────────────────────────────

/**
 * 预初始化（保持向后兼容）
 * 服务端编译模式下不需要初始化，此函数为空操作。
 */
export const preInitEsbuild = (): void => {
  // 服务端编译模式，无需前端初始化
  console.info('[compile] 使用服务端编译模式（原生 esbuild + Sucrase 兜底）');
};

// ─── 同步编译（兼容旧接口）────────────────────────────────────────────────

/**
 * 同步版本的编译（降级兼容）
 * 服务端编译是异步的，同步版本只做最基础的预处理。
 * 建议始终使用异步版本 compileJsx()。
 */
export const compileJsxSync = (jsxCode: string): CompileResult => {
  console.warn('[compile] compileJsxSync 已废弃，请使用异步版本 compileJsx()');

  try {
    // 最基础的预处理：移除 import 和 export
    let code = jsxCode
      .replace(/^\s*import\s+.*$/gm, '')
      .replace(/^export\s+default\s+/m, 'var __VibeApp__ = ')
      .replace(/^export\s+(const|let|var|function|class)\s+/gm, '$1 ')
      .replace(/^export\s+\{[^}]*\}\s*;?\s*$/gm, '');

    return { code, error: null };
  } catch (err) {
    return { code: null, error: err instanceof Error ? err.message : String(err) };
  }
};
