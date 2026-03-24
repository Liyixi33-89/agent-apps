import axios from 'axios';
import { env } from '../config/env.js';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
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

  const response = await axios.post(
    url,
    { model, messages, stream: true },
    { responseType: 'stream', timeout: 120_000 }
  );

  let buffer = '';
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
        yield { delta, done };
        if (done) return;
      } catch {
        // 忽略解析错误
      }
    }
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
    { model, messages, stream: true },
    {
      headers: {
        Authorization: `Bearer ${env.codebuddyApiKey}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream',
      timeout: 120_000
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
        const done = parsed?.choices?.[0]?.finish_reason === 'stop';
        yield { delta, done };
        if (done) return;
      } catch {
        // 忽略解析错误
      }
    }
  }
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
