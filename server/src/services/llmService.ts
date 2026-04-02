import axios from 'axios';
import { env } from '../config/env.js';

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
  provider: 'ollama' | 'codebuddy';
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

// ─── CodeBuddy 调用 ────────────────────────────────────────────────────────────

const callCodeBuddy = async (
  messages: LLMMessage[],
  modelType: 'text' | 'vision' = 'text'
): Promise<LLMResponse> => {
  const model = modelType === 'vision' ? env.codebuddyVisionModel : env.codebuddyTextModel;
  const url = `${env.codebuddyBaseUrl}/v1/chat/completions`;

  const response = await axios.post(
    url,
    { model, messages, stream: false },
    {
      headers: {
        Authorization: `Bearer ${env.codebuddyApiKey}`,
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

  return { content, provider: 'codebuddy', model, usage };
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

// ─── 流式 CodeBuddy ────────────────────────────────────────────────────────────

export const streamCodeBuddy = async function* (
  messages: LLMMessage[],
  modelType: 'text' | 'vision' = 'text'
): AsyncGenerator<LLMStreamChunk> {
  const model = modelType === 'vision' ? env.codebuddyVisionModel : env.codebuddyTextModel;
  const url = `${env.codebuddyBaseUrl}/v1/chat/completions`;

  const response = await axios.post(
    url,
    { model, messages, stream: true, max_tokens: 16384 },
    {
      headers: {
        Authorization: `Bearer ${env.codebuddyApiKey}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream',
      timeout: 180_000
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
  provider: 'ollama' | 'codebuddy';
  model: string;
  finishReason?: string;
}

// ─── 支持 Tool Calling 的非流式调用 ───────────────────────────────────────────

export const callLLMWithTools = async (
  messages: LLMMessage[],
  tools: unknown[],
  options: {
    modelType?: 'text' | 'vision';
    provider?: 'ollama' | 'codebuddy';
  } = {}
): Promise<LLMToolResponse> => {
  const provider = options.provider || env.activeProvider;
  const modelType = options.modelType || 'text';

  if (provider === 'codebuddy') {
    const model = modelType === 'vision' ? env.codebuddyVisionModel : env.codebuddyTextModel;
    const url = `${env.codebuddyBaseUrl}/v1/chat/completions`;

    const response = await axios.post(
      url,
      { model, messages, tools, tool_choice: 'auto', stream: false },
      {
        headers: {
          Authorization: `Bearer ${env.codebuddyApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120_000,
      }
    );

    const choice = response.data?.choices?.[0];
    const content: string = choice?.message?.content || '';
    const toolCalls: ToolCall[] | undefined = choice?.message?.tool_calls;
    const finishReason: string | undefined = choice?.finish_reason;

    return { content, toolCalls, provider: 'codebuddy', model, finishReason };
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
    provider?: 'ollama' | 'codebuddy';
  } = {}
): Promise<LLMResponse> => {
  const provider = options.provider || env.activeProvider;
  const modelType = options.modelType || 'text';

  if (provider === 'codebuddy') {
    return callCodeBuddy(messages, modelType);
  }
  return callOllama(messages, modelType);
};

export const streamLLM = (
  messages: LLMMessage[],
  options: {
    modelType?: 'text' | 'vision';
    provider?: 'ollama' | 'codebuddy';
  } = {}
): AsyncGenerator<LLMStreamChunk> => {
  const provider = options.provider || env.activeProvider;
  const modelType = options.modelType || 'text';

  if (provider === 'codebuddy') {
    return streamCodeBuddy(messages, modelType);
  }
  return streamOllama(messages, modelType);
};
