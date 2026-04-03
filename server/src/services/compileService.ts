/**
 * 服务端 JSX/TSX 编译服务
 *
 * 架构：
 *   1. 预处理：移除 import 语句、渲染入口代码
 *   2. 括号修复：处理 AI 生成代码被截断的情况
 *   3. 编译（三层策略）：
 *      - 第一层：esbuild 原生编译（极快，<50ms）
 *      - 第二层：轻量修复 + esbuild 重试
 *      - 第三层：Sucrase 兜底（更宽容的编译器）
 *   4. 后处理：export default → __VibeApp__ 赋值
 */

import * as esbuild from 'esbuild';
import { transform as sucraseTransform } from 'sucrase';

// ─── 编译结果类型 ────────────────────────────────────────────────────────────

export interface CompileResult {
  success: boolean;
  code: string | null;
  error: string | null;
  /** 使用的编译器 */
  compiler: 'esbuild' | 'sucrase' | null;
  /** 是否经过自动修复 */
  autoFixed: boolean;
}

// ─── 预处理：移除 import / 渲染入口 ─────────────────────────────────────────

/**
 * 预处理 AI 生成的代码：
 * - 移除所有 import 语句（浏览器端 iframe 无法解析模块导入）
 * - 移除 AI 生成的渲染入口代码（由 iframe 模板统一控制）
 */
const preprocess = (code: string): string => {
  const lines = code.split('\n');
  const result: string[] = [];

  let inMultiLineImport = false;
  let inMultiLineRender = false;
  let renderParenDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── 多行 import 状态机 ──
    if (inMultiLineImport) {
      if (/\}\s*from\s+['"][^'"]+['"]\s*;?\s*$/.test(trimmed)) {
        inMultiLineImport = false;
      } else if (/^\}\s*$/.test(trimmed)) {
        inMultiLineImport = false;
        result.push(line);
      } else if (/^(?:const|let|var|function|class|export|return|if|for|while|switch|try|catch)\b/.test(trimmed)) {
        inMultiLineImport = false;
        result.push(line);
      }
      continue;
    }

    // ── 多行 render 调用状态机 ──
    if (inMultiLineRender) {
      for (const ch of line) {
        if (ch === '(') renderParenDepth++;
        if (ch === ')') renderParenDepth--;
      }
      if (renderParenDepth <= 0) {
        inMultiLineRender = false;
        renderParenDepth = 0;
      }
      continue;
    }

    // ── 检测多行 import 开始 ──
    if (/^\s*import\s+\{/.test(line) && !/\}\s*from\s+['"][^'"]+['"]\s*;?\s*$/.test(trimmed)) {
      inMultiLineImport = true;
      continue;
    }

    // ── 单行 import ──
    if (/^\s*import\s+.*from\s+['"][^'"]+['"]\s*;?\s*$/.test(line)) continue;
    if (/^\s*import\s+['"][^'"]+['"]\s*;?\s*$/.test(line)) continue;
    if (/^\s*import\s+type\s+/.test(line)) continue;

    // ── 动态 import / require ──
    if (/^\s*(?:const|let|var)\s+\w+\s*=\s*(?:await\s+)?import\s*\(/.test(line)) continue;
    if (/^\s*(?:const|let|var)\s+.*?=\s*require\s*\(/.test(line)) continue;

    // ── 移除 ReactDOM 渲染入口代码 ──
    const isRenderLine =
      /^\s*ReactDOM\.render\s*\(/.test(line) ||
      /^\s*(?:const|let|var)\s+\w+\s*=\s*ReactDOM\.createRoot\s*\(/.test(line) ||
      /^\s*ReactDOM\.createRoot\s*\(/.test(line) ||
      /^\s*\w+\.render\s*\(\s*(?:<|React\.createElement)/.test(line);

    if (isRenderLine) {
      let depth = 0;
      for (const ch of line) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
      }
      if (depth > 0) {
        inMultiLineRender = true;
        renderParenDepth = depth;
      }
      continue;
    }

    result.push(line);
  }

  return result.join('\n').trim();
};

// ─── 后处理：export default → __VibeApp__ ───────────────────────────────────

const postprocess = (code: string): string => {
  // 在编译后的代码头部注入运行时安全防护
  // 这些辅助函数可以防止 AI 生成的代码中 undefined.map() 等常见崩溃
  const safetyPreamble = [
    '/* __vibe_safety__ */',
    'var __safeArr = function(v) { return Array.isArray(v) ? v : (v == null ? [] : [v]); };',
    'var __safeObj = function(v) { return (v && typeof v === "object" && !Array.isArray(v)) ? v : {}; };',
    'var __safeStr = function(v) { return (v == null) ? "" : String(v); };',
  ].join('\n');

  let result = safetyPreamble + '\n' + code;

  // 处理 export default function/class 带名称
  const namedExportMatch = result.match(/^export\s+default\s+(?:function|class)\s+([A-Z][A-Za-z0-9_]*)/m);
  if (namedExportMatch) {
    result = result.replace(
      /^export\s+default\s+(function|class)\s+([A-Z][A-Za-z0-9_]*)\s*/m,
      (_, keyword, name) => `${keyword} ${name} `
    );
    if (!result.includes('__VibeApp__')) {
      result += `\nvar __VibeApp__ = ${namedExportMatch[1]};`;
    }
  }

  // 处理 export default 匿名/标识符
  if (!result.includes('__VibeApp__')) {
    result = result.replace(/^export\s+default\s+/m, 'var __VibeApp__ = ');
  }

  // 处理 CommonJS 格式
  if (!result.includes('__VibeApp__')) {
    const cjsMatch = result.match(/(?:^|\n)\s*(?:var|let|const)\s+_default\s*=\s*([A-Z][A-Za-z0-9_]*)\s*;/);
    if (cjsMatch) result += `\nvar __VibeApp__ = ${cjsMatch[1]};`;
  }
  if (!result.includes('__VibeApp__')) {
    const exportsMatch = result.match(/(?:^|\n)\s*exports\.default\s*=\s*([A-Z][A-Za-z0-9_]*)\s*;/);
    if (exportsMatch) result += `\nvar __VibeApp__ = ${exportsMatch[1]};`;
  }
  if (!result.includes('__VibeApp__')) {
    const moduleMatch = result.match(/(?:^|\n)\s*module\.exports\s*=\s*([A-Z][A-Za-z0-9_]*)\s*;/);
    if (moduleMatch) result += `\nvar __VibeApp__ = ${moduleMatch[1]};`;
  }

  // 处理 export { App as default }
  const exportAsDefault = result.match(/^export\s+\{[^}]*\b(\w+)\s+as\s+default\b[^}]*\}\s*;?\s*$/m);
  if (exportAsDefault && !result.includes('__VibeApp__')) {
    result += `\nvar __VibeApp__ = ${exportAsDefault[1]};`;
  }

  // 清理 export 语句
  result = result.replace(/^export\s+\{[^}]*\}\s*;?\s*$/gm, '');
  result = result.replace(/^export\s+(const|let|var|function|class)\s+/gm, '$1 ');

  // 推断组件名
  if (!result.includes('__VibeApp__')) {
    const arrowMatch = result.match(/(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>/m);
    if (arrowMatch) {
      result += `\nvar __VibeApp__ = ${arrowMatch[1]};`;
    } else {
      const componentMatch = result.match(/(?:const|function|class)\s+([A-Z][A-Za-z0-9_]*)\s*(?:=|\(|\{|extends)/m);
      if (componentMatch) result += `\nvar __VibeApp__ = ${componentMatch[1]};`;
    }
  }

  return result;
};

// ─── 括号平衡检测与修复 ─────────────────────────────────────────────────────

/**
 * 智能括号计数器（跳过字符串和注释内的括号）
 */
const countBrackets = (code: string): { paren: number; brace: number; bracket: number } => {
  let paren = 0, brace = 0, bracket = 0;
  let inSingle = false, inDouble = false, inTemplate = false;
  let inLineComment = false, inBlockComment = false;
  let prev = '';

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = i + 1 < code.length ? code[i + 1] : '';

    if (inLineComment) { if (ch === '\n') inLineComment = false; prev = ch; continue; }
    if (inBlockComment) { if (ch === '*' && next === '/') { inBlockComment = false; i++; } prev = ch; continue; }
    if (!inSingle && !inDouble && !inTemplate) {
      if (ch === '/' && next === '/') { inLineComment = true; prev = ch; continue; }
      if (ch === '/' && next === '*') { inBlockComment = true; prev = ch; continue; }
    }

    if (ch === "'" && !inDouble && !inTemplate && prev !== '\\') { inSingle = !inSingle; prev = ch; continue; }
    if (ch === '"' && !inSingle && !inTemplate && prev !== '\\') { inDouble = !inDouble; prev = ch; continue; }
    if (ch === '`' && !inSingle && !inDouble && prev !== '\\') { inTemplate = !inTemplate; prev = ch; continue; }

    if (inSingle || inDouble || inTemplate) { prev = ch; continue; }

    if (ch === '(') paren++;
    else if (ch === ')') paren--;
    else if (ch === '{') brace++;
    else if (ch === '}') brace--;
    else if (ch === '[') bracket++;
    else if (ch === ']') bracket--;

    prev = ch;
  }

  return { paren, brace, bracket };
};

/**
 * 自动修复括号不平衡（处理 AI 截断代码）
 * 简洁版：只做最核心的修复
 */
const autoFixBrackets = (code: string): { code: string; fixed: boolean } => {
  const { paren, brace, bracket } = countBrackets(code);

  if (paren === 0 && brace === 0 && bracket === 0) {
    return { code, fixed: false };
  }

  let fixed = code;

  // 步骤 1：修复截断的字符串（最后一行未闭合的引号）
  const lines = fixed.split('\n');
  const lastLine = lines[lines.length - 1];
  let singleQuotes = 0, doubleQuotes = 0, templateQuotes = 0;
  for (let i = 0; i < lastLine.length; i++) {
    const ch = lastLine[i];
    if (ch === '\\') { i++; continue; }
    if (ch === "'") singleQuotes++;
    else if (ch === '"') doubleQuotes++;
    else if (ch === '`') templateQuotes++;
  }
  if (singleQuotes % 2 !== 0) fixed += "'";
  else if (doubleQuotes % 2 !== 0) fixed += '"';
  else if (templateQuotes % 2 !== 0) fixed += '`';

  // 步骤 2：用栈追踪未闭合的开括号，按逆序补全
  const openStack: string[] = [];
  let inStr = false, strChar = '';
  for (let i = 0; i < fixed.length; i++) {
    const ch = fixed[i];
    if (inStr) {
      if (ch === strChar && fixed[i - 1] !== '\\') inStr = false;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inStr = true; strChar = ch; continue; }
    if (ch === '(' || ch === '{' || ch === '[') openStack.push(ch);
    else if (ch === ')' || ch === '}' || ch === ']') openStack.pop();
  }

  if (openStack.length > 0) {
    const closers: string[] = [];
    for (let i = openStack.length - 1; i >= 0; i--) {
      if (openStack[i] === '(') closers.push(')');
      else if (openStack[i] === '{') closers.push('}');
      else if (openStack[i] === '[') closers.push(']');
    }
    fixed += '\n' + closers.join('') + ';';
  }

  // 步骤 3：处理多余的闭括号（从末尾移除）
  const afterFix = countBrackets(fixed);
  if (afterFix.paren < 0 || afterFix.brace < 0 || afterFix.bracket < 0) {
    const fixedLines = fixed.split('\n');
    while (fixedLines.length > 1) {
      const last = fixedLines[fixedLines.length - 1].trim();
      if (/^[)\]};,\s]+$/.test(last)) {
        fixedLines.pop();
        const recheck = countBrackets(fixedLines.join('\n'));
        if (recheck.paren >= 0 && recheck.brace >= 0 && recheck.bracket >= 0) break;
      } else {
        break;
      }
    }
    fixed = fixedLines.join('\n');
  }

  return { code: fixed, fixed: fixed !== code };
};

// ─── 核心编译函数 ────────────────────────────────────────────────────────────

/**
 * 使用 esbuild 原生编译 TSX → JS
 */
const compileWithEsbuild = async (code: string): Promise<string> => {
  const result = await esbuild.transform(code, {
    loader: 'tsx',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    target: 'es2020',
  });
  return result.code;
};

/**
 * 使用 Sucrase 兜底编译 TSX → JS
 * Sucrase 更宽容，能处理一些 esbuild 拒绝的代码
 */
const compileWithSucrase = (code: string): string => {
  const result = sucraseTransform(code, {
    transforms: ['typescript', 'jsx'],
    jsxPragma: 'React.createElement',
    jsxFragmentPragma: 'React.Fragment',
    production: false,
  });
  return result.code;
};

/**
 * 主编译入口：三层编译策略
 *
 * @param rawCode - AI 生成的原始 JSX/TSX 代码
 * @returns 编译结果
 */
export const compileJsx = async (rawCode: string): Promise<CompileResult> => {
  if (!rawCode?.trim()) {
    return { success: false, code: null, error: '代码为空', compiler: null, autoFixed: false };
  }

  // 1. 预处理
  const preprocessed = preprocess(rawCode);
  if (!preprocessed.trim()) {
    return { success: false, code: null, error: '代码为空（预处理后无有效内容）', compiler: null, autoFixed: false };
  }

  // 2. 括号修复
  const { code: fixedCode, fixed: wasFixed } = autoFixBrackets(preprocessed);

  // 3. 三层编译策略
  const errors: string[] = [];

  // ── 第一层：esbuild 原生编译 ──
  try {
    const compiled = await compileWithEsbuild(fixedCode);
    const finalCode = postprocess(compiled);
    return { success: true, code: finalCode, error: null, compiler: 'esbuild', autoFixed: wasFixed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`[esbuild] ${msg}`);
  }

  // ── 第二层：如果括号修复过，尝试用原始预处理代码重新编译 ──
  if (wasFixed) {
    try {
      const compiled = await compileWithEsbuild(preprocessed);
      const finalCode = postprocess(compiled);
      return { success: true, code: finalCode, error: null, compiler: 'esbuild', autoFixed: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[esbuild-retry] ${msg}`);
    }
  }

  // ── 第三层：Sucrase 兜底 ──
  // 先尝试修复后的代码
  try {
    const compiled = compileWithSucrase(fixedCode);
    const finalCode = postprocess(compiled);
    return { success: true, code: finalCode, error: null, compiler: 'sucrase', autoFixed: wasFixed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`[sucrase] ${msg}`);
  }

  // 再尝试原始预处理代码
  if (wasFixed) {
    try {
      const compiled = compileWithSucrase(preprocessed);
      const finalCode = postprocess(compiled);
      return { success: true, code: finalCode, error: null, compiler: 'sucrase', autoFixed: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[sucrase-retry] ${msg}`);
    }
  }

  // 全部失败
  return {
    success: false,
    code: null,
    error: errors.join('\n'),
    compiler: null,
    autoFixed: wasFixed,
  };
};
