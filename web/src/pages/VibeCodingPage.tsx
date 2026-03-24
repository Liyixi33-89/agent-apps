import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Zap, Send, Copy, Check, Bot, Cpu, Eye, MessageSquare,
  ChevronDown, Plus, Trash2, RotateCcw, Code2, User, Sparkles
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { fetchAgents, createChatSession } from '../api';
import { useAppStore } from '../store';
import type { Agent, Provider, ModelType, ChatMessage } from '../types';

// ─── 类型 ──────────────────────────────────────────────────────────────────────

interface VibeSession {
  sessionId: string;
  agentName: string;
  provider: Provider;
  modelType: ModelType;
}

// ─── 工具函数：从 markdown 提取最后一个代码块 ──────────────────────────────────

const extractLastCodeBlock = (markdown: string): { code: string; lang: string } | null => {
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let last: { code: string; lang: string } | null = null;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    last = { lang: match[1] || 'text', code: match[2] };
  }
  return last;
};

// ─── 消息气泡组件 ──────────────────────────────────────────────────────────────

const MessageBubble = ({
  msg,
  lang,
  isStreaming,
}: {
  msg: ChatMessage;
  lang: 'zh' | 'en';
  isStreaming?: boolean;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (msg.role === 'system') return null;

  const isUser = msg.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* 头像 */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-sky-600' : 'bg-violet-700'
        }`}
      >
        {isUser ? <User className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4 text-white" />}
      </div>

      {/* 内容 */}
      <div className={`flex-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            isUser
              ? 'bg-sky-600 text-white rounded-tr-sm'
              : 'bg-gray-800 text-gray-100 rounded-tl-sm border border-gray-700'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div className="prose-dark">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match;
                    const codeStr = String(children).replace(/\n$/, '');
                    return isInline ? (
                      <code className="bg-gray-900 text-sky-300 px-1 py-0.5 rounded text-xs" {...props}>
                        {children}
                      </code>
                    ) : (
                      <div className="relative group">
                        <button
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity btn-ghost text-xs z-10"
                          onClick={() => handleCopyCode(codeStr)}
                          aria-label="复制代码"
                          tabIndex={0}
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <SyntaxHighlighter
                          style={oneDark as any}
                          language={match[1]}
                          PreTag="div"
                          className="rounded-lg text-xs !mt-0"
                        >
                          {codeStr}
                        </SyntaxHighlighter>
                      </div>
                    );
                  },
                }}
              >
                {msg.content}
              </ReactMarkdown>
              {isStreaming && <span className="typing-cursor" />}
            </div>
          )}
        </div>
        <span className="text-xs text-gray-600 px-1">
          {msg.provider && !isUser && (
            <span className="text-gray-600">{msg.provider} · </span>
          )}
          {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};

// ─── 主页面 ────────────────────────────────────────────────────────────────────

const VibeCodingPage = () => {
  const [searchParams] = useSearchParams();
  const { lang, activeProvider } = useAppStore();

  // 会话状态
  const [session, setSession] = useState<VibeSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);

  // 输入状态
  const [input, setInput] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>(searchParams.get('agent') || '');
  const [provider, setProvider] = useState<Provider>(activeProvider);
  const [modelType, setModelType] = useState<ModelType>('text');
  const [showAgentPicker, setShowAgentPicker] = useState(false);

  // 代码预览
  const [previewCode, setPreviewCode] = useState<{ code: string; lang: string } | null>(null);
  const [copiedPreview, setCopiedPreview] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 加载 agents
  useEffect(() => {
    fetchAgents({ limit: 100 }).then((r) => setAgents(r.data)).catch(console.error);
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 自动调整 textarea 高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const selectedAgentObj = agents.find((a) => a.slug === selectedAgent);

  // ─── 新建会话 ────────────────────────────────────────────────────────────────

  const handleNewSession = useCallback(async () => {
    if (streaming) {
      abortRef.current?.abort();
      setStreaming(false);
    }
    setMessages([]);
    setSession(null);
    setPreviewCode(null);
    setInput('');
  }, [streaming]);

  // ─── 创建或复用会话 ──────────────────────────────────────────────────────────

  const ensureSession = async (): Promise<VibeSession> => {
    if (session) return session;
    const newSession = await createChatSession({
      agentSlug: selectedAgent || undefined,
      provider,
      modelType,
      sessionType: 'vibe',
    } as any);
    // 注入 Vibe Coding 系统提示
    const vibeSession: VibeSession = {
      sessionId: newSession.sessionId,
      agentName: newSession.agentName,
      provider: newSession.provider,
      modelType: newSession.modelType,
    };
    setSession(vibeSession);
    return vibeSession;
  };

  // ─── 发送消息（流式）────────────────────────────────────────────────────────

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    setInput('');

    // 添加用户消息到本地
    const userMsg: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);

    // 占位 AI 消息
    const aiMsg: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, aiMsg]);

    abortRef.current = new AbortController();

    try {
      const currentSession = await ensureSession();

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.sessionId,
          message: trimmed,
        }),
        signal: abortRef.current.signal,
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'delta') {
              fullContent += parsed.delta;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: fullContent,
                };
                return updated;
              });
            }
          } catch {
            // 忽略
          }
        }
      }

      // 更新代码预览
      const extracted = extractLastCodeBlock(fullContent);
      if (extracted) setPreviewCode(extracted);

      // 更新最终消息时间戳和 provider
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          timestamp: new Date().toISOString(),
          provider: currentSession.provider,
        };
        return updated;
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: lang === 'zh' ? '❌ 生成失败，请检查服务连接' : '❌ Generation failed, please check service connection',
            timestamp: new Date().toISOString(),
          };
          return updated;
        });
      }
    } finally {
      setStreaming(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyPreview = async () => {
    if (!previewCode) return;
    await navigator.clipboard.writeText(previewCode.code);
    setCopiedPreview(true);
    setTimeout(() => setCopiedPreview(false), 2000);
  };

  // ─── 示例提示词 ──────────────────────────────────────────────────────────────

  const examplePrompts = [
    { zh: '用 React + TypeScript 创建一个带搜索功能的用户列表组件', en: 'Create a user list component with search using React + TypeScript' },
    { zh: '写一个 Node.js Koa 中间件，实现 JWT 认证', en: 'Write a Node.js Koa middleware for JWT authentication' },
    { zh: '创建一个 Python FastAPI 接口，支持文件上传', en: 'Create a Python FastAPI endpoint with file upload support' },
    { zh: '实现一个防抖 Hook，支持取消和立即执行', en: 'Implement a debounce hook with cancel and immediate execution' },
  ];

  const hasMessages = messages.filter((m) => m.role !== 'system').length > 0;

  // ─── 渲染 ─────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h1 className="text-lg font-bold text-white">Vibe Coding</h1>
          </div>
          {session && (
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
              {session.agentName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Agent 选择 */}
          <div className="relative">
            <button
              className="btn-ghost text-sm flex items-center gap-1.5"
              onClick={() => setShowAgentPicker(!showAgentPicker)}
              aria-label="选择 Agent"
              tabIndex={0}
            >
              <Bot className="w-4 h-4" />
              <span className="max-w-20 truncate text-xs">
                {selectedAgentObj
                  ? (lang === 'zh' ? selectedAgentObj.name.zh : selectedAgentObj.name.en)
                  : (lang === 'zh' ? '选择 Agent' : 'Select Agent')}
              </span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showAgentPicker && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 max-h-64 overflow-y-auto">
                <button
                  className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-700 hover:text-gray-100"
                  onClick={() => { setSelectedAgent(''); setShowAgentPicker(false); }}
                >
                  {lang === 'zh' ? '不使用 Agent' : 'No Agent'}
                </button>
                {agents.map((a) => (
                  <button
                    key={a.slug}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-gray-100 flex items-center gap-2"
                    onClick={() => { setSelectedAgent(a.slug); setShowAgentPicker(false); }}
                  >
                    <span>{a.emoji}</span>
                    <span className="truncate">{lang === 'zh' ? a.name.zh : a.name.en}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Provider 切换 */}
          <button
            className={`btn-ghost text-xs flex items-center gap-1 ${provider === 'ollama' ? 'text-emerald-400' : 'text-sky-400'}`}
            onClick={() => setProvider(provider === 'ollama' ? 'codebuddy' : 'ollama')}
            aria-label="切换提供商"
            tabIndex={0}
          >
            <Cpu className="w-3.5 h-3.5" />
            {provider === 'ollama' ? 'Ollama' : 'CodeBuddy'}
          </button>

          {/* 模型类型 */}
          <button
            className={`btn-ghost text-xs flex items-center gap-1 ${modelType === 'vision' ? 'text-violet-400' : 'text-gray-400'}`}
            onClick={() => setModelType(modelType === 'text' ? 'vision' : 'text')}
            aria-label="切换模型类型"
            tabIndex={0}
          >
            {modelType === 'vision' ? <Eye className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
            {modelType === 'vision' ? 'Vision' : 'Text'}
          </button>

          {/* 新建会话 */}
          {hasMessages && (
            <button
              className="btn-ghost text-xs flex items-center gap-1 text-gray-400 hover:text-white"
              onClick={handleNewSession}
              aria-label="新建会话"
              tabIndex={0}
            >
              <Plus className="w-3.5 h-3.5" />
              {lang === 'zh' ? '新建' : 'New'}
            </button>
          )}
        </div>
      </div>

      {/* 主体区域 */}
      <div className="flex-1 flex min-h-0">
        {/* 左侧：对话区 */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-gray-800">
          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {!hasMessages ? (
              /* 欢迎界面 */
              <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-violet-500/20 flex items-center justify-center border border-yellow-500/20">
                  <Zap className="w-8 h-8 text-yellow-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white mb-2">
                    {lang === 'zh' ? '开始 Vibe Coding' : 'Start Vibe Coding'}
                  </h2>
                  <p className="text-gray-500 text-sm max-w-sm">
                    {lang === 'zh'
                      ? '用自然语言描述你想要的代码，AI 会生成并持续帮你迭代优化'
                      : 'Describe what you want in natural language, AI will generate and iteratively improve your code'}
                  </p>
                </div>
                {/* 示例提示词 */}
                <div className="grid grid-cols-1 gap-2 w-full max-w-lg">
                  {examplePrompts.map((p, i) => (
                    <button
                      key={i}
                      className="text-left text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 px-4 py-2.5 rounded-xl border border-gray-800 hover:border-gray-700 transition-all"
                      onClick={() => setInput(lang === 'zh' ? p.zh : p.en)}
                      tabIndex={0}
                    >
                      <Code2 className="w-3.5 h-3.5 inline mr-2 text-yellow-500/70" />
                      {lang === 'zh' ? p.zh : p.en}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* 消息列表 */
              <>
                {messages.map((msg, idx) => (
                  <MessageBubble
                    key={idx}
                    msg={msg}
                    lang={lang}
                    isStreaming={streaming && idx === messages.length - 1 && msg.role === 'assistant'}
                  />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* 输入区 */}
          <div className="px-6 py-4 border-t border-gray-800 flex-shrink-0">
            <div className="flex gap-3 items-end bg-gray-800 rounded-2xl border border-gray-700 focus-within:border-gray-600 px-4 py-3 transition-colors">
              <textarea
                ref={textareaRef}
                className="flex-1 bg-transparent text-gray-100 text-sm resize-none outline-none placeholder-gray-500 min-h-[24px] max-h-40"
                placeholder={
                  hasMessages
                    ? (lang === 'zh' ? '继续描述修改需求... (Enter 发送，Shift+Enter 换行)' : 'Continue describing changes... (Enter to send, Shift+Enter for newline)')
                    : (lang === 'zh' ? '描述你想要的代码... (Enter 发送，Shift+Enter 换行)' : 'Describe what you want... (Enter to send, Shift+Enter for newline)')
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label="输入提示词"
                rows={1}
              />
              {streaming ? (
                <button
                  className="flex-shrink-0 w-8 h-8 rounded-xl bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors"
                  onClick={handleStop}
                  aria-label="停止生成"
                  tabIndex={0}
                >
                  <span className="w-3 h-3 bg-white rounded-sm" />
                </button>
              ) : (
                <button
                  className="flex-shrink-0 w-8 h-8 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  aria-label="发送"
                  tabIndex={0}
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-2 text-center">
              {lang === 'zh'
                ? '多轮对话模式 · 可持续迭代修改代码'
                : 'Multi-turn mode · Continuously iterate and refine code'}
            </p>
          </div>
        </div>

        {/* 右侧：代码预览面板 */}
        <div className="w-96 flex flex-col flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-400">
                {lang === 'zh' ? '最新代码' : 'Latest Code'}
              </span>
              {previewCode && (
                <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
                  {previewCode.lang}
                </span>
              )}
            </div>
            {previewCode && (
              <div className="flex items-center gap-1">
                <button
                  className="btn-ghost text-xs flex items-center gap-1"
                  onClick={handleCopyPreview}
                  aria-label="复制代码"
                  tabIndex={0}
                >
                  {copiedPreview
                    ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                    : <Copy className="w-3.5 h-3.5" />}
                  {copiedPreview
                    ? (lang === 'zh' ? '已复制' : 'Copied')
                    : (lang === 'zh' ? '复制' : 'Copy')}
                </button>
                <button
                  className="btn-ghost text-xs flex items-center gap-1 text-gray-500"
                  onClick={() => setPreviewCode(null)}
                  aria-label="清除预览"
                  tabIndex={0}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {previewCode ? (
              <SyntaxHighlighter
                style={oneDark as any}
                language={previewCode.lang}
                PreTag="div"
                className="!m-0 !rounded-none h-full text-xs"
                showLineNumbers
              >
                {previewCode.code}
              </SyntaxHighlighter>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-700 gap-3 p-6">
                <Code2 className="w-10 h-10 opacity-30" />
                <p className="text-sm text-center">
                  {lang === 'zh'
                    ? 'AI 生成的代码将在这里预览'
                    : 'AI generated code will preview here'}
                </p>
                {hasMessages && (
                  <button
                    className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1 transition-colors"
                    onClick={() => {
                      // 从最后一条 AI 消息中提取代码
                      const lastAI = [...messages].reverse().find((m) => m.role === 'assistant');
                      if (lastAI) {
                        const extracted = extractLastCodeBlock(lastAI.content);
                        if (extracted) setPreviewCode(extracted);
                      }
                    }}
                    tabIndex={0}
                  >
                    <RotateCcw className="w-3 h-3" />
                    {lang === 'zh' ? '从对话中提取代码' : 'Extract code from chat'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VibeCodingPage;
