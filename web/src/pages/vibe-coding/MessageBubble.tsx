import { User, Sparkles } from 'lucide-react';
import { stripCodeBlocks } from './utils';
import type { ChatMessage } from '../../types';

interface MessageBubbleProps {
  msg: ChatMessage;
  lang: 'zh' | 'en';
  isStreaming?: boolean;
  isContinuing?: boolean;
}

const MessageBubble = ({ msg, lang, isStreaming, isContinuing }: MessageBubbleProps) => {
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
              : 'bg-gray-800 text-gray-200 rounded-tl-sm border border-gray-700/50'
          }`}
        >
          {displayContent ? (
            <p className="whitespace-pre-wrap">{displayContent}</p>
          ) : isStreaming ? (
            <span className="text-gray-400 text-xs">{lang === 'zh' ? '正在生成 UI...' : 'Generating UI...'}</span>
          ) : (
            <span className="text-gray-400 text-xs">{lang === 'zh' ? 'UI 已生成，请查看右侧预览' : 'UI generated, check preview on the right'}</span>
          )}
          {isStreaming && !isUser && (
            <span className="inline-block w-1 h-3.5 bg-violet-400 ml-1 animate-pulse rounded-sm align-middle" />
          )}
          {isContinuing && isStreaming && !isUser && (
            <span className="block mt-1.5 text-[10px] text-amber-400/80 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              {lang === 'zh' ? '内容较长，正在续写...' : 'Content long, continuing...'}
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-500 px-1">
          {msg.provider && !isUser && (
            <span className="text-gray-500">{msg.provider} · </span>
          )}
          {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};

export default MessageBubble;
