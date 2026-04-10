import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Button, Select, Space, Tag, Typography, Spin, Empty, Avatar,
  Popconfirm, Input, Tooltip, Drawer, message,
} from 'antd';
import {
  PlusOutlined, RobotOutlined, UserOutlined,
  ApiOutlined, EyeOutlined, DeleteOutlined, EditOutlined,
  CopyOutlined, StopOutlined, MenuOutlined, CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { Bubble, Sender } from '@ant-design/x';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  createChatSession, fetchChatSessions, fetchChatSession,
  fetchAgents, deleteChatSession, renameChatSession,
} from '../api';
import { useAppStore } from '../store';
import type { ChatSession, ChatMessage, Agent, Provider, ModelType } from '../types';
import MessageRating from '../components/MessageRating';

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
  const [activeSkill, setActiveSkill] = useState<{ name: string; key: string; confidence: number; method: string } | null>(null);
  const [skillSteps, setSkillSteps] = useState<Array<{ stepId: string; stepLabel: string; status: string; error?: string }>>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState(searchParams.get('agent') || '');
  const [provider, setProvider] = useState<Provider>(activeProvider);
  const [modelType, setModelType] = useState<ModelType>('text');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef(input);
  inputRef.current = input;

  // 缓存 remarkGfm 插件数组，避免每次渲染创建新引用导致 ReactMarkdown 重新解析
  const remarkPlugins = useMemo(() => [remarkGfm], []);

  // 消息列表最大数量，防止长对话内存无限增长
  const MAX_MESSAGES = 200;

  useEffect(() => {
    fetchChatSessions().then(setSessions).catch(() => {});
    fetchAgents({ limit: 100 }).then((r) => setAgents(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (paramSessionId) {
      fetchChatSession(paramSessionId).then((session) => {
        setCurrentSession(session);
        const filtered = session.messages.filter((m) => m.role !== 'system');
        // 只保留最近的 MAX_MESSAGES 条消息，防止内存溢出
        setMessages(filtered.length > MAX_MESSAGES ? filtered.slice(-MAX_MESSAGES) : filtered);
      }).catch(() => {});
    }
  }, [paramSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleNewSession = async () => {
    try {
      const session = await createChatSession({ agentSlug: selectedAgent || undefined, provider, modelType });
      const updatedSessions = await fetchChatSessions();
      setSessions(updatedSessions);
      setMobileDrawerOpen(false);
      navigate(`/chat/${session.sessionId}`);
    } catch {
      // 拦截器已处理错误
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteChatSession(sessionId);
      message.success('会话已删除');
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      if (currentSession?.sessionId === sessionId) {
        setCurrentSession(null);
        setMessages([]);
        navigate('/chat');
      }
    } catch {
      // 拦截器已处理错误
    }
  };

  const handleStartRename = (session: ChatSession) => {
    setEditingSessionId(session.sessionId);
    setEditingTitle(session.title || session.agentName || '');
  };

  const handleConfirmRename = async () => {
    if (!editingSessionId || !editingTitle.trim()) return;
    try {
      await renameChatSession(editingSessionId, editingTitle.trim());
      setSessions((prev) =>
        prev.map((s) =>
          s.sessionId === editingSessionId ? { ...s, title: editingTitle.trim() } : s
        )
      );
      if (currentSession?.sessionId === editingSessionId) {
        setCurrentSession({ ...currentSession, title: editingTitle.trim() });
      }
      message.success('已重命名');
    } catch {
      // 拦截器已处理错误
    } finally {
      setEditingSessionId(null);
      setEditingTitle('');
    }
  };

  const handleCancelRename = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const handleStopGeneration = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setStreaming(false);
      setActiveSkill(null);
      setSkillSteps([]);
      if (streamingContent) {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: streamingContent + '\n\n*（已停止生成）*',
          timestamp: new Date().toISOString(),
          provider,
        }]);
        setStreamingContent('');
      }
    }
  };

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? inputRef.current).trim();
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
    setActiveSkill(null);
    setSkillSteps([]);
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
            } else if (parsed.type === 'skill_match') {
              // Skill 匹配成功
              setActiveSkill({
                name: parsed.skillName,
                key: parsed.skillKey,
                confidence: parsed.confidence,
                method: parsed.method,
              });
            } else if (parsed.type === 'skill_step') {
              // Skill 步骤执行进度
              setSkillSteps((prev) => {
                const existing = prev.findIndex((s) => s.stepId === parsed.stepId);
                const step = { stepId: parsed.stepId, stepLabel: parsed.stepLabel, status: parsed.status, error: parsed.error };
                if (existing >= 0) {
                  const updated = [...prev];
                  updated[existing] = step;
                  return updated;
                }
                return [...prev, step];
              });
            } else if (parsed.type === 'skill_result') {
              // Skill 执行完成
              console.log(`[Skill] ${parsed.skillName} 执行${parsed.success ? '成功' : '失败'} (${parsed.duration}ms)`);
            } else if (parsed.type === 'skill_fallback') {
              // Skill 执行失败，降级到普通 Chat
              setActiveSkill(null);
              setSkillSteps([]);
            } else if (parsed.type === 'done') {
              const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: fullContent || parsed.content || '',
                timestamp: new Date().toISOString(),
                provider,
              };
              setMessages((prev) => [...prev, assistantMessage]);
              setStreamingContent('');
              setActiveSkill(null);
              setSkillSteps([]);
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
      setActiveSkill(null);
      setSkillSteps([]);
    }
  }, [streaming, currentSession, provider]);

  const agentOptions = useMemo(() => [
    { value: '', label: lang === 'zh' ? '通用助手' : 'General Assistant' },
    ...agents.map((a) => ({
      value: a.slug,
      label: `${a.emoji} ${lang === 'zh' ? a.name.zh : a.name.en}`,
    })),
  ], [agents, lang]);

  // 构建 Bubble 消息列表（使用 useMemo 缓存，避免输入时重新计算所有消息的 Markdown）
  const bubbleItems = useMemo(() => messages
    .filter((m) => m.role !== 'system')
    .map((msg, i) => ({
      key: i,
      role: msg.role === 'user' ? 'user' : 'assistant',
      placement: msg.role === 'user' ? 'end' as const : 'start' as const,
      avatar: msg.role === 'user'
        ? <Avatar size={32} style={{ backgroundColor: '#0284c7' }} icon={<UserOutlined />} />
        : <Avatar size={32} style={{ backgroundColor: '#f1f5f9' }} icon={<RobotOutlined style={{ color: '#64748b' }} />} />,
      content: msg.role === 'user'
        ? (
          <div className="group relative">
            {msg.content}
            <Tooltip title="复制">
              <button
                className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-white shadow-sm border border-slate-200 text-slate-400 hover:text-sky-500"
                onClick={() => handleCopyMessage(msg.content)}
                aria-label="复制消息"
                tabIndex={0}
              >
                <CopyOutlined style={{ fontSize: 12 }} />
              </button>
            </Tooltip>
          </div>
        )
        : (
          <div className="group relative prose-dark text-sm">
            <ReactMarkdown remarkPlugins={remarkPlugins}>{msg.content}</ReactMarkdown>
            <Tooltip title="复制">
              <button
                className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-white shadow-sm border border-slate-200 text-slate-400 hover:text-sky-500"
                onClick={() => handleCopyMessage(msg.content)}
                aria-label="复制消息"
                tabIndex={0}
              >
                <CopyOutlined style={{ fontSize: 12 }} />
              </button>
            </Tooltip>
            <MessageRating
              agentSlug={selectedAgent || 'default'}
              chatId={currentSession?.sessionId}
              messageId={`msg_${i}`}
              userInput={messages.filter((m) => m.role !== 'system')[i - 1]?.content || ''}
              agentOutput={msg.content}
            />
          </div>
        ),
      styles: {
        content: msg.role === 'user'
          ? { background: '#0284c7', color: 'white', borderRadius: '16px 16px 4px 16px' }
          : { background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px 16px 16px 4px' },
      },
    })), [messages, remarkPlugins]);

  // 最终气泡列表：基础消息 + Skill 状态 + 流式消息（仅在流式/Skill 状态变化时重新计算，输入时不触发）
  const finalBubbleItems = useMemo(() => {
    const items = [...bubbleItems];

    // Skill 执行状态指示器
    if (activeSkill && streaming) {
      items.push({
        key: items.length + 9000,
        role: 'assistant',
        placement: 'start' as const,
        avatar: <Avatar size={32} style={{ backgroundColor: '#fef3c7' }} icon={<span style={{ fontSize: 16 }}>🎯</span>} />,
        content: (
          <div className="text-sm">
            <div className="flex items-center gap-2 mb-2">
              <Tag color="orange" className="m-0">Skill</Tag>
              <span className="font-medium text-slate-700">{activeSkill.name}</span>
              <Tag color="blue" className="m-0 text-xs">{activeSkill.method}</Tag>
            </div>
            {skillSteps.length > 0 && (
              <div className="space-y-1 mt-2">
                {skillSteps.map((step) => (
                  <div key={step.stepId} className="flex items-center gap-2 text-xs">
                    {step.status === 'running' ? (
                      <Spin size="small" />
                    ) : step.status === 'success' ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <span className="text-red-500">✗</span>
                    )}
                    <span className={step.status === 'failed' ? 'text-red-500' : 'text-slate-600'}>
                      {step.stepLabel}
                    </span>
                    {step.error && <span className="text-red-400 text-xs">({step.error})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ),
        styles: {
          content: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '16px 16px 16px 4px' },
        },
      });
    }

    // 流式消息
    if (streamingContent) {
      items.push({
        key: items.length,
        role: 'assistant',
        placement: 'start' as const,
        avatar: activeSkill
          ? <Avatar size={32} style={{ backgroundColor: '#fef3c7' }} icon={<span style={{ fontSize: 16 }}>🎯</span>} />
          : <Avatar size={32} style={{ backgroundColor: '#f1f5f9' }} icon={<RobotOutlined style={{ color: '#64748b' }} />} />,
        content: (
          <div className="prose-dark text-sm">
            <ReactMarkdown remarkPlugins={remarkPlugins}>{streamingContent}</ReactMarkdown>
            <span className="typing-cursor" />
          </div>
        ),
        styles: {
          content: activeSkill
            ? { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '16px 16px 16px 4px' }
            : { background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px 16px 16px 4px' },
        },
      });
    }

    return items;
  }, [bubbleItems, activeSkill, streaming, skillSteps, streamingContent, remarkPlugins]);

  // 会话列表侧边栏内容（桌面端和移动端共用）
  const sessionSidebar = (
    <>
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
            type={provider === 'openai' ? 'primary' : 'default'}
            onClick={() => setProvider('openai')}
            className="flex-1"
          >
            🤖 OpenAI
          </Button>
        </Space.Compact>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            {lang === 'zh' ? '暂无对话记录' : 'No conversations yet'}
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session._id}
              className={`group relative w-full text-left px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                currentSession?.sessionId === session.sessionId
                  ? 'bg-sky-50 text-sky-600 border border-sky-100'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
              onClick={() => {
                navigate(`/chat/${session.sessionId}`);
                setMobileDrawerOpen(false);
              }}
              role="button"
              tabIndex={0}
              aria-label={`切换到会话: ${session.title || session.agentName}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  navigate(`/chat/${session.sessionId}`);
                  setMobileDrawerOpen(false);
                }
              }}
            >
              {editingSessionId === session.sessionId ? (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Input
                    size="small"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onPressEnter={handleConfirmRename}
                    autoFocus
                    className="text-xs"
                    aria-label="重命名会话"
                  />
                  <Button size="small" type="text" icon={<CheckOutlined />} onClick={handleConfirmRename} aria-label="确认" />
                  <Button size="small" type="text" icon={<CloseOutlined />} onClick={handleCancelRename} aria-label="取消" />
                </div>
              ) : (
                <>
                  <div className="font-medium truncate pr-12">
                    {session.title || session.agentName || 'AI Assistant'}
                  </div>
                  <div className="text-slate-400 truncate mt-0.5">
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </div>
                  {/* 操作按钮 */}
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                    <Tooltip title={lang === 'zh' ? '重命名' : 'Rename'}>
                      <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined style={{ fontSize: 11 }} />}
                        className="!w-6 !h-6 !min-w-0 text-slate-400 hover:text-sky-500"
                        onClick={(e) => { e.stopPropagation(); handleStartRename(session); }}
                        aria-label="重命名会话"
                      />
                    </Tooltip>
                    <Popconfirm
                      title="确定删除此会话？"
                      onConfirm={(e) => { e?.stopPropagation(); handleDeleteSession(session.sessionId); }}
                      onCancel={(e) => e?.stopPropagation()}
                      okText="删除"
                      cancelText="取消"
                      placement="right"
                    >
                      <Tooltip title={lang === 'zh' ? '删除' : 'Delete'}>
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<DeleteOutlined style={{ fontSize: 11 }} />}
                          className="!w-6 !h-6 !min-w-0"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="删除会话"
                        />
                      </Tooltip>
                    </Popconfirm>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-full">
      {/* 桌面端会话列表 */}
      <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-slate-200">
        {sessionSidebar}
      </aside>

      {/* 移动端会话列表抽屉 */}
      <Drawer
        placement="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        width={260}
        styles={{ body: { padding: 0 } }}
        className="lg:hidden"
        title={lang === 'zh' ? '对话列表' : 'Conversations'}
      >
        <div className="flex flex-col h-full">
          {sessionSidebar}
        </div>
      </Drawer>

      {/* 聊天区域 */}
      <div className="flex-1 flex flex-col min-w-0">
        {!currentSession ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
            {/* 移动端菜单按钮 */}
            <div className="lg:hidden absolute top-4 left-4">
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="打开会话列表"
              />
            </div>
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
              {/* 移动端菜单按钮 */}
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMobileDrawerOpen(true)}
                className="lg:hidden"
                aria-label="打开会话列表"
              />
              <Avatar size={32} style={{ backgroundColor: '#e0f2fe' }} icon={<RobotOutlined style={{ color: '#0284c7' }} />} />
              <div className="flex-1 min-w-0">
                <Text strong className="text-sm truncate block">
                  {currentSession.title || currentSession.agentName || 'AI Assistant'}
                </Text>
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
                items={finalBubbleItems}
                className="space-y-3"
              />
              <div ref={messagesEndRef} />
            </div>

            {/* 输入区 */}
            <div className="p-4 border-t border-slate-200 bg-white">
              {streaming && (
                <div className="flex justify-center mb-2">
                  <Button
                    size="small"
                    icon={<StopOutlined />}
                    onClick={handleStopGeneration}
                    danger
                    aria-label="停止生成"
                  >
                    {lang === 'zh' ? '停止生成' : 'Stop'}
                  </Button>
                </div>
              )}
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
