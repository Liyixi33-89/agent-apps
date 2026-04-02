/**
 * @file lib/llmUtils.ts
 * @description LLM 工具函数 — 记忆压缩 / 记忆窗口构建 / 截断检测 / 流式续写
 *
 * 被以下路由文件共享引用：
 *   - routes/chat.ts
 *   - routes/vibe.ts
 *   - routes/vibePipeline.ts
 *   - routes/vibeFullStackPipeline.ts
 */

import { streamLLM } from '../services/llmService.js';

// =============================================================================
// 记忆压缩
// =============================================================================

/**
 * 对 assistant 消息中的 HTML 代码块进行摘要压缩
 * 保留文字说明，将完整 HTML 替换为简短摘要，避免占用大量上下文 token
 */
export const compressAssistantMessage = (content: string): string => {
  const textPart = content.replace(/```[\s\S]*?```/g, '').trim();
  const summary = textPart.slice(0, 200);

  const htmlMatch = content.match(/```html\n([\s\S]*?)```/i)
    || content.match(/```html\n([\s\S]+)$/i);
  if (!htmlMatch) return content;

  const html = htmlMatch[1];
  const scriptCount = (html.match(/<script/gi) || []).length;
  const hasEcharts = html.includes('echarts');
  const hasTailwind = html.includes('tailwind');
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const title = titleMatch?.[1] || '未命名页面';
  const lineCount = html.split('\n').length;

  return `${summary}\n\n[HTML代码已压缩存储] 页面标题：${title}，共 ${lineCount} 行，${scriptCount} 个 script 标签${hasEcharts ? '，使用 ECharts' : ''}${hasTailwind ? '，使用 Tailwind CSS' : ''}。`;
};

// =============================================================================
// 记忆窗口构建
// =============================================================================

/**
 * 构建包含记忆压缩的消息列表，用于发送给 LLM
 * - 系统消息始终保留
 * - 最近 2 条 user/assistant 对保留原文（当前轮的上一轮）
 * - 更早的 assistant 消息进行压缩
 */
export const buildMemoryMessages = (rawMessages: any[]): any[] => {
  const systemMsgs = rawMessages.filter((m: any) => m.role === 'system');
  const nonSystemMsgs = rawMessages.filter((m: any) => m.role !== 'system');

  const recentCount = 4;
  const recentMsgs = nonSystemMsgs.slice(-recentCount);
  const olderMsgs = nonSystemMsgs.slice(0, -recentCount);

  const compressedOlder = olderMsgs.map((m: any) => {
    if (m.role === 'assistant') {
      return { ...m, content: compressAssistantMessage(m.content) };
    }
    return m;
  });

  return [...systemMsgs, ...compressedOlder, ...recentMsgs];
};

// =============================================================================
// 截断检测
// =============================================================================

/**
 * 检查代码中括号是否平衡（跳过字符串和注释内的括号）
 */
const checkBracketBalance = (code: string): { paren: number; brace: number; bracket: number; unbalanced: boolean } => {
  let paren = 0, brace = 0, bracket = 0;
  let inString: string | null = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const prev = i > 0 ? code[i - 1] : '';
    const next = i + 1 < code.length ? code[i + 1] : '';

    // 处理注释
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i++; }
      continue;
    }
    if (!inString) {
      if (ch === '/' && next === '/') { inLineComment = true; continue; }
      if (ch === '/' && next === '*') { inBlockComment = true; continue; }
    }

    // 处理字符串
    if (inString) {
      if (ch === inString && prev !== '\\') inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }

    // 计数括号
    if (ch === '(') paren++;
    else if (ch === ')') paren--;
    else if (ch === '{') brace++;
    else if (ch === '}') brace--;
    else if (ch === '[') bracket++;
    else if (ch === ']') bracket--;
  }

  return { paren, brace, bracket, unbalanced: paren !== 0 || brace !== 0 || bracket !== 0 };
};

/**
 * 检测 LLM 输出是否被 token 限制截断
 *
 * 策略 1 — 代码块 / 标签结构完整性检查
 * 策略 2 — 花括号 / 圆括号 / 方括号深度检查（代码未闭合）
 * 策略 3 — 末尾不完整 JSON / 代码特征检查
 * 策略 4 — 文本长度接近 token 上限
 */
export const isLikelyTruncated = (text: string, finishReason?: string): boolean => {
  const trimmed = text.trimEnd();
  if (!trimmed) return false;

  // ── 策略 1：代码块 / 标签结构完整性（即使 finishReason=stop 也检查）──────
  // 某些 Ollama 模型在截断时仍报告 stop，但代码块未闭合是铁证

  const codeBlockOpenCount = (text.match(/```/g) || []).length;
  if (codeBlockOpenCount % 2 !== 0) return true;

  const scriptOpenCount = (text.match(/<script[\s>]/gi) || []).length;
  const scriptCloseCount = (text.match(/<\/script>/gi) || []).length;
  if (scriptOpenCount > scriptCloseCount) return true;

  const styleOpenCount = (text.match(/<style[\s>]/gi) || []).length;
  const styleCloseCount = (text.match(/<\/style>/gi) || []).length;
  if (styleOpenCount > styleCloseCount) return true;

  // ── 策略 1.5：全栈 Pipeline 特有的截断模式检测 ────────────────────────
  // 某些模型在接近 token 限制时会"优雅地"关闭代码块并报告 stop
  // 但实际上代码内容不完整（如只生成了 1 个模块，缺少其他模块）
  // 检测方式：如果最后一个代码块在 export default 之后立即结束，
  // 但代码块内容很长（>5000字符），可能是截断后补了个 export default

  // 检查是否有未完成的多代码块输出（质检 Agent 需要输出 9 个代码块）
  // 如果文本中包含 ```typescript:models/ 等标记，说明是质检输出
  const isReviewerOutput = /```(?:typescript|ts):(?:models|routes|services|middleware)\//i.test(text);
  if (isReviewerOutput) {
    // 质检 Agent 应该输出至少 6 个代码块（models, routes, services, middleware, jsx, json）
    // 如果代码块数量不足，说明被截断了
    const closedBlockCount = (text.match(/```[\w.:/-]*\n[\s\S]*?```/g) || []).length;
    if (closedBlockCount < 4) {
      console.log(`[isLikelyTruncated] 质检输出代码块不足: ${closedBlockCount} < 4，判定为截断`);
      return true;
    }
  }

  // ── 策略 1.8：已闭合代码块内部的括号平衡检查（即使 finishReason=stop 也执行）──
  // AI 可能在截断时"优雅地"关闭代码块并报告 stop，但代码块内部括号不平衡
  // 这是比代码块未闭合更隐蔽的截断模式
  {
    let allClosedCode = '';
    let match: RegExpExecArray | null;
    // 注意：每次使用前重置 lastIndex，避免 gi 标志导致的状态残留
    const closedBlockRegex = /```(?:typescript|ts|javascript|js|jsx|tsx|json)[^\n]*\n([\s\S]*?)```/gi;
    closedBlockRegex.lastIndex = 0;
    while ((match = closedBlockRegex.exec(text)) !== null) {
      allClosedCode += match[1];
    }

    if (allClosedCode) {
      const bracketResult = checkBracketBalance(allClosedCode);
      if (bracketResult.unbalanced) {
        console.log(`[isLikelyTruncated] 已闭合代码块内括号不平衡: () = ${bracketResult.paren}, {} = ${bracketResult.brace}, [] = ${bracketResult.bracket}，判定为截断`);
        return true;
      }

      // 检查 JSX 代码块是否缺少 export default（AI 截断后可能没来得及写）
      const jsxBlockMatch = text.match(/```(?:jsx|tsx)[^\n]*\n([\s\S]*?)```/i);
      if (jsxBlockMatch) {
        const jsxCode = jsxBlockMatch[1];
        const hasExportDefault = /export\s+default/.test(jsxCode);
        const hasComponentDef = /(?:const|function)\s+[A-Z]\w*\s*(?:=|\()/.test(jsxCode);
        if (hasComponentDef && !hasExportDefault && jsxCode.length > 500) {
          console.log('[isLikelyTruncated] JSX 代码块有组件定义但缺少 export default，判定为截断');
          return true;
        }

        // 检查 JSX 代码块末尾是否突然结束（检查最后 3 行，而非仅最后 1 行）
        const jsxLines = jsxCode.trim().split('\n');
        // 检查最后 3 行中是否有截断特征
        const tailLinesToCheck = jsxLines.slice(-3);
        for (const tailLine of tailLinesToCheck) {
          const trimmedTail = tailLine?.trim() || '';
          if (!trimmedTail) continue;

          // 如果某行是不完整的语句（如以 , . + - && || 等结尾），说明被截断
          if (/[,+\-&|=<>?:]$/.test(trimmedTail) && trimmedTail.length > 2) {
            console.log(`[isLikelyTruncated] JSX 代码块末尾不完整: "${trimmedTail.slice(-30)}"，判定为截断`);
            return true;
          }

          // 如果某行是函数/变量声明的开头但没有函数体
          if (/(?:const|let|var|function)\s+\w+\s*(?:=\s*)?$/.test(trimmedTail)) {
            console.log(`[isLikelyTruncated] JSX 代码块末尾是未完成的声明: "${trimmedTail}"，判定为截断`);
            return true;
          }

          // 如果某行是箭头函数的箭头但没有函数体
          if (/=>\s*$/.test(trimmedTail)) {
            console.log(`[isLikelyTruncated] JSX 代码块末尾是未完成的箭头函数: "${trimmedTail}"，判定为截断`);
            return true;
          }

          // 如果某行以 { 或 ( 结尾但后面没有更多内容（最后一行的情况）
          if (tailLine === tailLinesToCheck[tailLinesToCheck.length - 1] && /[{(]\s*$/.test(trimmedTail)) {
            console.log(`[isLikelyTruncated] JSX 代码块最后一行以开括号结尾: "${trimmedTail.slice(-30)}"，判定为截断`);
            return true;
          }
        }
      }
    }
  }

  // 如果 finishReason 明确为 stop 且代码块完整且括号平衡，信任模型的判断
  if (finishReason === 'stop') return false;

  // ── 策略 2：花括号 / 圆括号 / 方括号深度检查 ────────────────────────────
  // 检查所有代码块（已闭合 + 未闭合）的括号平衡

  const lastOpenBlock = text.match(/```(?:typescript|ts|javascript|js|jsx|tsx|json)[^\n]*\n([\s\S]+)$/i);
  const codeToCheck = lastOpenBlock ? lastOpenBlock[1] : '';

  if (codeToCheck || text.includes('```')) {
    let allCode = '';
    let match: RegExpExecArray | null;
    const closedBlockRegex2 = /```(?:typescript|ts|javascript|js|jsx|tsx|json)[^\n]*\n([\s\S]*?)```/gi;
    closedBlockRegex2.lastIndex = 0;
    while ((match = closedBlockRegex2.exec(text)) !== null) {
      allCode += match[1];
    }
    allCode += codeToCheck;

    if (allCode) {
      const bracketResult = checkBracketBalance(allCode);
      // 任何括号不平衡都判定为截断（阈值 > 0，而非之前的 > 1）
      if (bracketResult.unbalanced) {
        console.log(`[isLikelyTruncated] 代码块括号不平衡: () = ${bracketResult.paren}, {} = ${bracketResult.brace}, [] = ${bracketResult.bracket}，判定为截断`);
        return true;
      }
    }
  }

  // ── 策略 3：末尾不完整特征检查 ────────────────────────────────────────────

  // 末尾是逗号或冒号（JSON/对象字面量未完成）
  if (/[,:]$/.test(trimmed)) return true;

  const lastLine = trimmed.split('\n').pop() || '';
  // 引号未闭合
  const singleQuoteCount = (lastLine.match(/(?<!\\)'/g) || []).length;
  const doubleQuoteCount = (lastLine.match(/(?<!\\)"/g) || []).length;
  if (singleQuoteCount % 2 !== 0 || doubleQuoteCount % 2 !== 0) return true;

  // 行尾反斜杠（续行符）
  if (/\\$/.test(trimmed)) return true;
  // 未闭合的 HTML 标签
  if (/<[a-zA-Z][^>]*$/.test(trimmed)) return true;

  // 末尾是 export / const / function / class / interface / return 等关键字（声明未完成）
  if (/\b(export|const|let|var|function|class|interface|type|return|import|from|async|await)\s*$/.test(lastLine)) return true;

  // 末尾是箭头函数的箭头
  if (/=>\s*$/.test(lastLine)) return true;

  // ── 策略 4：文本长度接近 token 上限 ──────────────────────────────────────

  const TOKEN_LENGTH_THRESHOLD = 30_000;
  if (text.length >= TOKEN_LENGTH_THRESHOLD && finishReason !== 'stop') return true;

  return false;
};

// =============================================================================
// 流式续写
// =============================================================================

export const MAX_CONTINUATIONS = 5;

/** 分析已生成内容的结构，帮助续写时提供上下文 */
const analyzeGeneratedStructure = (text: string): string => {
  const hints: string[] = [];

  // 检测代码块类型和数量
  const codeBlocks = text.match(/```[\w.:/-]*\n/g) || [];
  if (codeBlocks.length > 0) {
    hints.push(`已生成 ${codeBlocks.length} 个代码块: ${codeBlocks.map(b => b.replace('```', '').trim()).filter(Boolean).join(', ')}`);
  }

  // 检测 JSX 中已定义的组件
  const componentDefs = text.match(/const\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g) || [];
  const componentNames = componentDefs.map(d => d.match(/const\s+(\w+)/)?.[1]).filter(Boolean);
  if (componentNames.length > 0) {
    hints.push(`已定义的组件: ${componentNames.join(', ')}`);
  }

  // 检测是否有 export default
  if (text.includes('export default')) {
    hints.push('已有 export default 语句');
  } else {
    hints.push('⚠️ 缺少 export default 语句');
  }

  // 检测 API 路径（了解已覆盖的模块）
  const apiPaths = text.match(/['"]\/api\/(\w+)['"]/g) || [];
  const uniqueApis = [...new Set(apiPaths.map(p => p.match(/\/api\/(\w+)/)?.[1]).filter(Boolean))];
  if (uniqueApis.length > 0) {
    hints.push(`已覆盖的 API 模块: ${uniqueApis.join(', ')}`);
  }

  // 检测质检输出中的文件标签
  const fileTags = text.match(/```[\w]+:[\w/.]+/g) || [];
  if (fileTags.length > 0) {
    const tags = fileTags.map(t => t.replace(/```\w+:/, ''));
    hints.push(`已输出的文件: ${tags.join(', ')}`);
  }

  return hints.length > 0 ? hints.join('\n') : '';
};

/** 截取文本末尾 N 个字符，用于续写时提供上下文锚点 */
const getTailContext = (text: string, maxChars = 800): string => {
  if (text.length <= maxChars) return text;
  const tail = text.slice(-maxChars);
  // 尝试从完整行开始
  const firstNewline = tail.indexOf('\n');
  return firstNewline > 0 && firstNewline < maxChars * 0.3
    ? tail.slice(firstNewline + 1)
    : tail;
};

/**
 * 流式请求并自动续写
 * 触发续写的条件（满足任一即续写）：
 *   1. finish_reason === 'length'（模型明确报告 token 超出）
 *   2. isLikelyTruncated() 检测到截断特征
 * 最多续写 MAX_CONTINUATIONS 次
 *
 * 续写优化：
 *   - 续写时只携带原始 system + user 消息 + 末尾上下文锚点（而非完整历史）
 *   - 避免上下文爆炸式膨胀导致 Ollama 本地模型卡死
 */
export async function* streamWithContinuation(
  messages: any[],
  options: { provider: string; modelType: string }
): AsyncGenerator<{ delta: string; done: boolean; continuationIndex?: number }> {
  const originalMessages = [...messages]; // 保留原始消息用于续写
  let currentMessages = [...messages];
  let accumulatedContent = '';
  let continuationCount = 0;

  while (true) {
    let chunkContent = '';
    let finishReason: string | undefined;

    const stream = streamLLM(currentMessages, {
      provider: options.provider as 'ollama' | 'codebuddy',
      modelType: options.modelType as 'text' | 'vision',
    });

    for await (const chunk of stream) {
      if (chunk.delta) {
        chunkContent += chunk.delta;
        accumulatedContent += chunk.delta;
        yield { delta: chunk.delta, done: false };
      }
      if (chunk.done) {
        finishReason = chunk.finishReason;
        break;
      }
    }

    // 如果本轮没有任何输出（模型完全卡住），直接结束
    if (!chunkContent.trim()) {
      console.warn('[streamWithContinuation] 本轮无输出，结束续写');
      break;
    }

    if (continuationCount >= MAX_CONTINUATIONS) {
      console.log(`[streamWithContinuation] 已达最大续写次数 ${MAX_CONTINUATIONS}，结束`);
      break;
    }

    const needContinuation =
      finishReason === 'length' ||
      isLikelyTruncated(accumulatedContent, finishReason);

    console.log(`[streamWithContinuation] 本轮结束: finishReason=${finishReason ?? 'undefined'}, 累计${accumulatedContent.length}字符, needContinuation=${needContinuation}`);

    if (!needContinuation) break;

    continuationCount++;
    console.log(`[streamWithContinuation] 检测到截断，开始第 ${continuationCount} 次续写（finishReason=${finishReason}）`);
    yield { delta: '', done: false, continuationIndex: continuationCount };

    // 续写策略：保留原始 system + user 消息 + 末尾上下文锚点 + 结构分析
    // 避免把完整的已生成内容追加到 messages 中导致上下文膨胀
    const tailContext = getTailContext(accumulatedContent);

    // 分析已生成内容的结构，帮助模型知道还需要生成什么
    const structureHints = analyzeGeneratedStructure(accumulatedContent);

    currentMessages = [
      ...originalMessages,
      {
        role: 'assistant' as const,
        content: `（前文已生成 ${accumulatedContent.length} 字符，以下是末尾部分）\n${tailContext}`,
      },
      {
        role: 'user' as const,
        content: `你的输出被截断了，请从上面末尾部分的最后一行直接接着写，不要重复已有内容，不要添加任何解释。${structureHints ? `\n\n【已生成内容分析】\n${structureHints}\n请继续生成缺失的部分。` : ''}`,
      },
    ];
  }

  yield { delta: '', done: true };
}
