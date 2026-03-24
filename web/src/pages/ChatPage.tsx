import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Send, Plus, Bot, User, Cpu, Eye, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createChatSession, fetchChatSessions, fetchChatSession, fetchAgents } from '../api';
import { useAppStore } from '../store';
import type { ChatSession, ChatMessage, Agent, Provider, ModelType } from '../types';

const MessageBubble = ({ message, lang }: { message: ChatMessage; lang: 'zh' | 'en' }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) return null;

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-slide-up`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-sky-600' : 'bg-gray-700'}`}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-gray-300" />}
      </div>
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`rounded-2xl px-4 py-3 text-sm ${isUser ? 'bg-sky-600 text-white rounded-tr-sm' : 'bg-gray-800 text-gray-200 rounded-tl-sm'}`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-dark">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
          {message.provider && <span>{message.provider}</span>}
        </div>
      </div>
    </div>
  );
};

const ChatPage = () => {
  const { sessionId: paramSessionId } = useParams<{ sessionId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { lang, activeProvider } = useAppStore();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState(searchParams.get('agent') || '');
  const [provider, setProvider] = useState<Provider>(activeProvider);
  const [modelType, setModelType] = useState<ModelType>('text');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchChatSessions().then(setSessions).catch(console.error);
    fetchAgents({ limit: 100 }).then((r) => setAgents(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (paramSessionId) {
      fetchChatSession(paramSessionId).then((session) => {
        setCurrentSession(session);
        setMessages(session.messages.filter((m) => m.role !== 'system'));
      }).catch(console.error);
    }
  }, [paramSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleNewSession = async () => {
    try {
      const session = await createChatSession({ agentSlug: selectedAgent || undefined, provider, modelType });
      await fetchChatSessions().then(setSessions);
      navigate(`/chat/${session.sessionId}`);
    } catch (err) {
      console.error('Failed to create session', err);
    }
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || streaming || !currentSession) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setStreaming(true);
    setStreamingContent('');
    abortRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSession.sessionId, message: userMessage.content }),
        signal: abortRef.current.signal
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
              setStreamingContent(fullContent);
            } else if (parsed.type === 'done') {
              const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: fullContent,
                timestamp: new Date().toISOString(),
                provider
              };
              setMessages((prev) => [...prev, assistantMessage]);
              setStreamingContent('');
            }
          } catch {
            // 忽略
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => [...prev, { role: 'assistant', content: '❌ 请求失败，请检查服务连接', timestamp: new Date().toISOString() }]);
      }
    } finally {
      setStreaming(false);
      setStreamingContent('');
    }
  }, [input, streaming, currentSession, provider]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full">
      {/* 会话列表 */}
      <aside className="hidden lg:flex flex-col w-56 bg-gray-900 border-r border-gray-800">
        <div className="p-3 border-b border-gray-800">
          <button
            className="btn-primary w-full text-sm justify-center"
            onClick={handleNewSession}
            aria-label="新建对话"
          >
            <Plus className="w-4 h-4" />
            {lang === 'zh' ? '新建对话' : 'New Chat'}
          </button>
        </div>

        {/* Agent 选择 */}
        <div className="p-3 border-b border-gray-800">
          <label className="text-xs text-gray-500 mb-1 block">Agent</label>
          <select
            className="input text-xs py-1.5"
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            aria-label="选择 Agent"
          >
            <option value="">{lang === 'zh' ? '通用助手' : 'General Assistant'}</option>
            {agents.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.emoji} {lang === 'zh' ? a.name.zh : a.name.en}
              </option>
            ))}
          </select>
        </div>

        {/* Provider 和模型类型 */}
        <div className="p-3 border-b border-gray-800 flex gap-2">
          <button
            className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${provider === 'ollama' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-gray-800 text-gray-400'}`}
            onClick={() => setProvider('ollama')}
          >
            🦙 Ollama
          </button>
          <button
            className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${provider === 'codebuddy' ? 'bg-sky-600/20 text-sky-400' : 'bg-gray-800 text-gray-400'}`}
            onClick={() => setProvider('codebuddy')}
          >
            🤖 CB
          </button>
        </div>

        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map((session) => (
            <button
              key={session._id}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${currentSession?.sessionId === session.sessionId ? 'bg-sky-600/20 text-sky-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
              onClick={() => navigate(`/chat/${session.sessionId}`)}
            >
              <div className="font-medium truncate">{session.agentName || 'AI Assistant'}</div>
              <div className="text-gray-600 truncate mt-0.5">
                {new Date(session.updatedAt).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* 聊天区域 */}
      <div className="flex-1 flex flex-col min-w-0">
        {!currentSession ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
            <MessageSquare className="w-16 h-16 text-gray-700" />
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-300 mb-1">
                {lang === 'zh' ? '开始一个新对话' : 'Start a new conversation'}
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                {lang === 'zh' ? '选择一个 Agent 或直接开始对话' : 'Select an agent or start chatting'}
              </p>
              <button className="btn-primary" onClick={handleNewSession}>
                <Plus className="w-4 h-4" />
                {lang === 'zh' ? '新建对话' : 'New Chat'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 对话头部 */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900">
              <Bot className="w-5 h-5 text-sky-400" />
              <div>
                <div className="text-sm font-medium text-gray-200">{currentSession.agentName || 'AI Assistant'}</div>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <Cpu className="w-3 h-3" />
                  {currentSession.provider}
                  {currentSession.modelType === 'vision' && <><Eye className="w-3 h-3" /> Vision</>}
                </div>
              </div>
            </div>

            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} lang={lang} />
              ))}

              {/* 流式输出 */}
              {streamingContent && (
                <div className="flex gap-3 animate-slide-up">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-gray-300" />
                  </div>
                  <div className="max-w-[75%] bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-200">
                    <div className="prose-dark">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                    </div>
                    <span className="typing-cursor" />
                  </div>
                </div>
              )}

              {streaming && !streamingContent && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-gray-300" />
                  </div>
                  <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* 输入区 */}
            <div className="p-4 border-t border-gray-800 bg-gray-900">
              <div className="flex gap-2 items-end">
                <textarea
                  className="input flex-1 resize-none min-h-10 max-h-32 text-sm"
                  placeholder={lang === 'zh' ? '输入消息... (Enter 发送，Shift+Enter 换行)' : 'Type a message... (Enter to send, Shift+Enter for newline)'}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  aria-label="消息输入框"
                />
                <button
                  className="btn-primary h-10 px-3 flex-shrink-0"
                  onClick={handleSend}
                  disabled={!input.trim() || streaming}
                  aria-label="发送消息"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
