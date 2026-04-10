/**
 * @file services/providerRegistry.ts
 * @description 多 Provider 注册表 — 统一管理 Claude / Gemini / DeepSeek 等 LLM Provider
 *
 * 扩展维度：
 *   - 多 Provider 支持（Claude、Gemini、DeepSeek）
 *   - 模型路由策略（manual / auto / fallback）
 *   - Fallback 降级链
 *   - Token 用量追踪
 */

import axios, { AxiosError } from 'axios';
import { env, type LLMProvider } from '../config/env.js';
import type { LLMMessage, LLMResponse, LLMStreamChunk } from './llmService.js';

// =============================================================================
// Provider 配置映射
// =============================================================================

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  textModel: string;
  visionModel: string;
  /** 是否使用 OpenAI 兼容 API 格式 */
  openaiCompatible: boolean;
}

/** 获取指定 Provider 的配置 */
export const getProviderConfig = (provider: LLMProvider): ProviderConfig => {
  switch (provider) {
    case 'ollama':
      return {
        baseUrl: env.ollamaBaseUrl,
        apiKey: '',
        textModel: env.ollamaTextModel,
        visionModel: env.ollamaVisionModel,
        openaiCompatible: false,
      };
    case 'openai':
      return {
        baseUrl: env.openaiBaseUrl,
        apiKey: env.openaiApiKey,
        textModel: env.openaiTextModel,
        visionModel: env.openaiVisionModel,
        openaiCompatible: true,
      };
    case 'claude':
      return {
        baseUrl: env.claudeBaseUrl,
        apiKey: env.claudeApiKey,
        textModel: env.claudeTextModel,
        visionModel: env.claudeVisionModel,
        openaiCompatible: false,
      };
    case 'gemini':
      return {
        baseUrl: env.geminiBaseUrl,
        apiKey: env.geminiApiKey,
        textModel: env.geminiTextModel,
        visionModel: env.geminiVisionModel,
        openaiCompatible: false,
      };
    case 'deepseek':
      return {
        baseUrl: env.deepseekBaseUrl,
        apiKey: env.deepseekApiKey,
        textModel: env.deepseekTextModel,
        visionModel: env.deepseekVisionModel,
        openaiCompatible: true, // DeepSeek 使用 OpenAI 兼容 API
      };
    default:
      throw new Error(`不支持的 Provider: ${provider}`);
  }
};

// =============================================================================
// 429 重试工具
// =============================================================================

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const RATE_LIMIT_CONFIG = {
  maxRetries: 5,
  baseDelayMs: 5_000,
  maxDelayMs: 60_000,
  backoffMultiplier: 2,
};

const getRetryDelay = (attempt: number, retryAfterSeconds?: number): number => {
  if (retryAfterSeconds !== undefined) {
    return Math.min((retryAfterSeconds + 1) * 1000, RATE_LIMIT_CONFIG.maxDelayMs);
  }
  const exponentialDelay = RATE_LIMIT_CONFIG.baseDelayMs * Math.pow(RATE_LIMIT_CONFIG.backoffMultiplier, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, RATE_LIMIT_CONFIG.maxDelayMs);
};

const isRateLimitError = (error: unknown): error is AxiosError => {
  return axios.isAxiosError(error) && error.response?.status === 429;
};

const parseRetryAfter = (error: AxiosError): number | undefined => {
  const retryAfter = error.response?.headers?.['retry-after'];
  if (!retryAfter) return undefined;
  const seconds = Number(retryAfter);
  return isNaN(seconds) ? undefined : seconds;
};

// =============================================================================
// Claude (Anthropic) 调用
// =============================================================================

/** 将 OpenAI 格式消息转换为 Claude 格式 */
const convertToClaude = (messages: LLMMessage[]) => {
  let systemPrompt = '';
  const claudeMessages: Array<{ role: string; content: string }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt += (typeof msg.content === 'string' ? msg.content : '') + '\n';
    } else {
      claudeMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      });
    }
  }

  return { system: systemPrompt.trim(), messages: claudeMessages };
};

export const callClaude = async (
  messages: LLMMessage[],
  modelType: 'text' | 'vision' = 'text'
): Promise<LLMResponse> => {
  const config = getProviderConfig('claude');
  const model = modelType === 'vision' ? config.visionModel : config.textModel;
  const { system, messages: claudeMessages } = convertToClaude(messages);

  for (let attempt = 0; attempt <= RATE_LIMIT_CONFIG.maxRetries; attempt++) {
    try {
      const response = await axios.post(
        `${config.baseUrl}/v1/messages`,
        {
          model,
          max_tokens: 8192,
          system: system || undefined,
          messages: claudeMessages,
        },
        {
          headers: {
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          timeout: 120_000,
        }
      );

      const content = response.data?.content?.[0]?.text || '';
      const usage = response.data?.usage
        ? {
            promptTokens: response.data.usage.input_tokens || 0,
            completionTokens: response.data.usage.output_tokens || 0,
          }
        : undefined;

      return { content, provider: 'claude', model, usage };
    } catch (error: unknown) {
      if (isRateLimitError(error) && attempt < RATE_LIMIT_CONFIG.maxRetries) {
        const retryAfter = parseRetryAfter(error);
        const delay = getRetryDelay(attempt, retryAfter);
        console.warn(`[callClaude] 429 限流，第 ${attempt + 1} 次重试，等待 ${(delay / 1000).toFixed(1)}s...`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error('[callClaude] 超过最大重试次数');
};

export const streamClaude = async function* (
  messages: LLMMessage[],
  modelType: 'text' | 'vision' = 'text',
  extraOptions?: { temperature?: number; maxTokens?: number; model?: string }
): AsyncGenerator<LLMStreamChunk> {
  const config = getProviderConfig('claude');
  const model = extraOptions?.model || (modelType === 'vision' ? config.visionModel : config.textModel);
  const { system, messages: claudeMessages } = convertToClaude(messages);

  const response = await axios.post(
    `${config.baseUrl}/v1/messages`,
    {
      model,
      max_tokens: extraOptions?.maxTokens ?? 8192,
      system: system || undefined,
      messages: claudeMessages,
      stream: true,
      ...(extraOptions?.temperature !== undefined ? { temperature: extraOptions.temperature } : {}),
    },
    {
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      responseType: 'stream',
      timeout: 300_000,
    }
  );

  let buffer = '';
  for await (const chunk of response.data) {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim() || !line.startsWith('data: ')) continue;
      const dataLine = line.slice(6);
      try {
        const parsed = JSON.parse(dataLine);
        if (parsed.type === 'content_block_delta') {
          const delta = parsed.delta?.text || '';
          yield { delta, done: false };
        } else if (parsed.type === 'message_stop') {
          yield { delta: '', done: true, finishReason: 'stop' };
          return;
        }
      } catch { /* 忽略解析错误 */ }
    }
  }
};

// =============================================================================
// Gemini (Google) 调用
// =============================================================================

/** 将 OpenAI 格式消息转换为 Gemini 格式 */
const convertToGemini = (messages: LLMMessage[]) => {
  let systemInstruction = '';
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  for (const msg of messages) {
    const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    if (msg.role === 'system') {
      systemInstruction += text + '\n';
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text }],
      });
    }
  }

  return { systemInstruction: systemInstruction.trim(), contents };
};

export const callGemini = async (
  messages: LLMMessage[],
  modelType: 'text' | 'vision' = 'text'
): Promise<LLMResponse> => {
  const config = getProviderConfig('gemini');
  const model = modelType === 'vision' ? config.visionModel : config.textModel;
  const { systemInstruction, contents } = convertToGemini(messages);

  const url = `${config.baseUrl}/models/${model}:generateContent?key=${config.apiKey}`;

  for (let attempt = 0; attempt <= RATE_LIMIT_CONFIG.maxRetries; attempt++) {
    try {
      const response = await axios.post(
        url,
        {
          ...(systemInstruction ? { system_instruction: { parts: [{ text: systemInstruction }] } } : {}),
          contents,
          generationConfig: { maxOutputTokens: 8192 },
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 120_000 }
      );

      const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const usageMetadata = response.data?.usageMetadata;
      const usage = usageMetadata
        ? {
            promptTokens: usageMetadata.promptTokenCount || 0,
            completionTokens: usageMetadata.candidatesTokenCount || 0,
          }
        : undefined;

      return { content, provider: 'gemini', model, usage };
    } catch (error: unknown) {
      if (isRateLimitError(error) && attempt < RATE_LIMIT_CONFIG.maxRetries) {
        const delay = getRetryDelay(attempt);
        console.warn(`[callGemini] 429 限流，第 ${attempt + 1} 次重试，等待 ${(delay / 1000).toFixed(1)}s...`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error('[callGemini] 超过最大重试次数');
};

export const streamGemini = async function* (
  messages: LLMMessage[],
  modelType: 'text' | 'vision' = 'text',
  extraOptions?: { temperature?: number; maxTokens?: number; model?: string }
): AsyncGenerator<LLMStreamChunk> {
  const config = getProviderConfig('gemini');
  const model = extraOptions?.model || (modelType === 'vision' ? config.visionModel : config.textModel);
  const { systemInstruction, contents } = convertToGemini(messages);

  const url = `${config.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${config.apiKey}`;

  const response = await axios.post(
    url,
    {
      ...(systemInstruction ? { system_instruction: { parts: [{ text: systemInstruction }] } } : {}),
      contents,
      generationConfig: {
        maxOutputTokens: extraOptions?.maxTokens ?? 8192,
        ...(extraOptions?.temperature !== undefined ? { temperature: extraOptions.temperature } : {}),
      },
    },
    {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'stream',
      timeout: 300_000,
    }
  );

  let buffer = '';
  for await (const chunk of response.data) {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim() || !line.startsWith('data: ')) continue;
      try {
        const parsed = JSON.parse(line.slice(6));
        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const finishReason = parsed?.candidates?.[0]?.finishReason;
        const done = finishReason === 'STOP' || finishReason === 'MAX_TOKENS';
        yield { delta: text, done, finishReason: done ? (finishReason === 'STOP' ? 'stop' : 'length') : undefined };
        if (done) return;
      } catch { /* 忽略 */ }
    }
  }
};

// =============================================================================
// DeepSeek 调用（OpenAI 兼容 API）
// =============================================================================

export const callDeepSeek = async (
  messages: LLMMessage[],
  modelType: 'text' | 'vision' = 'text'
): Promise<LLMResponse> => {
  const config = getProviderConfig('deepseek');
  const model = modelType === 'vision' ? config.visionModel : config.textModel;
  const url = `${config.baseUrl}/chat/completions`;

  for (let attempt = 0; attempt <= RATE_LIMIT_CONFIG.maxRetries; attempt++) {
    try {
      const response = await axios.post(
        url,
        { model, messages, stream: false },
        {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 120_000,
        }
      );

      const content: string = response.data?.choices?.[0]?.message?.content || '';
      const usage = response.data?.usage
        ? {
            promptTokens: response.data.usage.prompt_tokens || 0,
            completionTokens: response.data.usage.completion_tokens || 0,
          }
        : undefined;

      return { content, provider: 'deepseek', model, usage };
    } catch (error: unknown) {
      if (isRateLimitError(error) && attempt < RATE_LIMIT_CONFIG.maxRetries) {
        const retryAfter = parseRetryAfter(error);
        const delay = getRetryDelay(attempt, retryAfter);
        console.warn(`[callDeepSeek] 429 限流，第 ${attempt + 1} 次重试...`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error('[callDeepSeek] 超过最大重试次数');
};

export const streamDeepSeek = async function* (
  messages: LLMMessage[],
  modelType: 'text' | 'vision' = 'text',
  extraOptions?: { temperature?: number; maxTokens?: number; model?: string }
): AsyncGenerator<LLMStreamChunk> {
  const config = getProviderConfig('deepseek');
  const model = extraOptions?.model || (modelType === 'vision' ? config.visionModel : config.textModel);
  const url = `${config.baseUrl}/chat/completions`;

  const response = await axios.post(
    url,
    {
      model,
      messages,
      stream: true,
      max_tokens: extraOptions?.maxTokens ?? 8192,
      ...(extraOptions?.temperature !== undefined ? { temperature: extraOptions.temperature } : {}),
    },
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      responseType: 'stream',
      timeout: 300_000,
    }
  );

  let buffer = '';
  for await (const chunk of response.data) {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim() || line === 'data: [DONE]') continue;
      const dataLine = line.startsWith('data: ') ? line.slice(6) : line;
      try {
        const parsed = JSON.parse(dataLine);
        const delta = parsed?.choices?.[0]?.delta?.content || '';
        const rawFinishReason: string | null = parsed?.choices?.[0]?.finish_reason ?? null;
        const done = rawFinishReason === 'stop' || rawFinishReason === 'length';
        yield { delta, done, finishReason: rawFinishReason ?? undefined };
        if (done) return;
      } catch { /* 忽略 */ }
    }
  }
};

// =============================================================================
// Fallback 机制
// =============================================================================

/**
 * 带 Fallback 的 LLM 调用
 * 按照 fallbackProviders 链依次尝试，直到成功
 */
export const callWithFallback = async (
  callFn: (provider: LLMProvider) => Promise<LLMResponse>,
  primaryProvider: LLMProvider
): Promise<LLMResponse> => {
  const providers = [primaryProvider, ...env.fallbackProviders.filter(p => p !== primaryProvider)];

  for (let i = 0; i < providers.length; i++) {
    try {
      return await callFn(providers[i]);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[Fallback] Provider "${providers[i]}" 调用失败: ${errMsg}`);
      if (i === providers.length - 1) throw error;
      console.log(`[Fallback] 尝试降级到 "${providers[i + 1]}"...`);
    }
  }

  throw new Error('所有 Provider 均调用失败');
};

// =============================================================================
// Token 用量追踪
// =============================================================================

interface TokenUsageRecord {
  provider: LLMProvider;
  model: string;
  promptTokens: number;
  completionTokens: number;
  timestamp: Date;
}

/** 内存中的 Token 用量记录（每日重置） */
let dailyTokenUsage: TokenUsageRecord[] = [];
let lastResetDate = new Date().toDateString();

/** 记录 Token 用量 */
export const trackTokenUsage = (record: TokenUsageRecord) => {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailyTokenUsage = [];
    lastResetDate = today;
  }
  dailyTokenUsage.push(record);
};

/** 获取今日 Token 用量统计 */
export const getDailyTokenStats = () => {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailyTokenUsage = [];
    lastResetDate = today;
  }

  const byProvider: Record<string, { promptTokens: number; completionTokens: number; totalTokens: number; callCount: number }> = {};
  let totalTokens = 0;

  for (const record of dailyTokenUsage) {
    const total = record.promptTokens + record.completionTokens;
    totalTokens += total;

    if (!byProvider[record.provider]) {
      byProvider[record.provider] = { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 };
    }
    byProvider[record.provider].promptTokens += record.promptTokens;
    byProvider[record.provider].completionTokens += record.completionTokens;
    byProvider[record.provider].totalTokens += total;
    byProvider[record.provider].callCount += 1;
  }

  return {
    date: today,
    totalTokens,
    totalCalls: dailyTokenUsage.length,
    budget: env.dailyTokenBudget,
    remaining: env.dailyTokenBudget > 0 ? Math.max(0, env.dailyTokenBudget - totalTokens) : -1,
    byProvider,
  };
};

/** 检查是否超出 Token 预算 */
export const isOverBudget = (): boolean => {
  if (env.dailyTokenBudget <= 0) return false;
  const stats = getDailyTokenStats();
  return stats.totalTokens >= env.dailyTokenBudget;
};
