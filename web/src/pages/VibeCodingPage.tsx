import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Zap, Send, Copy, Check, Bot, Cpu, Eye, MessageSquare,
  ChevronDown, Plus, User, Sparkles, Monitor, RefreshCw,
  Maximize2, Minimize2, Play, Code2,
} from 'lucide-react';
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

interface CodeParts {
  html: string;
  css: string;
  js: string;
}

type PreviewTab = 'preview' | 'code';
type CodeTab = 'html' | 'css' | 'js';

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

// 移除 HTML 中的 integrity 属性，避免 SRI 校验失败
const sanitizeHtml = (html: string): string =>
  html.replace(/\s+integrity="[^"]*"/gi, '').replace(/\s+integrity='[^']*'/gi, '');

// 从 AI 输出中分别提取 HTML / CSS / JS 三段代码
const extractCodeParts = (markdown: string): CodeParts => {
  // 优先提取完整 HTML 文档，再从中拆分
  const fullHtmlMatch = markdown.match(/```html\n([\s\S]*?)```/i);
  const doctypeMatch = markdown.match(/(<!DOCTYPE[\s\S]*?<\/html>)/i);

  const fullHtml = fullHtmlMatch?.[1] ?? doctypeMatch?.[1] ?? null;

  if (fullHtml) {
    // 从完整 HTML 中提取 <style> 和 <script> 内容
    const styleMatch = fullHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const scriptMatch = fullHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/i);

    // 去掉 style 和 script 标签后剩余的 body 内容
    let bodyContent = fullHtml
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // 提取 <body> 内部内容
    const bodyInner = bodyContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim() ?? bodyContent.trim();

    return {
      html: bodyInner,
      css: styleMatch?.[1]?.trim() ?? '',
      js: scriptMatch?.[1]?.trim() ?? '',
    };
  }

  // 分段提取
  const cssMatch = markdown.match(/```css\n([\s\S]*?)```/i);
  const jsMatch = markdown.match(/```(?:js|javascript)\n([\s\S]*?)```/i);
  const bodyMatch = markdown.match(/```(?:html|jsx?)\n([\s\S]*?)```/i);

  return {
    html: bodyMatch?.[1]?.trim() ?? '',
    css: cssMatch?.[1]?.trim() ?? '',
    js: jsMatch?.[1]?.trim() ?? '',
  };
};

// 将 CodeParts 组合成完整可运行 HTML
const buildHtmlFromParts = (parts: CodeParts): string =>
  sanitizeHtml(`<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vibe UI Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" crossorigin="anonymous" />
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
  ${parts.css ? `<style>\n${parts.css}\n</style>` : ''}
</head>
<body>
${parts.html}
${parts.js ? `<script>\n${parts.js}\n<\/script>` : ''}
</body>
</html>`);

// 过滤掉 markdown 中的代码块，只保留文字说明
const stripCodeBlocks = (markdown: string): string =>
  markdown.replace(/```[\s\S]*?```/g, '').trim();

// ─── 场景分类提示词组件 ──────────────────────────────────────────────────────────

interface PromptCategory {
  label: { zh: string; en: string };
  icon: string;
  color: string;
  prompts: { zh: string; en: string }[];
}

const PromptCategoryList = ({
  categories,
  lang,
  onSelect,
}: {
  categories: PromptCategory[];
  lang: 'zh' | 'en';
  onSelect: (prompt: string) => void;
}) => {
  const [openCategory, setOpenCategory] = useState<number | null>(null);

  const handleToggle = (idx: number) => {
    setOpenCategory((prev) => (prev === idx ? null : idx));
  };

  return (
    <div className="flex flex-col gap-2 pt-1">
      <p className="text-xs text-gray-600 font-medium px-1 mb-1">
        {lang === 'zh' ? '选择场景快速开始' : 'Choose a scene to start'}
      </p>
      {categories.map((cat, idx) => (
        <div key={idx} className="rounded-xl border border-gray-800/80 overflow-hidden">
          {/* 分类标题 */}
          <button
            className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-all hover:bg-gray-800/60 ${
              openCategory === idx ? 'bg-gray-800/60' : 'bg-gray-900/40'
            }`}
            onClick={() => handleToggle(idx)}
            aria-label={`展开 ${lang === 'zh' ? cat.label.zh : cat.label.en}`}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleToggle(idx)}
          >
            <span className={`font-semibold ${cat.color.split(' ')[0]}`}>
              {lang === 'zh' ? cat.label.zh : cat.label.en}
            </span>
            <span
              className={`text-gray-600 transition-transform duration-200 ${
                openCategory === idx ? 'rotate-180' : ''
              }`}
            >
              ▾
            </span>
          </button>

          {/* 提示词列表 */}
          {openCategory === idx && (
            <div className="flex flex-col divide-y divide-gray-800/60">
              {cat.prompts.map((p, pIdx) => (
                <button
                  key={pIdx}
                  className="text-left text-xs text-gray-500 hover:text-gray-200 hover:bg-gray-800/80 px-3 py-2.5 transition-all flex items-start gap-2"
                  onClick={() => onSelect(lang === 'zh' ? p.zh : p.en)}
                  aria-label={lang === 'zh' ? p.zh : p.en}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onSelect(lang === 'zh' ? p.zh : p.en)}
                >
                  <span className="text-gray-700 flex-shrink-0 mt-0.5">›</span>
                  <span className="leading-relaxed">{lang === 'zh' ? p.zh : p.en}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
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
  if (msg.role === 'system') return null;

  const isUser = msg.role === 'user';
  // AI 消息过滤掉代码块，只展示文字说明
  const displayContent = isUser ? msg.content : stripCodeBlocks(msg.content);

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isUser ? 'bg-sky-600' : 'bg-violet-700'
        }`}
      >
        {isUser ? <User className="w-3.5 h-3.5 text-white" /> : <Sparkles className="w-3.5 h-3.5 text-white" />}
      </div>

      <div className={`flex-1 max-w-[88%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-sky-600 text-white rounded-tr-sm'
              : 'bg-gray-800/80 text-gray-200 rounded-tl-sm border border-gray-700/60'
          }`}
        >
          {displayContent ? (
            <p className="whitespace-pre-wrap">{displayContent}</p>
          ) : isStreaming ? (
            <span className="text-gray-500 text-xs">{lang === 'zh' ? '正在生成 UI...' : 'Generating UI...'}</span>
          ) : (
            <span className="text-gray-500 text-xs">{lang === 'zh' ? 'UI 已生成，请查看右侧预览' : 'UI generated, check preview on the right'}</span>
          )}
          {isStreaming && !isUser && (
            <span className="inline-block w-1 h-3.5 bg-violet-400 ml-1 animate-pulse rounded-sm align-middle" />
          )}
        </div>
        <span className="text-[10px] text-gray-600 px-1">
          {msg.provider && !isUser && (
            <span className="text-gray-600">{msg.provider} · </span>
          )}
          {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};

// ─── UI 预览面板 ───────────────────────────────────────────────────────────────

const CODE_TABS: { key: CodeTab; label: string; color: string; placeholder: string }[] = [
  { key: 'html', label: 'HTML', color: 'text-orange-400', placeholder: '<!-- HTML 结构 -->' },
  { key: 'css',  label: 'CSS',  color: 'text-sky-400',    placeholder: '/* CSS 样式 */' },
  { key: 'js',   label: 'JS',   color: 'text-yellow-400', placeholder: '// JavaScript 逻辑' },
];

const UIPreviewPanel = ({
  codeParts,
  lang,
  isStreaming,
  onCodePartsChange,
}: {
  codeParts: CodeParts | null;
  lang: 'zh' | 'en';
  isStreaming: boolean;
  onCodePartsChange: (parts: CodeParts) => void;
}) => {
  const [activeTab, setActiveTab] = useState<PreviewTab>('preview');
  const [activeCodeTab, setActiveCodeTab] = useState<CodeTab>('html');
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState(0);

  // 本地编辑状态（与父组件同步）
  const [localParts, setLocalParts] = useState<CodeParts>({ html: '', css: '', js: '' });

  useEffect(() => {
    if (codeParts) setLocalParts(codeParts);
  }, [codeParts]);

  // 写入 iframe
  const writeToIframe = useCallback((html: string) => {
    if (!iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
  }, []);

  useEffect(() => {
    if (codeParts) {
      writeToIframe(buildHtmlFromParts(codeParts));
    }
  }, [codeParts, iframeKey, writeToIframe]);

  const handleRun = () => {
    onCodePartsChange(localParts);
    writeToIframe(buildHtmlFromParts(localParts));
    setActiveTab('preview');
    setIframeKey((k) => k + 1);
  };

  const handleRefresh = () => setIframeKey((k) => k + 1);

  const handleCopy = async () => {
    const text = activeTab === 'preview'
      ? (codeParts ? buildHtmlFromParts(codeParts) : '')
      : localParts[activeCodeTab];
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCodeChange = (tab: CodeTab, value: string) => {
    setLocalParts((prev) => ({ ...prev, [tab]: value }));
  };

  const hasContent = !!codeParts;

  return (
    <div
      className={`flex flex-col bg-gray-950 ${
        isFullscreen ? 'fixed inset-0 z-50' : 'flex-1 min-w-0'
      }`}
    >
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 flex-shrink-0 bg-gray-900/60">
        {/* 主 Tab */}
        <div className="flex items-center gap-1 bg-gray-800/80 rounded-lg p-0.5">
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'preview' ? 'bg-violet-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('preview')}
            aria-label="预览 UI"
            tabIndex={0}
          >
            <Monitor className="w-3.5 h-3.5" />
            {lang === 'zh' ? '预览' : 'Preview'}
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'code' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('code')}
            aria-label="查看代码"
            tabIndex={0}
          >
            <Code2 className="w-3.5 h-3.5" />
            {lang === 'zh' ? '代码' : 'Code'}
          </button>
        </div>

        {/* 右侧操作 */}
        <div className="flex items-center gap-1">
          {isStreaming && (
            <span className="text-xs text-violet-400 flex items-center gap-1.5 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20 mr-1">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
              {lang === 'zh' ? '生成中...' : 'Generating...'}
            </span>
          )}
          {activeTab === 'code' && hasContent && (
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
              onClick={handleRun}
              aria-label="运行代码"
              tabIndex={0}
            >
              <Play className="w-3 h-3" />
              {lang === 'zh' ? '运行' : 'Run'}
            </button>
          )}
          {activeTab === 'preview' && hasContent && (
            <button
              className="btn-ghost p-1.5 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-800"
              onClick={handleRefresh}
              aria-label="刷新预览"
              tabIndex={0}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {hasContent && (
            <button
              className="btn-ghost p-1.5 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-800"
              onClick={handleCopy}
              aria-label="复制"
              tabIndex={0}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            className="btn-ghost p-1.5 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-800"
            onClick={() => setIsFullscreen((f) => !f)}
            aria-label={isFullscreen ? '退出全屏' : '全屏预览'}
            tabIndex={0}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 预览 Tab */}
        <div className={`flex-1 overflow-hidden ${activeTab === 'preview' ? 'flex' : 'hidden'}`}>
          {hasContent ? (
            <iframe
              ref={iframeRef}
              key={iframeKey}
              className="w-full h-full border-0 bg-white"
              title="UI Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full gap-5 p-8">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/10 to-sky-500/10 flex items-center justify-center border border-violet-500/20">
                <Monitor className="w-10 h-10 text-violet-500/40" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-gray-500 mb-2">
                  {lang === 'zh' ? 'UI 实时预览' : 'Live UI Preview'}
                </p>
                <p className="text-sm text-gray-600 max-w-xs">
                  {lang === 'zh'
                    ? '在左侧描述你想要的界面，AI 将生成可交互的 UI 并在此处实时渲染'
                    : 'Describe your UI on the left, AI will generate and render it here'}
                </p>
              </div>
              <div className="flex items-center gap-6 text-xs text-gray-700 mt-2">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-orange-500/50 rounded-full" />HTML</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-sky-500/50 rounded-full" />CSS</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-yellow-500/50 rounded-full" />JavaScript</span>
              </div>
            </div>
          )}
        </div>

        {/* 代码 Tab */}
        <div className={`flex-1 overflow-hidden flex flex-col ${activeTab === 'code' ? 'flex' : 'hidden'}`}>
          {/* 代码子 Tab */}
          <div className="flex items-center gap-0 border-b border-gray-800 bg-gray-900/40 flex-shrink-0 px-3">
            {CODE_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
                  activeCodeTab === tab.key
                    ? `border-current ${tab.color} bg-gray-800/40`
                    : 'border-transparent text-gray-600 hover:text-gray-400'
                }`}
                onClick={() => setActiveCodeTab(tab.key)}
                aria-label={`${tab.label} 代码`}
                tabIndex={0}
              >
                <span className={`w-2 h-2 rounded-full ${
                  tab.key === 'html' ? 'bg-orange-400' :
                  tab.key === 'css'  ? 'bg-sky-400' : 'bg-yellow-400'
                }`} />
                {tab.label}
                {localParts[tab.key] && (
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                )}
              </button>
            ))}
            <div className="ml-auto text-[10px] text-gray-700 py-2">
              {lang === 'zh' ? '编辑后点击「运行」刷新预览' : 'Edit then click "Run" to refresh'}
            </div>
          </div>

          {/* 代码编辑区 */}
          {CODE_TABS.map((tab) => (
            <div
              key={tab.key}
              className={`flex-1 overflow-hidden ${activeCodeTab === tab.key ? 'flex' : 'hidden'}`}
            >
              <textarea
                className="w-full h-full bg-gray-950 text-gray-200 text-xs font-mono p-4 resize-none outline-none border-0 leading-relaxed"
                value={localParts[tab.key]}
                onChange={(e) => handleCodeChange(tab.key, e.target.value)}
                placeholder={tab.placeholder}
                spellCheck={false}
                aria-label={`编辑 ${tab.label} 代码`}
                tabIndex={0}
              />
            </div>
          ))}
        </div>
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

  // UI 预览状态
  const [codeParts, setCodeParts] = useState<CodeParts | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchAgents({ limit: 100 }).then((r) => setAgents(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    setCodeParts(null);
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

    const userMsg: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);

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
            // 忽略解析错误
          }
        }
      }

      // 提取 HTML / CSS / JS 三段代码
      const parts = extractCodeParts(fullContent);
      if (parts.html || parts.css || parts.js) {
        setCodeParts(parts);
      }

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

  // ─── UI 示例提示词（按场景分类）────────────────────────────────────────────────

  interface PromptCategory {
    label: { zh: string; en: string };
    icon: string;
    color: string;
    prompts: { zh: string; en: string }[];
  }

  const promptCategories: PromptCategory[] = [
    {
      label: { zh: '📱 手机官网', en: '📱 Mobile Site' },
      icon: '📱',
      color: 'text-sky-400 border-sky-500/30 bg-sky-500/5',
      prompts: [
        {
          zh: '一个 iPhone 风格的手机产品官网，全屏 Hero 区域展示手机渲染图，特性介绍、规格参数、购买按钮，深色主题',
          en: 'An iPhone-style phone product website with full-screen hero, features, specs, buy button, dark theme',
        },
        {
          zh: '一个 App 应用落地页，顶部导航 + 大标题 + 手机截图展示 + 功能特性 + 用户评价 + 下载按钮',
          en: 'An app landing page with nav, hero title, phone screenshots, features, reviews, download buttons',
        },
        {
          zh: '一个智能手表产品官网，渐变背景，产品 3D 展示区，核心功能卡片，价格方案，底部 CTA',
          en: 'A smartwatch product site with gradient bg, 3D product showcase, feature cards, pricing, CTA',
        },
      ],
    },
    {
      label: { zh: '🖥️ 后台管理', en: '🖥️ Admin Panel' },
      icon: '🖥️',
      color: 'text-violet-400 border-violet-500/30 bg-violet-500/5',
      prompts: [
        {
          zh: '一个电商后台管理系统，左侧深色导航栏，顶部 Header，数据统计卡片（订单/收入/用户/商品），订单数据表格，带状态标签和操作按钮',
          en: 'An e-commerce admin panel with dark sidebar, header, stat cards (orders/revenue/users/products), order table with status badges',
        },
        {
          zh: '一个 SaaS 数据分析 Dashboard，深色主题，KPI 卡片，柱状图和折线图（用 CSS 模拟），用户活跃度热力图，最近活动列表',
          en: 'A SaaS analytics dashboard, dark theme, KPI cards, bar/line charts (CSS simulated), activity heatmap, recent activity list',
        },
        {
          zh: '一个用户管理后台，侧边栏导航，用户列表表格（头像/姓名/角色/状态/操作），搜索过滤，分页，新增用户弹窗',
          en: 'A user management admin with sidebar, user table (avatar/name/role/status/actions), search, pagination, add user modal',
        },
      ],
    },
    {
      label: { zh: '🛍️ 电商落地页', en: '🛍️ E-commerce' },
      icon: '🛍️',
      color: 'text-orange-400 border-orange-500/30 bg-orange-500/5',
      prompts: [
        {
          zh: '一个潮牌服装电商首页，全屏 Banner 轮播，分类导航，新品推荐卡片网格，限时促销倒计时，品牌故事区',
          en: 'A fashion brand e-commerce homepage with banner carousel, category nav, new arrivals grid, countdown sale, brand story',
        },
        {
          zh: '一个商品详情页，大图展示 + 缩略图切换，商品名称/价格/评分，规格选择（颜色/尺码），加入购物车，相关推荐',
          en: 'A product detail page with image gallery, name/price/rating, variant selector (color/size), add to cart, related products',
        },
      ],
    },
    {
      label: { zh: '🎨 创意设计', en: '🎨 Creative' },
      icon: '🎨',
      color: 'text-pink-400 border-pink-500/30 bg-pink-500/5',
      prompts: [
        {
          zh: '一个设计师作品集网站，全屏深色背景，网格作品展示，悬停放大效果，个人简介，联系方式',
          en: 'A designer portfolio site, full-screen dark bg, grid works, hover zoom, bio, contact',
        },
        {
          zh: '一个 SaaS 产品定价页，三档套餐卡片（免费/专业/企业），功能对比列表，高亮推荐套餐，FAQ 折叠区',
          en: 'A SaaS pricing page with 3 tiers (free/pro/enterprise), feature comparison, highlighted plan, FAQ accordion',
        },
        {
          zh: '一个深色主题音乐播放器，专辑封面，歌词滚动，进度条，播放控制，播放列表侧边栏',
          en: 'A dark music player with album art, scrolling lyrics, progress bar, controls, playlist sidebar',
        },
      ],
    },
    {
      label: { zh: '🛠️ 工具应用', en: '🛠️ Tools' },
      icon: '🛠️',
      color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5',
      prompts: [
        {
          zh: '一个 Todo 任务管理应用，支持添加/完成/删除/优先级，分类标签，进度统计，拖拽排序动画',
          en: 'A Todo app with add/complete/delete/priority, category tags, progress stats, drag sort animation',
        },
        {
          zh: '一个在线简历生成器，左侧表单填写（姓名/经历/技能），右侧实时预览简历，支持导出',
          en: 'An online resume builder with left form (name/experience/skills) and right live preview, export support',
        },
      ],
    },
  ];

  const hasMessages = messages.filter((m) => m.role !== 'system').length > 0;

  // ─── 渲染 ─────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* 左侧：对话侧边栏 */}
      <div className="flex flex-col w-[360px] flex-shrink-0 border-r border-gray-800 bg-gray-950">
        {/* 侧边栏顶部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-yellow-500/20 to-violet-500/20 flex items-center justify-center border border-yellow-500/20">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">Vibe Coding</h1>
              <p className="text-[10px] text-gray-600 mt-0.5">{lang === 'zh' ? 'UI 生成器' : 'UI Generator'}</p>
            </div>
          </div>
          {hasMessages && (
            <button
              className="btn-ghost p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800"
              onClick={handleNewSession}
              aria-label="新建会话"
              tabIndex={0}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 配置栏 */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-800/60 flex-shrink-0">
          {/* Agent 选择 */}
          <div className="relative flex-1">
            <button
              className="w-full btn-ghost text-xs flex items-center gap-1.5 justify-between bg-gray-800/60 rounded-lg px-2.5 py-1.5"
              onClick={() => setShowAgentPicker(!showAgentPicker)}
              aria-label="选择 Agent"
              tabIndex={0}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Bot className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                <span className="truncate text-gray-400">
                  {selectedAgentObj
                    ? (lang === 'zh' ? selectedAgentObj.name.zh : selectedAgentObj.name.en)
                    : (lang === 'zh' ? '默认 Agent' : 'Default Agent')}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 flex-shrink-0 text-gray-600" />
            </button>
            {showAgentPicker && (
              <div className="absolute left-0 top-full mt-1 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 max-h-52 overflow-y-auto">
                <button
                  className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-100"
                  onClick={() => { setSelectedAgent(''); setShowAgentPicker(false); }}
                >
                  {lang === 'zh' ? '不使用 Agent' : 'No Agent'}
                </button>
                {agents.map((a) => (
                  <button
                    key={a.slug}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-gray-100 flex items-center gap-2"
                    onClick={() => { setSelectedAgent(a.slug); setShowAgentPicker(false); }}
                  >
                    <span>{a.emoji}</span>
                    <span className="truncate">{lang === 'zh' ? a.name.zh : a.name.en}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Provider */}
          <button
            className={`btn-ghost text-[10px] flex items-center gap-1 px-2 py-1.5 rounded-lg bg-gray-800/60 flex-shrink-0 ${
              provider === 'ollama' ? 'text-emerald-400' : 'text-sky-400'
            }`}
            onClick={() => setProvider(provider === 'ollama' ? 'codebuddy' : 'ollama')}
            aria-label="切换提供商"
            tabIndex={0}
          >
            <Cpu className="w-3 h-3" />
            {provider === 'ollama' ? 'Ollama' : 'CB'}
          </button>

          {/* 模型类型 */}
          <button
            className={`btn-ghost text-[10px] flex items-center gap-1 px-2 py-1.5 rounded-lg bg-gray-800/60 flex-shrink-0 ${
              modelType === 'vision' ? 'text-violet-400' : 'text-gray-500'
            }`}
            onClick={() => setModelType(modelType === 'text' ? 'vision' : 'text')}
            aria-label="切换模型类型"
            tabIndex={0}
          >
            {modelType === 'vision' ? <Eye className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
            {modelType === 'vision' ? 'Vision' : 'Text'}
          </button>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {!hasMessages ? (
            <PromptCategoryList
              categories={promptCategories}
              lang={lang}
              onSelect={(prompt) => setInput(prompt)}
            />
          ) : (
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
        <div className="px-4 py-3 border-t border-gray-800 flex-shrink-0">
          <div className="flex gap-2 items-end bg-gray-800/80 rounded-xl border border-gray-700/80 focus-within:border-violet-500/50 px-3 py-2.5 transition-colors">
            <textarea
              ref={textareaRef}
              className="flex-1 bg-transparent text-gray-100 text-sm resize-none outline-none placeholder-gray-600 min-h-[22px] max-h-32"
              placeholder={
                hasMessages
                  ? (lang === 'zh' ? '继续修改...' : 'Continue editing...')
                  : (lang === 'zh' ? '描述你想要的界面...' : 'Describe your UI...')
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="输入 UI 描述"
              rows={1}
            />
            {streaming ? (
              <button
                className="flex-shrink-0 w-7 h-7 rounded-lg bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors"
                onClick={handleStop}
                aria-label="停止生成"
                tabIndex={0}
              >
                <span className="w-2.5 h-2.5 bg-white rounded-sm" />
              </button>
            ) : (
              <button
                className="flex-shrink-0 w-7 h-7 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                onClick={handleSend}
                disabled={!input.trim()}
                aria-label="生成 UI"
                tabIndex={0}
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-700 mt-1.5 text-center">
            Enter {lang === 'zh' ? '发送' : 'to send'} · Shift+Enter {lang === 'zh' ? '换行' : 'newline'}
          </p>
        </div>
      </div>

      {/* 右侧：UI 预览主区域 */}
      <UIPreviewPanel
        codeParts={codeParts}
        lang={lang}
        isStreaming={streaming}
        onCodePartsChange={setCodeParts}
      />
    </div>
  );
};

export default VibeCodingPage;
