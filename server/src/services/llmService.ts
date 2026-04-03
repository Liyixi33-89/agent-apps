import axios, { AxiosError } from 'axios';
import { env } from '../config/env.js';

// ─── 429 重试工具函数 ──────────────────────────────────────────────────────────

/** 延迟指定毫秒 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 从 429 响应的 Retry-After 头中解析等待时间（秒）
 * 如果没有该头或解析失败，返回 undefined
 */
const parseRetryAfter = (error: AxiosError): number | undefined => {
  const retryAfter = error.response?.headers?.['retry-after'];
  if (!retryAfter) return undefined;
  const seconds = Number(retryAfter);
  return isNaN(seconds) ? undefined : seconds;
};

/** 429 重试配置 */
const RATE_LIMIT_CONFIG = {
  maxRetries: 5,           // 最大重试次数
  baseDelayMs: 5_000,      // 基础等待时间 5 秒
  maxDelayMs: 60_000,      // 最大等待时间 60 秒
  backoffMultiplier: 2,    // 指数退避倍数
};

/**
 * 计算第 N 次重试的等待时间（指数退避 + 随机抖动）
 * 优先使用 Retry-After 头的值
 */
const getRetryDelay = (attempt: number, retryAfterSeconds?: number): number => {
  if (retryAfterSeconds !== undefined) {
    // 使用服务器建议的等待时间，加 1 秒余量
    return Math.min((retryAfterSeconds + 1) * 1000, RATE_LIMIT_CONFIG.maxDelayMs);
  }
  // 指数退避：baseDelay * 2^attempt + 随机抖动(0~1秒)
  const exponentialDelay = RATE_LIMIT_CONFIG.baseDelayMs * Math.pow(RATE_LIMIT_CONFIG.backoffMultiplier, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, RATE_LIMIT_CONFIG.maxDelayMs);
};

/** 判断是否为 429 限流错误 */
const isRateLimitError = (error: unknown): error is AxiosError => {
  return axios.isAxiosError(error) && error.response?.status === 429;
};

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
  /** tool role 专用：对应 tool_call 的 id */
  tool_call_id?: string;
  /** tool role 专用：工具名称 */
  name?: string;
  /** assistant role 专用：携带的工具调用列表 */
  tool_calls?: unknown[];
}

export interface LLMResponse {
  content: string;
  provider: 'ollama' | 'openai';
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface LLMStreamChunk {
  delta: string;
  done: boolean;
  /** 'stop' = 正常结束, 'length' = token 超出, undefined = 未结束 */
  finishReason?: 'stop' | 'length' | string;
}

// ─── Ollama 调用 ───────────────────────────────────────────────────────────────

const callOllama = async (
  messages: LLMMessage[],
  modelType: 'text' | 'vision' = 'text',
  stream = false
): Promise<LLMResponse> => {
  const model = modelType === 'vision' ? env.ollamaVisionModel : env.ollamaTextModel;
  const url = `${env.ollamaBaseUrl}/api/chat`;

  const response = await axios.post(
    url,
    { model, messages, stream: false },
    { timeout: 120_000 }
  );

  const content: string =
    response.data?.message?.content ||
    response.data?.choices?.[0]?.message?.content ||
    '';

  return { content, provider: 'ollama', model };
};

// ─── OpenAI 调用 ───────────────────────────────────────────────────────────────

const callOpenAI = async (
  messages: LLMMessage[],
  modelType: 'text' | 'vision' = 'text'
): Promise<LLMResponse> => {
  const model = modelType === 'vision' ? env.openaiVisionModel : env.openaiTextModel;
  const url = `${env.openaiBaseUrl}/chat/completions`;

  for (let attempt = 0; attempt <= RATE_LIMIT_CONFIG.maxRetries; attempt++) {
    try {
      const response = await axios.post(
        url,
        { model, messages, stream: false },
        {
          headers: {
            Authorization: `Bearer ${env.openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120_000
        }
      );

      const content: string = response.data?.choices?.[0]?.message?.content || '';
      const usage = response.data?.usage
        ? {
            promptTokens: response.data.usage.prompt_tokens || 0,
            completionTokens: response.data.usage.completion_tokens || 0
          }
        : undefined;

      return { content, provider: 'openai', model, usage };
    } catch (error: unknown) {
      if (isRateLimitError(error) && attempt < RATE_LIMIT_CONFIG.maxRetries) {
        const retryAfter = parseRetryAfter(error);
        const delay = getRetryDelay(attempt, retryAfter);
        console.warn(`[callOpenAI] 429 限流，第 ${attempt + 1}/${RATE_LIMIT_CONFIG.maxRetries} 次重试，等待 ${(delay / 1000).toFixed(1)}s...`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }

  throw new Error('[callOpenAI] 超过最大重试次数，API 持续返回 429 限流');
};

// ─── 流式 Ollama ───────────────────────────────────────────────────────────────

export const streamOllama = async function* (
  messages: LLMMessage[],
  modelType: 'text' | 'vision' = 'text'
): AsyncGenerator<LLMStreamChunk> {
  const model = modelType === 'vision' ? env.ollamaVisionModel : env.ollamaTextModel;
  const url = `${env.ollamaBaseUrl}/api/chat`;

  let response;
  try {
    response = await axios.post(
      url,
      { model, messages, stream: true, num_predict: 32768, options: { num_ctx: 65536 } },
      { responseType: 'stream', timeout: 300_000 }
    );
  } catch (err: any) {
    // 连接 Ollama 失败时给出明确错误
    const msg = err?.code === 'ECONNREFUSED'
      ? 'Ollama 服务未启动，请先运行 ollama serve'
      : `Ollama 连接失败: ${err?.message || '未知错误'}`;
    console.error(`[streamOllama] ${msg}`);
    yield { delta: '', done: true, finishReason: 'error' };
    return;
  }

  let buffer = '';
  let hasYieldedDone = false;

  for await (const chunk of response.data) {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        const delta = parsed?.message?.content || '';
        const done = parsed?.done === true;
        // Ollama 通过 done_reason 标识结束原因（'stop' | 'length'）
        // ⚠️ 注意：某些 Ollama 版本/模型在 token 截断时不返回 done_reason 或返回空字符串
        // 此时不应默认回退为 'stop'，而应保留 undefined 让 isLikelyTruncated 进行内容检测
        const rawDoneReason = parsed?.done_reason;
        const finishReason: string | undefined = done ? (rawDoneReason && rawDoneReason !== '' ? rawDoneReason : undefined) : undefined;
        yield { delta, done, finishReason };
        if (done) {
          hasYieldedDone = true;
          return;
        }
      } catch {
        // 忽略解析错误
      }
    }
  }

  // 处理 buffer 中残留的最后一行数据
  if (buffer.trim()) {
    try {
      const parsed = JSON.parse(buffer);
      const delta = parsed?.message?.content || '';
      const done = parsed?.done === true;
      const rawDoneReason = parsed?.done_reason;
      const finishReason: string | undefined = done ? (rawDoneReason && rawDoneReason !== '' ? rawDoneReason : undefined) : undefined;
      yield { delta, done, finishReason };
      if (done) hasYieldedDone = true;
    } catch {
      // 残留数据解析失败，忽略
    }
  }

  // 如果流结束但没有收到 done 信号，手动发送一个
  // 这种情况通常是 Ollama 异常断开连接
  if (!hasYieldedDone) {
    console.warn('[streamOllama] 流结束但未收到 done 信号，可能是连接异常断开');
    yield { delta: '', done: true, finishReason: 'length' };
  }
};

// ─── 流式 OpenAI ───────────────────────────────────────────────────────────────

export const streamOpenAI = async function* (
  messages: LLMMessage[],
  modelType: 'text' | 'vision' = 'text'
): AsyncGenerator<LLMStreamChunk> {
  const model = modelType === 'vision' ? env.openaiVisionModel : env.openaiTextModel;
  const url = `${env.openaiBaseUrl}/chat/completions`;

  let response;
  for (let attempt = 0; attempt <= RATE_LIMIT_CONFIG.maxRetries; attempt++) {
    try {
      response = await axios.post(
        url,
        { model, messages, stream: true, max_tokens: 16384 },
        {
          headers: {
            Authorization: `Bearer ${env.openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream',
          timeout: 180_000
        }
      );
      break; // 请求成功，跳出重试循环
    } catch (error: unknown) {
      if (isRateLimitError(error) && attempt < RATE_LIMIT_CONFIG.maxRetries) {
        const retryAfter = parseRetryAfter(error);
        const delay = getRetryDelay(attempt, retryAfter);
        console.warn(`[streamOpenAI] 429 限流，第 ${attempt + 1}/${RATE_LIMIT_CONFIG.maxRetries} 次重试，等待 ${(delay / 1000).toFixed(1)}s...`);
        await sleep(delay);
        continue;
      }
      // 非 429 错误或超过重试次数，直接抛出
      throw error;
    }
  }

  if (!response) {
    throw new Error('[streamOpenAI] 超过最大重试次数，API 持续返回 429 限流');
  }

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
        const finishReason: string | undefined = rawFinishReason ?? undefined;
        yield { delta, done, finishReason };
        if (done) return;
      } catch {
        // 忽略解析错误
      }
    }
  }
};

// ─── 统一调用入口 ──────────────────────────────────────────────────────────────

// ─── Tool Calling 类型 ─────────────────────────────────────────────────────────

export interface ToolCall {
  id?: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON 字符串
  };
}

export interface LLMToolResponse {
  content: string;
  toolCalls?: ToolCall[];
  provider: 'ollama' | 'openai';
  model: string;
  finishReason?: string;
}

// ─── 支持 Tool Calling 的非流式调用 ───────────────────────────────────────────

export const callLLMWithTools = async (
  messages: LLMMessage[],
  tools: unknown[],
  options: {
    modelType?: 'text' | 'vision';
  provider?: 'ollama' | 'openai';
  } = {}
): Promise<LLMToolResponse> => {
  const provider = options.provider || env.activeProvider;
  const modelType = options.modelType || 'text';

  if (provider === 'openai') {
    const model = modelType === 'vision' ? env.openaiVisionModel : env.openaiTextModel;
    const url = `${env.openaiBaseUrl}/chat/completions`;

    for (let attempt = 0; attempt <= RATE_LIMIT_CONFIG.maxRetries; attempt++) {
      try {
        const response = await axios.post(
          url,
          { model, messages, tools, tool_choice: 'auto', stream: false },
          {
            headers: {
              Authorization: `Bearer ${env.openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 120_000,
          }
        );

        const choice = response.data?.choices?.[0];
        const content: string = choice?.message?.content || '';
        const toolCalls: ToolCall[] | undefined = choice?.message?.tool_calls;
        const finishReason: string | undefined = choice?.finish_reason;

        return { content, toolCalls, provider: 'openai', model, finishReason };
      } catch (error: unknown) {
        if (isRateLimitError(error) && attempt < RATE_LIMIT_CONFIG.maxRetries) {
          const retryAfter = parseRetryAfter(error);
          const delay = getRetryDelay(attempt, retryAfter);
          console.warn(`[callLLMWithTools] 429 限流，第 ${attempt + 1}/${RATE_LIMIT_CONFIG.maxRetries} 次重试，等待 ${(delay / 1000).toFixed(1)}s...`);
          await sleep(delay);
          continue;
        }
        throw error;
      }
    }

    throw new Error('[callLLMWithTools] 超过最大重试次数，API 持续返回 429 限流');
  }

  // Ollama tool calling
  const model = modelType === 'vision' ? env.ollamaVisionModel : env.ollamaTextModel;
  const url = `${env.ollamaBaseUrl}/api/chat`;

  const response = await axios.post(
    url,
    { model, messages, tools, stream: false },
    { timeout: 120_000 }
  );

  const message = response.data?.message;
  const content: string = message?.content || '';
  // Ollama 返回 tool_calls 字段
  const rawToolCalls = message?.tool_calls;
  let toolCalls: ToolCall[] | undefined;

  if (Array.isArray(rawToolCalls) && rawToolCalls.length > 0) {
    toolCalls = rawToolCalls.map((tc: any) => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.function?.name || '',
        // Ollama 的 arguments 可能已经是对象，统一序列化为字符串
        arguments: typeof tc.function?.arguments === 'string'
          ? tc.function.arguments
          : JSON.stringify(tc.function?.arguments || {}),
      },
    }));
  }

  return { content, toolCalls, provider: 'ollama', model };
};

// ─── 统一调用入口 ──────────────────────────────────────────────────────────────

export const callLLM = async (
  messages: LLMMessage[],
  options: {
    modelType?: 'text' | 'vision';
  provider?: 'ollama' | 'openai';
  } = {}
): Promise<LLMResponse> => {
  const provider = options.provider || env.activeProvider;
  const modelType = options.modelType || 'text';

  if (provider === 'openai') {
    return callOpenAI(messages, modelType);
  }
  return callOllama(messages, modelType);
};

export const streamLLM = (
  messages: LLMMessage[],
  options: {
    modelType?: 'text' | 'vision';
  provider?: 'ollama' | 'openai';
  } = {}
): AsyncGenerator<LLMStreamChunk> => {
  const provider = options.provider || env.activeProvider;
  const modelType = options.modelType || 'text';

  if (provider === 'openai') {
    return streamOpenAI(messages, modelType);
  }
  return streamOllama(messages, modelType);
};
