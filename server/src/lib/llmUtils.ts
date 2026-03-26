/**
 * @file lib/llmUtils.ts
 * @description LLM 工具函数 — 记忆压缩 / 记忆窗口构建 / 截断检测 / 流式续写
 *
 * 被以下路由文件共享引用：
 *   - routes/chat.ts
 *   - routes/vibe.ts
 *   - routes/vibePipeline.ts
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
 * 策略 2 — 末尾不完整 JSON / 代码特征检查
 * 策略 3 — 文本长度接近 token 上限
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

  if (text.includes('```')) {
    let braceDepth = 0;
    for (const ch of text) {
      if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth--;
    }
    if (braceDepth > 2) return true;
  }

  // ── 策略 2：末尾不完整特征检查 ────────────────────────────────────────────

  if (/[,:]$/.test(trimmed)) return true;

  const lastLine = trimmed.split('\n').pop() || '';
  const singleQuoteCount = (lastLine.match(/(?<!\\)'/g) || []).length;
  const doubleQuoteCount = (lastLine.match(/(?<!\\)"/g) || []).length;
  if (singleQuoteCount % 2 !== 0 || doubleQuoteCount % 2 !== 0) return true;

  if (/\\$/.test(trimmed)) return true;
  if (/<[^>]*$/.test(trimmed)) return true;

  if (/^\s*("|')?[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(lastLine)) return true;

  // ── 策略 3：文本长度接近 token 上限 ──────────────────────────────────────

  const TOKEN_LENGTH_THRESHOLD = 30_000;
  if (text.length >= TOKEN_LENGTH_THRESHOLD && finishReason !== 'stop') return true;

  return false;
};

// =============================================================================
// 流式续写
// =============================================================================

export const MAX_CONTINUATIONS = 5;

/**
 * 流式请求并自动续写
 * 触发续写的条件（满足任一即续写）：
 *   1. finish_reason === 'length'（模型明确报告 token 超出）
 *   2. isLikelyTruncated() 检测到截断特征
 * 最多续写 MAX_CONTINUATIONS 次
 */
export async function* streamWithContinuation(
  messages: any[],
  options: { provider: string; modelType: string }
): AsyncGenerator<{ delta: string; done: boolean }> {
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

    if (continuationCount >= MAX_CONTINUATIONS) break;

    const needContinuation =
      finishReason === 'length' ||
      isLikelyTruncated(accumulatedContent, finishReason);

    if (!needContinuation) break;

    continuationCount++;
    yield { delta: '', done: false };

    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: chunkContent },
      { role: 'user', content: '请继续输出，从上次的内容结尾处直接接着写，不要重复已有内容。' },
    ];
  }

  yield { delta: '', done: true };
}
