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
 * 检测 LLM 输出是否被 token 限制截断
 *
 * 策略 1 — 代码块 / 标签结构完整性检查
 * 策略 2 — 花括号 / 圆括号 / 方括号深度检查（代码未闭合）
 * 策略 3 — 末尾不完整 JSON / 代码特征检查
 * 策略 4 — 文本长度接近 token 上限
 */
export const isLikelyTruncated = (text: string, finishReason?: string): boolean => {
  if (finishReason === 'stop') return false;

  const trimmed = text.trimEnd();
  if (!trimmed) return false;

  // ── 策略 1：代码块 / 标签结构完整性 ──────────────────────────────────────

  const codeBlockOpenCount = (text.match(/```/g) || []).length;
  if (codeBlockOpenCount % 2 !== 0) return true;

  const scriptOpenCount = (text.match(/<script[\s>]/gi) || []).length;
  const scriptCloseCount = (text.match(/<\/script>/gi) || []).length;
  if (scriptOpenCount > scriptCloseCount) return true;

  const styleOpenCount = (text.match(/<style[\s>]/gi) || []).length;
  const styleCloseCount = (text.match(/<\/style>/gi) || []).length;
  if (styleOpenCount > styleCloseCount) return true;

  // ── 策略 2：花括号 / 圆括号 / 方括号深度检查 ────────────────────────────
  // 只在代码块内部检测，避免自然语言中的符号干扰

  const codeBlockRegex = /```[\s\S]*?```/g;
  const lastOpenBlock = text.match(/```(?:typescript|ts|javascript|js|jsx|tsx|json)[^\n]*\n([\s\S]+)$/i);
  const codeToCheck = lastOpenBlock ? lastOpenBlock[1] : '';

  if (codeToCheck || text.includes('```')) {
    // 检查所有已闭合代码块 + 最后一个未闭合代码块
    let allCode = '';
    let match: RegExpExecArray | null;
    const closedBlockRegex = /```(?:typescript|ts|javascript|js|jsx|tsx|json)[^\n]*\n([\s\S]*?)```/gi;
    while ((match = closedBlockRegex.exec(text)) !== null) {
      allCode += match[1];
    }
    allCode += codeToCheck;

    if (allCode) {
      let braceDepth = 0;
      let parenDepth = 0;
      let bracketDepth = 0;
      // 排除字符串内的括号（简化处理：跳过引号内内容）
      let inString: string | null = null;
      for (let i = 0; i < allCode.length; i++) {
        const ch = allCode[i];
        const prev = i > 0 ? allCode[i - 1] : '';
        if (inString) {
          if (ch === inString && prev !== '\\') inString = null;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth--;
        else if (ch === '(') parenDepth++;
        else if (ch === ')') parenDepth--;
        else if (ch === '[') bracketDepth++;
        else if (ch === ']') bracketDepth--;
      }
      // 花括号深度 > 1 说明有函数/类/对象未闭合
      if (braceDepth > 1) return true;
      // 圆括号/方括号未闭合
      if (parenDepth > 1) return true;
      if (bracketDepth > 1) return true;
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

    if (!needContinuation) break;

    continuationCount++;
    console.log(`[streamWithContinuation] 检测到截断，开始第 ${continuationCount} 次续写（finishReason=${finishReason}）`);
    yield { delta: '', done: false, continuationIndex: continuationCount };

    // 续写策略：只保留原始 system + user 消息 + 末尾上下文锚点
    // 避免把完整的已生成内容追加到 messages 中导致上下文膨胀
    const tailContext = getTailContext(accumulatedContent);
    currentMessages = [
      ...originalMessages,
      {
        role: 'assistant' as const,
        content: `（前文已生成 ${accumulatedContent.length} 字符，以下是末尾部分）\n${tailContext}`,
      },
      {
        role: 'user' as const,
        content: '你的输出被截断了，请从上面末尾部分的最后一行直接接着写，不要重复已有内容，不要添加任何解释。',
      },
    ];
  }

  yield { delta: '', done: true };
}
