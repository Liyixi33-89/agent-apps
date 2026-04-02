/**
 * esbuild-wasm 浏览器端编译引擎
 *
 * 替代 Babel standalone，提供完整的 TypeScript/TSX 编译支持。
 * esbuild 原生处理 TypeScript，不需要正则 hack。
 *
 * 架构：
 *   1. 初始化：懒加载 esbuild WASM（首次编译时触发，后续复用）
 *   2. 预处理：移除 import 语句、渲染入口代码（浏览器端不支持模块系统）
 *   3. 编译：esbuild.transform() 完整编译 TSX → JS
 *   4. 后处理：处理 export default → __VibeApp__ 赋值
 */

import * as esbuild from 'esbuild-wasm';

// ─── 初始化状态 ──────────────────────────────────────────────────────────────

let _initialized = false;
let _initPromise: Promise<void> | null = null;

/**
 * 确保 esbuild WASM 已初始化（懒加载，只初始化一次）
 */
const ensureInitialized = async (): Promise<void> => {
  if (_initialized) return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    // esbuild.initialize() 只能调用一次（即使失败也不能重试），
    // 所以必须先探测 WASM 文件可用性，确定 URL 后再调用。
    const candidates = [
      '/esbuild.wasm',                                          // 本地 public 目录
      'https://unpkg.com/esbuild-wasm@0.24.2/esbuild.wasm',    // CDN 降级
    ];

    let wasmURL = candidates[candidates.length - 1]; // 默认使用 CDN

    // 探测本地 WASM 文件是否可用（HEAD 请求，快速判断）
    for (const url of candidates) {
      try {
        const resp = await fetch(url, { method: 'HEAD' });
        if (resp.ok) {
          wasmURL = url;
          console.info('[esbuild] 探测到可用 WASM:', url);
          break;
        }
      } catch {
        // 本地文件不可用，继续尝试下一个
        console.info('[esbuild] WASM 不可用:', url);
      }
    }

    try {
      await esbuild.initialize({ wasmURL });
      _initialized = true;
      console.info('[esbuild] WASM 初始化完成，来源:', wasmURL);
    } catch (err) {
      // esbuild 内部可能已经标记为"已初始化"（即使上次失败了），
      // 此时直接尝试 transform 来验证是否真的可用
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('more than once')) {
        console.warn('[esbuild] initialize 已被调用过，尝试验证 transform 是否可用...');
        try {
          await esbuild.transform('const x = 1;', { loader: 'ts' });
          _initialized = true;
          console.info('[esbuild] WASM 实际可用（忽略 initialize 重复调用错误）');
          return;
        } catch {
          // transform 也失败了，说明 esbuild 真的不可用
        }
      }
      _initPromise = null;
      throw err;
    }
  })();

  return _initPromise;
};

/**
 * 预初始化 esbuild（可在应用启动时调用，避免首次编译延迟）
 */
export const preInitEsbuild = (): void => {
  ensureInitialized().catch((err) => {
    console.warn('[esbuild] 预初始化失败（将在首次编译时重试）:', err);
  });
};

// ─── 编译结果类型 ────────────────────────────────────────────────────────────

export type CompileResult =
  | { code: string; error: null }
  | { code: null; error: string };

// ─── 预处理：移除 import / 渲染入口 ─────────────────────────────────────────

/**
 * 预处理 AI 生成的代码：
 * - 移除所有 import 语句（浏览器端 iframe 无法解析模块导入）
 * - 移除 AI 生成的渲染入口代码（由 iframe 模板统一控制）
 *
 * 使用逐行扫描（状态机）替代跨行正则，避免误匹配导致代码被破坏。
 * TypeScript 语法（interface/type/enum/as/泛型等）不再需要预处理，esbuild 原生支持。
 */
const preprocess = (code: string): string => {
  const lines = code.split('\n');
  const result: string[] = [];

  // 状态机：是否正在跳过多行 import / 多行 render 调用
  let inMultiLineImport = false;
  let inMultiLineRender = false;
  let renderParenDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── 多行 import 状态机 ──────────────────────────────────────────
    if (inMultiLineImport) {
      // 等待 } from 'xxx' 结束行
      if (/\}\s*from\s+['"][^'"]+['"]\s*;?\s*$/.test(trimmed)) {
        inMultiLineImport = false;
      } else if (/^\}\s*$/.test(trimmed)) {
        // 安全阀：如果遇到单独的 } 但后面没有 from，说明这不是多行 import
        // 退出多行 import 模式，保留当前行（可能是对象解构的 }）
        inMultiLineImport = false;
        result.push(line);
      } else if (/^(?:const|let|var|function|class|export|return|if|for|while|switch|try|catch)\b/.test(trimmed)) {
        // 安全阀：如果遇到明显的语句开头关键字，说明多行 import 已经结束
        // 可能是 AI 生成了格式异常的 import（如 import { 后面没有 from）
        inMultiLineImport = false;
        result.push(line);
      }
      continue; // 跳过多行 import 的所有行
    }

    // ── 多行 render 调用状态机 ──────────────────────────────────────
    if (inMultiLineRender) {
      // 计算括号深度
      for (const ch of line) {
        if (ch === '(') renderParenDepth++;
        if (ch === ')') renderParenDepth--;
      }
      if (renderParenDepth <= 0) {
        inMultiLineRender = false;
        renderParenDepth = 0;
      }
      continue; // 跳过多行 render 的所有行
    }

    // ── 检测多行 import 开始 ────────────────────────────────────────
    // import { 开头，但本行没有 } from 'xxx' 结尾 → 进入多行模式
    if (/^\s*import\s+\{/.test(line) && !/\}\s*from\s+['"][^'"]+['"]\s*;?\s*$/.test(trimmed)) {
      inMultiLineImport = true;
      continue;
    }

    // ── 单行 import 语句 ────────────────────────────────────────────
    // import X from 'xxx' / import { A, B } from 'xxx' / import * as X from 'xxx'
    if (/^\s*import\s+.*from\s+['"][^'"]+['"]\s*;?\s*$/.test(line)) continue;
    // 副作用 import：import 'xxx' / import "xxx"
    if (/^\s*import\s+['"][^'"]+['"]\s*;?\s*$/.test(line)) continue;
    // import type 语句
    if (/^\s*import\s+type\s+/.test(line)) continue;

    // ── 动态 import / require ───────────────────────────────────────
    if (/^\s*(?:const|let|var)\s+\w+\s*=\s*(?:await\s+)?import\s*\(/.test(line)) continue;
    if (/^\s*(?:const|let|var)\s+.*?=\s*require\s*\(/.test(line)) continue;

    // ── 移除 ReactDOM 渲染入口代码（支持多行）──────────────────────
    const isRenderLine =
      /^\s*ReactDOM\.render\s*\(/.test(line) ||
      /^\s*(?:const|let|var)\s+\w+\s*=\s*ReactDOM\.createRoot\s*\(/.test(line) ||
      /^\s*ReactDOM\.createRoot\s*\(/.test(line) ||
      /^\s*\w+\.render\s*\(\s*(?:<|React\.createElement)/.test(line);

    if (isRenderLine) {
      // 检查是否是多行调用（括号未闭合）
      let depth = 0;
      for (const ch of line) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
      }
      if (depth > 0) {
        // 括号未闭合，进入多行 render 跳过模式
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

/**
 * 后处理编译后的代码：
 * - 将 export default 转换为 __VibeApp__ 赋值（iframe 模板通过此变量找到根组件）
 * - 移除其他 export 语句
 *
 * esbuild 在 format: 'esm' 模式下会保留 export 语句，
 * 我们需要将其转换为 iframe 可识别的格式。
 */
const postprocess = (code: string): string => {
  let result = code;

  // 处理 export default function/class 带名称的情况
  // esbuild 输出: export default function App() { ... }
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

  // 处理 export default 匿名函数/箭头函数/标识符
  if (!result.includes('__VibeApp__')) {
    result = result.replace(/^export\s+default\s+/m, 'var __VibeApp__ = ');
  }

  // 移除命名导出（export { xxx }）
  result = result.replace(/^export\s+\{[^}]*\}\s*;?\s*$/gm, '');
  // 移除 export 关键字但保留声明（export const/function/class → const/function/class）
  result = result.replace(/^export\s+(const|let|var|function|class)\s+/gm, '$1 ');

  // 如果没有 __VibeApp__，尝试从代码中推断组件名并追加赋值
  if (!result.includes('__VibeApp__')) {
    const componentMatch = result.match(/(?:const|function|class)\s+([A-Z][A-Za-z0-9_]*)\s*(?:=|\(|\{|extends)/m);
    if (componentMatch) {
      result += `\nvar __VibeApp__ = ${componentMatch[1]};`;
    }
  }

  return result;
};

// ─── 括号自动修复：处理 AI 生成代码被截断的情况 ─────────────────────────────

/**
 * 智能括号计数器（跳过字符串内的括号）
 * 返回各类括号的深度差值
 */
const countBrackets = (code: string): { paren: number; brace: number; bracket: number } => {
  let paren = 0, brace = 0, bracket = 0;
  let inSingle = false, inDouble = false, inTemplate = false, inLineComment = false, inBlockComment = false;
  let prev = '';

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = i + 1 < code.length ? code[i + 1] : '';

    // 处理注释
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      prev = ch;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i++; }
      prev = ch;
      continue;
    }
    if (!inSingle && !inDouble && !inTemplate) {
      if (ch === '/' && next === '/') { inLineComment = true; prev = ch; continue; }
      if (ch === '/' && next === '*') { inBlockComment = true; prev = ch; continue; }
    }

    // 处理字符串
    if (ch === "'" && !inDouble && !inTemplate && prev !== '\\') { inSingle = !inSingle; prev = ch; continue; }
    if (ch === '"' && !inSingle && !inTemplate && prev !== '\\') { inDouble = !inDouble; prev = ch; continue; }
    if (ch === '`' && !inSingle && !inDouble && prev !== '\\') { inTemplate = !inTemplate; prev = ch; continue; }

    // 在字符串内部不计数
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
 * 自动修复括号不平衡的代码
 * 策略：
 *   1. 检测截断的字符串（未闭合的引号）→ 补全引号
 *   2. 检测多余的开括号 → 在代码末尾补全对应的闭括号
 *   3. 检测多余的闭括号 → 尝试移除末尾多余的闭括号
 *   4. 对于截断的对象字面量（如 `btn:{bg:'#7c3a`）→ 补全值和闭合括号
 */
const autoFixBrackets = (code: string): string => {
  const { paren, brace, bracket } = countBrackets(code);

  // 如果括号已经平衡，直接返回
  if (paren === 0 && brace === 0 && bracket === 0) {
    return code;
  }

  console.warn(`[esbuild] 括号不平衡，尝试自动修复: () = ${paren}, {} = ${brace}, [] = ${bracket}`);

  let fixed = code;

  // 步骤 1：检测并修复截断的字符串
  fixed = fixTruncatedStrings(fixed);

  // 步骤 2：重新计算括号深度并补全闭括号
  // 按照 JS 语法，闭合顺序应该是从内到外：先 )，再 ]，再 }
  // 但实际上我们需要根据代码末尾的上下文来判断正确的闭合顺序
  const closingChars: string[] = [];

  // 从代码末尾反向扫描，确定正确的闭合顺序
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

  // openStack 中剩余的就是未闭合的开括号，按逆序补全
  for (let i = openStack.length - 1; i >= 0; i--) {
    const open = openStack[i];
    if (open === '(') closingChars.push(')');
    else if (open === '{') closingChars.push('}');
    else if (open === '[') closingChars.push(']');
  }

  if (closingChars.length > 0) {
    // 在补全之前，先处理截断的属性值（如 `bg:'#7c3a` → `bg:'#7c3a'`）
    const lastLine = fixed.split('\n').pop() || '';
    // 检查最后一行是否在一个未完成的属性赋值中
    const truncatedValueMatch = lastLine.match(/:\s*['"][^'"]*$/);
    if (truncatedValueMatch) {
      // 补全截断的字符串值
      const quoteChar = truncatedValueMatch[0].includes("'") ? "'" : '"';
      fixed += quoteChar;
    }

    fixed += '\n' + closingChars.join('') + ';';
    console.info(`[esbuild] ✅ 自动补全 ${closingChars.length} 个闭合括号: ${closingChars.join('')}`);
  }

  // 步骤 4：处理多余的闭括号（闭括号多于开括号的情况，较少见）
  const afterFix = countBrackets(fixed);
  if (afterFix.paren < 0 || afterFix.brace < 0 || afterFix.bracket < 0) {
    // 从末尾移除多余的闭括号
    const lines = fixed.split('\n');
    while (lines.length > 0) {
      const lastLine = lines[lines.length - 1].trim();
      if (/^[)\]};]+$/.test(lastLine)) {
        lines.pop();
        const recheck = countBrackets(lines.join('\n'));
        if (recheck.paren >= 0 && recheck.brace >= 0 && recheck.bracket >= 0) break;
      } else {
        break;
      }
    }
    fixed = lines.join('\n');
  }

  return fixed;
};

/**
 * 修复截断的字符串字面量
 * 当 AI 输出被截断时，可能在字符串中间断开
 */
const fixTruncatedStrings = (code: string): string => {
  const lines = code.split('\n');
  const lastLine = lines[lines.length - 1];

  // 计算最后一行中未闭合的引号
  let singleQuotes = 0, doubleQuotes = 0, templateQuotes = 0;
  for (let i = 0; i < lastLine.length; i++) {
    const ch = lastLine[i];
    if (ch === '\\') { i++; continue; } // 跳过转义字符
    if (ch === "'") singleQuotes++;
    else if (ch === '"') doubleQuotes++;
    else if (ch === '`') templateQuotes++;
  }

  // 奇数个引号说明有未闭合的字符串
  if (singleQuotes % 2 !== 0) {
    lines[lines.length - 1] = lastLine + "'";
    console.info("[esbuild] ✅ 自动补全截断的单引号字符串");
  } else if (doubleQuotes % 2 !== 0) {
    lines[lines.length - 1] = lastLine + '"';
    console.info('[esbuild] ✅ 自动补全截断的双引号字符串');
  } else if (templateQuotes % 2 !== 0) {
    lines[lines.length - 1] = lastLine + '`';
    console.info('[esbuild] ✅ 自动补全截断的模板字符串');
  }

  return lines.join('\n');
};

/**
 * 移除末尾多余的闭括号（修复后全局括号过多的情况）
 * 当 autoFixBrackets 在末尾补了闭括号，而 aggressiveAutoFix 又在中间插入了闭括号时，
 * 末尾的闭括号就多余了，需要清理。
 */
const removeTrailingExcessClosers = (code: string): string => {
  const balance = countBrackets(code);
  // 如果括号已经平衡或有未闭合的开括号，不需要清理
  if (balance.paren >= 0 && balance.brace >= 0 && balance.bracket >= 0) return code;

  const lines = code.split('\n');

  // 第一轮：从末尾移除纯闭括号行
  while (lines.length > 1) {
    const lastLine = lines[lines.length - 1].trim();
    // 只移除纯闭括号行（如 `});` 或 `)`）
    if (/^[)\]};,\s]+$/.test(lastLine)) {
      lines.pop();
      const recheck = countBrackets(lines.join('\n'));
      // 如果移除后括号平衡了，停止
      if (recheck.paren >= 0 && recheck.brace >= 0 && recheck.bracket >= 0) break;
    } else {
      break;
    }
  }

  // 第二轮：如果仍然不平衡，尝试从最后一行末尾移除多余的闭括号
  const recheck2 = countBrackets(lines.join('\n'));
  if (recheck2.paren < 0 || recheck2.brace < 0 || recheck2.bracket < 0) {
    const lastIdx = lines.length - 1;
    if (lastIdx >= 0) {
      let lastLine = lines[lastIdx];
      // 从行末尾逐字符检查，移除多余的闭括号
      while (lastLine.length > 0) {
        const lastChar = lastLine[lastLine.length - 1];
        if (lastChar === ')' || lastChar === '}' || lastChar === ']' || lastChar === ';') {
          const testLines = [...lines];
          testLines[lastIdx] = lastLine.slice(0, -1);
          const testBalance = countBrackets(testLines.join('\n'));
          if (testBalance.paren >= 0 && testBalance.brace >= 0 && testBalance.bracket >= 0) {
            lines[lastIdx] = testLines[lastIdx];
            break;
          }
          // 继续移除
          lastLine = lastLine.slice(0, -1);
          lines[lastIdx] = lastLine;
        } else {
          break;
        }
      }
    }
  }

  return lines.join('\n');
};

/**
 * 激进的自动修复（在首次编译失败后使用）
 * 根据 esbuild 的错误信息，尝试更精准的修复
 */
const aggressiveAutoFix = (code: string, errorMsg: string): string => {
  let fixed = code;

  // 解析错误位置
  const lineMatch = errorMsg.match(/<stdin>:(\d+):(\d+)/);
  if (!lineMatch) return fixed;

  const errLine = parseInt(lineMatch[1], 10);
  const errCol = parseInt(lineMatch[2], 10);
  const lines = fixed.split('\n');

  // 策略 1：Expected "}" but found ";" — 对象字面量被截断
  // 在错误行之前找到截断的对象，截断该行并补全
  if (errorMsg.includes('Expected "}"') && errorMsg.includes('found ";"')) {
    // 找到包含截断对象的行（通常是错误行或前一行）
    const targetLineIdx = Math.min(errLine - 1, lines.length - 1);
    const targetLine = lines[targetLineIdx];

    if (targetLine) {
      // 找到该行中最后一个完整的属性定义位置
      // 例如: `...btn:{bg:'#7c3a` → 截断在 bg 属性值中间
      // 尝试在错误列位置截断，然后补全
      const truncateCol = errCol > 0 ? errCol : targetLine.length;
      const truncated = targetLine.slice(0, truncateCol);

      // 计算截断后需要补全的括号
      const remaining = truncated;
      const brackets = countBrackets(remaining);

      // 补全截断的字符串
      let suffix = '';
      if (remaining.match(/['"][^'"]*$/)) {
        suffix += remaining.includes("'") && !remaining.match(/'[^']*'[^']*$/) ? "'" : '"';
      }

      // 补全括号
      const closers: string[] = [];
      for (let i = 0; i < brackets.brace; i++) closers.push('}');
      for (let i = 0; i < brackets.bracket; i++) closers.push(']');
      for (let i = 0; i < brackets.paren; i++) closers.push(')');
      suffix += closers.join('');

      if (suffix) {
        lines[targetLineIdx] = truncated + suffix;
        // 移除错误行之后可能的残留代码（如果截断导致后续行也有问题）
        fixed = lines.join('\n');
        console.info(`[esbuild] ✅ 激进修复：在第 ${targetLineIdx + 1} 行补全: ${suffix}`);
      }
    }
  }

  // 策略 2：Expected ")" but found "X" — 函数调用/箭头函数括号未闭合
  // 匹配所有 Expected ")" 错误，但只在确实有未闭合的圆括号时才修复
  if (errorMsg.includes('Expected ")"') && !fixed.includes('/* strategy2-applied */')) {
    // 在错误行之前插入缺失的闭括号
    if (errLine > 0 && errLine <= lines.length) {
      const prevLineIdx = errLine - 2; // 错误行的前一行
      if (prevLineIdx >= 0) {
        // 计算到这一行为止的括号深度
        const codeUpToErr = lines.slice(0, errLine - 1).join('\n');
        const brackets = countBrackets(codeUpToErr);

        if (brackets.paren > 0) {
          // 额外验证：检查错误行是否确实以语句开头（const/let/var/function/return/if/for 等）
          // 如果错误行是表达式的一部分（如多行函数参数），不应该在这里插入 )
          const errLineContent = lines[errLine - 1]?.trim() || '';
          const isStatementStart = /^(?:const|let|var|function|class|return|if|else|for|while|switch|case|break|continue|throw|try|catch|finally|export|import|async|await|yield)\b/.test(errLineContent)
            || /^[A-Z]/.test(errLineContent)  // React 组件调用
            || /^[}\])]/.test(errLineContent); // 闭括号开头

          if (isStatementStart || brackets.paren >= 2) {
            // 在错误行之前补全圆括号
            const closers = ')'.repeat(brackets.paren);
            lines.splice(errLine - 1, 0, closers);
            fixed = lines.join('\n');
            console.info(`[esbuild] ✅ 激进修复：在第 ${errLine} 行前插入 ${brackets.paren} 个 )`);

            // 修复后重新检查全局括号平衡，移除末尾多余的闭括号
            // （autoFixBrackets 可能已经在末尾补了 )，导致现在多余）
            fixed = removeTrailingExcessClosers(fixed);
          }
        }
      }
    }
  }

  // 策略 3：Expected "{" but found "X" — 缺少花括号（常见于截断后拼接错误）
  // 例如：箭头函数 => k... 应该是 => { k... }
  //       if (x) k() 应该是 if (x) { k() }
  //       catch k 应该是 catch (k) { ... }
  if (errorMsg.includes('Expected "{"')) {
    if (errLine > 0 && errLine <= lines.length) {
      const targetLineIdx = errLine - 1;
      const targetLine = lines[targetLineIdx];

      if (targetLine) {
        // 在错误列位置插入 { 并在代码末尾补全 }
        // 注意：errCol 可能为 0（行首），此时 errCol - 1 = -1，需要特殊处理
        const safeCol = Math.max(errCol, 1);
        const beforeErr = targetLine.slice(0, safeCol - 1);
        const afterErr = targetLine.slice(safeCol - 1);

        // 检查错误行前面的上下文，判断是哪种缺失场景
        const prevLineContent = targetLineIdx > 0 ? lines[targetLineIdx - 1].trim() : '';
        const trimmedBefore = beforeErr.trim();

        // 场景 A：箭头函数缺少花括号 => X → => { X
        // 也检查上一行末尾是否是 =>（跨行箭头函数）
        if (/=>\s*$/.test(beforeErr) || (targetLineIdx > 0 && /=>\s*$/.test(lines[targetLineIdx - 1]?.trimEnd() || ''))) {
          lines[targetLineIdx] = beforeErr + '{ ' + afterErr;
          // 在代码末尾补全 }
          const codeAfterFix = lines.join('\n');
          const afterBrackets = countBrackets(codeAfterFix);
          if (afterBrackets.brace > 0) {
            const closers = '}'.repeat(afterBrackets.brace);
            lines.push(closers);
          }
          fixed = lines.join('\n');
          console.info(`[esbuild] ✅ 激进修复：在第 ${errLine} 行箭头函数后插入 {`);
        }
        // 场景 B：if/else/for/while/catch/class/try 后缺少花括号
        else if (/(?:if\s*\([^)]*\)|else|for\s*\([^)]*\)|while\s*\([^)]*\)|catch\s*\([^)]*\)|try|class\s+\w+(?:\s+extends\s+\w+)?)\s*$/.test(beforeErr) ||
                 /(?:if\s*\([^)]*\)|else|for\s*\([^)]*\)|while\s*\([^)]*\)|catch\s*\([^)]*\)|try|class\s+\w+(?:\s+extends\s+\w+)?)\s*$/.test(prevLineContent)) {
          lines[targetLineIdx] = beforeErr + '{ ' + afterErr;
          const codeAfterFix = lines.join('\n');
          const afterBrackets = countBrackets(codeAfterFix);
          if (afterBrackets.brace > 0) {
            lines.push('}'.repeat(afterBrackets.brace));
          }
          fixed = lines.join('\n');
          console.info(`[esbuild] ✅ 激进修复：在第 ${errLine} 行控制语句后插入 {`);
        }
        // 场景 C：通用修复 — 在错误位置插入 { 并尝试补全
        else {
          lines[targetLineIdx] = beforeErr + '{ ' + afterErr;
          const codeAfterFix = lines.join('\n');
          const afterBrackets = countBrackets(codeAfterFix);
          if (afterBrackets.brace > 0) {
            lines.push('}'.repeat(afterBrackets.brace));
          }
          fixed = lines.join('\n');
          console.info(`[esbuild] ✅ 激进修复：在第 ${errLine} 行第 ${errCol} 列插入 {`);
        }
      }
    }
  }

  // 策略 4：通用 Expected "X" 错误 — 尝试在错误位置截断并补全括号
  if (fixed === code && /Expected "[^"]+" but found/.test(errorMsg)) {
    if (errLine > 0 && errLine <= lines.length) {
      // 截断到错误行之前，然后补全所有未闭合的括号
      const truncatedLines = lines.slice(0, errLine - 1);
      const truncatedCode = truncatedLines.join('\n');
      const brackets = countBrackets(truncatedCode);

      const closers: string[] = [];
      // 按照栈的逆序补全
      const openStack: string[] = [];
      let inStr = false, strCh = '';
      for (let i = 0; i < truncatedCode.length; i++) {
        const ch = truncatedCode[i];
        if (inStr) { if (ch === strCh && truncatedCode[i - 1] !== '\\') inStr = false; continue; }
        if (ch === "'" || ch === '"' || ch === '`') { inStr = true; strCh = ch; continue; }
        if (ch === '(' || ch === '{' || ch === '[') openStack.push(ch);
        else if (ch === ')' || ch === '}' || ch === ']') openStack.pop();
      }
      for (let i = openStack.length - 1; i >= 0; i--) {
        if (openStack[i] === '(') closers.push(')');
        else if (openStack[i] === '{') closers.push('}');
        else if (openStack[i] === '[') closers.push(']');
      }

      if (closers.length > 0) {
        fixed = truncatedCode + '\n' + closers.join('') + ';';
        console.info(`[esbuild] ✅ 激进修复（通用截断）：截断到第 ${errLine - 1} 行，补全 ${closers.join('')}`);
      }
    }
  }

  return fixed;
};

// ─── 核心编译函数 ────────────────────────────────────────────────────────────

/**
 * 将 AI 生成的 JSX/TSX 代码编译为可在 iframe 中执行的 JS
 *
 * 流程：预处理 → esbuild.transform() → 后处理
 *
 * @param jsxCode - AI 生成的原始 JSX/TSX 代码
 * @returns 编译结果（code 或 error）
 */
export const compileJsx = async (jsxCode: string): Promise<CompileResult> => {
  try {
    // 1. 确保 esbuild WASM 已初始化
    await ensureInitialized();

    // 2. 预处理：移除 import / 渲染入口
    const preprocessed = preprocess(jsxCode);

    if (!preprocessed.trim()) {
      return { code: null, error: '代码为空（预处理后无有效内容）' };
    }

    // 调试：输出预处理后的代码前几行，方便排查编译错误
    const preprocessedLines = preprocessed.split('\n');
    console.info('[esbuild] 预处理后代码行数:', preprocessedLines.length, '字符数:', preprocessed.length);
    console.info('[esbuild] 预处理后前 10 行:\n', preprocessedLines.slice(0, 10).join('\n'));

    // 括号平衡检查 + 自动修复（处理 AI 生成代码被截断的情况）
    const codeToCompile = autoFixBrackets(preprocessed);

    // 3. esbuild 编译：完整支持 TypeScript + JSX（含自动修复重试）
    let result: esbuild.TransformResult;
    try {
      result = await esbuild.transform(codeToCompile, {
        loader: 'tsx',
        jsx: 'transform',
        jsxFactory: 'React.createElement',
        jsxFragment: 'React.Fragment',
        target: 'es2020',
      });
    } catch (firstErr) {
      // 第一次编译失败，尝试更激进的修复后重试
      const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      console.warn('[esbuild] 首次编译失败，尝试激进修复后重试:', firstMsg);

      const aggressiveFixed = aggressiveAutoFix(codeToCompile, firstMsg);
      if (aggressiveFixed !== codeToCompile) {
        try {
          result = await esbuild.transform(aggressiveFixed, {
            loader: 'tsx',
            jsx: 'transform',
            jsxFactory: 'React.createElement',
            jsxFragment: 'React.Fragment',
            target: 'es2020',
          });
          console.info('[esbuild] ✅ 激进修复后编译成功');
        } catch (retryErr) {
          // 第二次也失败了，尝试用原始预处理代码（跳过 autoFixBrackets）重新修复
          // 因为 autoFixBrackets 可能在末尾补了闭括号，干扰了 aggressiveAutoFix 的修复
          const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          console.warn('[esbuild] 激进修复后仍失败，尝试用原始代码重新修复:', retryMsg);

          const rawFixed = aggressiveAutoFix(preprocessed, firstMsg);
          if (rawFixed !== preprocessed && rawFixed !== aggressiveFixed) {
            try {
              result = await esbuild.transform(rawFixed, {
                loader: 'tsx',
                jsx: 'transform',
                jsxFactory: 'React.createElement',
                jsxFragment: 'React.Fragment',
                target: 'es2020',
              });
              console.info('[esbuild] ✅ 原始代码激进修复后编译成功');
            } catch {
              // 第三次也失败了，尝试用第二次错误信息再修复一次
              const thirdFixed = aggressiveAutoFix(rawFixed, retryMsg);
              if (thirdFixed !== rawFixed) {
                try {
                  result = await esbuild.transform(thirdFixed, {
                    loader: 'tsx',
                    jsx: 'transform',
                    jsxFactory: 'React.createElement',
                    jsxFragment: 'React.Fragment',
                    target: 'es2020',
                  });
                  console.info('[esbuild] ✅ 多轮修复后编译成功');
                } catch {
                  throw firstErr;
                }
              } else {
                throw firstErr;
              }
            }
          } else {
            throw firstErr;
          }
        }
      } else {
        throw firstErr;
      }
    }

    // 4. 后处理：export default → __VibeApp__
    const finalCode = postprocess(result.code);

    // 5. 编译后语法验证
    try {
      new Function(finalCode);
    } catch (syntaxErr) {
      console.warn('[esbuild] 编译后代码有语法错误:', syntaxErr);
      // esbuild 编译后一般不会有语法错误，但以防万一
      return { code: finalCode, error: null }; // 仍然返回，让 iframe 错误处理兜底
    }

    return { code: finalCode, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[esbuild] 编译失败:', message);

    // 尝试从错误信息中提取行号，输出对应的代码行帮助排查
    const lineMatch = message.match(/<stdin>:(\d+):(\d+)/);
    if (lineMatch) {
      const errLine = parseInt(lineMatch[1], 10);
      const errCol = parseInt(lineMatch[2], 10);
      const lines = preprocess(jsxCode).split('\n');
      const start = Math.max(0, errLine - 3);
      const end = Math.min(lines.length, errLine + 2);
      console.error(`[esbuild] 错误位置: 第 ${errLine} 行, 第 ${errCol} 列`);
      console.error('[esbuild] 上下文代码:');
      for (let i = start; i < end; i++) {
        const marker = i === errLine - 1 ? ' >>> ' : '     ';
        console.error(`${marker}${i + 1}: ${lines[i]?.slice(0, 300)}`);
      }
    }

    return { code: null, error: message };
  }
};

// ─── 同步编译（兼容旧接口，内部使用 Babel 作为降级方案）────────────────────

/**
 * 同步版本的 compileJsx（用于不方便使用 async 的场景）
 *
 * 优先使用异步版本 compileJsx()，此函数仅作为降级兼容。
 * 内部使用简化的正则处理 + Babel standalone 作为后备。
 */
export const compileJsxSync = (jsxCode: string): { code: string; error: null } | { code: null; error: string } => {
  try {
    // 动态导入 Babel（如果可用）
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Babel = (window as any).Babel || null;

    // 预处理
    let cleaned = preprocess(jsxCode);

    // 移除 TypeScript 独立类型声明（Babel 需要，esbuild 不需要）
    cleaned = cleaned
      .replace(/^\s*(?:export\s+)?interface\s+\w+[\s\S]*?^\s*\}\s*;?\s*$/gm, '')
      .replace(/^\s*(?:export\s+)?type\s+\w+\s*=\s*[^;]+;\s*$/gm, '')
      .replace(/^\s*(?:export\s+)?type\s+\w+\s*=\s*\{[\s\S]*?^\s*\}\s*;?\s*$/gm, '')
      .replace(/^\s*(?:export\s+)?enum\s+\w+\s*\{[\s\S]*?^\s*\}\s*;?\s*$/gm, '');

    // 移除残留 TypeScript 语法
    cleaned = cleaned
      .replace(/^\s*declare\s+(?:const|var|let|function|class|module|namespace|global)\s+[\s\S]*?(?:;|\})\s*$/gm, '')
      .replace(/\babstract\s+class\b/g, 'class')
      .replace(/\bas\s+[A-Z][A-Za-z0-9_<>\[\]|&]*(?:\s*[,;)\]}>])/g, (match) => match.slice(match.search(/[,;)\]}>]/)))
      .replace(/\bas\s+[A-Z][A-Za-z0-9_<>\[\]|&]*\s*$/gm, '')
      .replace(/!\./g, '.')
      .replace(/!;/g, ';')
      .replace(/(useState|useRef|useCallback|useMemo|useReducer|createContext|React\.createContext)\s*<[^>]+>/g, '$1')
      .replace(/function\s+(\w+)\s*<[^>]+>/g, 'function $1')
      .replace(/=\s*<([A-Z][A-Za-z0-9_]*),>\s*\(/g, '= (');

    // 后处理 export
    cleaned = postprocess(cleaned);

    if (Babel) {
      const result = Babel.transform(cleaned, {
        presets: ['react', 'typescript'],
        filename: 'vibe-preview.tsx',
      });
      return { code: result.code ?? '', error: null };
    }

    // 没有 Babel 也没有 esbuild，返回预处理后的代码（可能无法运行）
    console.warn('[compileJsxSync] Babel 不可用，返回预处理后的代码');
    return { code: cleaned, error: null };
  } catch (err) {
    return { code: null, error: err instanceof Error ? err.message : String(err) };
  }
};
