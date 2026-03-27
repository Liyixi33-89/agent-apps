import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Button, Select, Space, Tag, Typography, Spin, Empty, Avatar,
} from 'antd';
import {
  PlusOutlined, RobotOutlined, UserOutlined,
  ApiOutlined, EyeOutlined,
} from '@ant-design/icons';
import { Bubble, Sender } from '@ant-design/x';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createChatSession, fetchChatSessions, fetchChatSession, fetchAgents } from '../api';
import { useAppStore } from '../store';
import type { ChatSession, ChatMessage, Agent, Provider, ModelType } from '../types';

const { Text } = Typography;

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

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || streaming || !currentSession) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
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
        body: JSON.stringify({ sessionId: currentSession.sessionId, message: content }),
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
              setStreamingContent(fullContent);
            } else if (parsed.type === 'done') {
              const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: fullContent,
                timestamp: new Date().toISOString(),
                provider,
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
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: '❌ 请求失败，请检查服务连接',
          timestamp: new Date().toISOString(),
        }]);
      }
    } finally {
      setStreaming(false);
      setStreamingContent('');
    }
  }, [input, streaming, currentSession, provider]);

  const agentOptions = [
    { value: '', label: lang === 'zh' ? '通用助手' : 'General Assistant' },
    ...agents.map((a) => ({
      value: a.slug,
      label: `${a.emoji} ${lang === 'zh' ? a.name.zh : a.name.en}`,
    })),
  ];

  // 构建 Bubble 消息列表
  const bubbleItems = messages
    .filter((m) => m.role !== 'system')
    .map((msg, i) => ({
      key: i,
      role: msg.role === 'user' ? 'user' : 'assistant',
      placement: msg.role === 'user' ? 'end' as const : 'start' as const,
      avatar: msg.role === 'user'
        ? <Avatar size={32} style={{ backgroundColor: '#0284c7' }} icon={<UserOutlined />} />
        : <Avatar size={32} style={{ backgroundColor: '#f1f5f9' }} icon={<RobotOutlined style={{ color: '#64748b' }} />} />,
      content: msg.role === 'user'
        ? msg.content
        : (
          <div className="prose-dark text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        ),
      styles: {
        content: msg.role === 'user'
          ? { background: '#0284c7', color: 'white', borderRadius: '16px 16px 4px 16px' }
          : { background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px 16px 16px 4px' },
      },
    }));

  // 流式消息
  if (streamingContent) {
    bubbleItems.push({
      key: bubbleItems.length,
      role: 'assistant',
      placement: 'start' as const,
      avatar: <Avatar size={32} style={{ backgroundColor: '#f1f5f9' }} icon={<RobotOutlined style={{ color: '#64748b' }} />} />,
      content: (
        <div className="prose-dark text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
          <span className="typing-cursor" />
        </div>
      ),
      styles: {
        content: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px 16px 16px 4px' },
      },
    });
  }

  return (
    <div className="flex h-full">
      {/* 会话列表 */}
      <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-slate-200">
        <div className="p-3 border-b border-slate-100">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            block
            onClick={handleNewSession}
            aria-label="新建对话"
          >
            {lang === 'zh' ? '新建对话' : 'New Chat'}
          </Button>
        </div>

        {/* Agent 选择 */}
        <div className="p-3 border-b border-slate-100">
          <Text type="secondary" className="text-xs block mb-1">Agent</Text>
          <Select
            value={selectedAgent}
            onChange={setSelectedAgent}
            options={agentOptions}
            size="small"
            className="w-full"
            aria-label="选择 Agent"
          />
        </div>

        {/* Provider 切换 */}
        <div className="p-3 border-b border-slate-100">
          <Space.Compact block>
            <Button
              size="small"
              type={provider === 'ollama' ? 'primary' : 'default'}
              onClick={() => setProvider('ollama')}
              className="flex-1"
            >
              🦙 Ollama
            </Button>
            <Button
              size="small"
              type={provider === 'codebuddy' ? 'primary' : 'default'}
              onClick={() => setProvider('codebuddy')}
              className="flex-1"
            >
              🤖 CB
            </Button>
          </Space.Compact>
        </div>

        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sessions.map((session) => (
            <button
              key={session._id}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                currentSession?.sessionId === session.sessionId
                  ? 'bg-sky-50 text-sky-600 border border-sky-100'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
              onClick={() => navigate(`/chat/${session.sessionId}`)}
            >
              <div className="font-medium truncate">{session.agentName || 'AI Assistant'}</div>
              <div className="text-slate-400 truncate mt-0.5">
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
            <Empty
              image={<RobotOutlined style={{ fontSize: 64, color: '#cbd5e1' }} />}
              description={
                <div className="text-center">
                  <Text className="text-lg font-semibold text-slate-700 block mb-1">
                    {lang === 'zh' ? '开始一个新对话' : 'Start a new conversation'}
                  </Text>
                  <Text type="secondary" className="text-sm block mb-4">
                    {lang === 'zh' ? '选择一个 Agent 或直接开始对话' : 'Select an agent or start chatting'}
                  </Text>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleNewSession}>
                    {lang === 'zh' ? '新建对话' : 'New Chat'}
                  </Button>
                </div>
              }
            />
          </div>
        ) : (
          <>
            {/* 对话头部 */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white shadow-sm">
              <Avatar size={32} style={{ backgroundColor: '#e0f2fe' }} icon={<RobotOutlined style={{ color: '#0284c7' }} />} />
              <div>
                <Text strong className="text-sm">{currentSession.agentName || 'AI Assistant'}</Text>
                <div className="flex items-center gap-2 mt-0.5">
                  <Tag icon={<ApiOutlined />} color="blue" className="text-xs m-0">{currentSession.provider}</Tag>
                  {currentSession.modelType === 'vision' && (
                    <Tag icon={<EyeOutlined />} color="purple" className="text-xs m-0">Vision</Tag>
                  )}
                </div>
              </div>
            </div>

            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              {streaming && !streamingContent && (
                <div className="flex justify-center py-2">
                  <Spin size="small" tip="思考中..." />
                </div>
              )}
              <Bubble.List
                items={bubbleItems}
                className="space-y-3"
              />
              <div ref={messagesEndRef} />
            </div>

            {/* 输入区 — 使用 Ant Design X Sender */}
            <div className="p-4 border-t border-slate-200 bg-white">
              <Sender
                value={input}
                onChange={setInput}
                onSubmit={(val) => handleSend(val)}
                loading={streaming}
                placeholder={lang === 'zh' ? '输入消息... (Enter 发送，Shift+Enter 换行)' : 'Type a message...'}
                submitType="enter"
                aria-label="消息输入框"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
