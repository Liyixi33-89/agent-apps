import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Trash2, ChevronLeft, ChevronRight, Eye, X, CheckSquare, Square } from 'lucide-react';
import { fetchAdminChats, deleteChat } from '../api';

interface ChatMessage {
  role: string;
  content: string;
  timestamp?: string;
}

interface ChatItem {
  _id: string;
  sessionId: string;
  agentName?: string;
  title: string;
  provider: string;
  modelType: string;
  updatedAt: string;
  messages: ChatMessage[];
}

const ChatsAdminPage = () => {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [detailChat, setDetailChat] = useState<ChatItem | null>(null);

  const loadChats = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAdminChats({ page, limit: 20 });
      setChats(result.data);
      setTotal(result.pagination.total);
      setSelected(new Set());
    } catch (err) {
      console.error('Failed to load chats', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { loadChats(); }, [loadChats]);

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此对话记录？')) return;
    try {
      await deleteChat(id);
      await loadChats();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`确认删除选中的 ${selected.size} 条对话记录？`)) return;
    setDeleting(true);
    try {
      await Promise.all([...selected].map((id) => deleteChat(id)));
      await loadChats();
    } catch (err) {
      console.error('Batch delete failed', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selected.size === chats.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(chats.map((c) => c._id)));
    }
  };

  const totalPages = Math.ceil(total / 20);
  const allSelected = chats.length > 0 && selected.size === chats.length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-amber-400" />
          对话记录
          <span className="text-sm font-normal text-gray-500 ml-2">共 {total} 条</span>
        </h1>
        {selected.size > 0 && (
          <button
            className="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-900/20 text-sm"
            onClick={handleBatchDelete}
            disabled={deleting}
            aria-label="批量删除选中对话"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? '删除中...' : `删除选中 (${selected.size})`}
          </button>
        )}
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 w-10">
                  <button
                    onClick={handleSelectAll}
                    aria-label={allSelected ? '取消全选' : '全选'}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleSelectAll()}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {allSelected ? <CheckSquare className="w-4 h-4 text-sky-400" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Agent</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">最后消息</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">提供商</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">更新时间</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-800">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : chats.map((chat) => {
                const lastMsg = chat.messages?.[0];
                const isSelected = selected.has(chat._id);
                return (
                  <tr key={chat._id} className={`border-b border-gray-800 transition-colors ${isSelected ? 'bg-sky-900/10' : 'hover:bg-gray-800/30'}`}>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleSelect(chat._id)}
                        aria-label={isSelected ? '取消选择' : '选择'}
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleToggleSelect(chat._id)}
                        className="text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4 text-sky-400" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-200">{chat.agentName || 'AI Assistant'}</div>
                      <div className="text-xs text-gray-600 truncate max-w-32">{chat.sessionId.slice(0, 8)}...</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-400 truncate max-w-48">
                        {lastMsg?.content?.slice(0, 60) || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge bg-gray-800 text-gray-400">{chat.provider}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600">{new Date(chat.updatedAt).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="p-1.5 rounded-lg text-gray-500 hover:text-sky-400 hover:bg-sky-900/20 transition-colors"
                          onClick={() => setDetailChat(chat)}
                          onKeyDown={(e) => e.key === 'Enter' && setDetailChat(chat)}
                          aria-label="查看对话详情"
                          tabIndex={0}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                          onClick={() => handleDelete(chat._id)}
                          aria-label="删除对话"
                          tabIndex={0}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <span className="text-xs text-gray-500">第 {page} / {totalPages} 页</span>
            <div className="flex gap-2">
              <button className="btn-ghost text-xs px-2 py-1" disabled={page === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="w-4 h-4" /></button>
              <button className="btn-ghost text-xs px-2 py-1" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* 对话详情抽屉 */}
      {detailChat && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/60"
            onClick={() => setDetailChat(null)}
            role="button"
            tabIndex={0}
            aria-label="关闭详情"
            onKeyDown={(e) => e.key === 'Escape' && setDetailChat(null)}
          />
          <div className="w-full max-w-lg bg-gray-900 border-l border-gray-800 flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div>
                <h2 className="font-semibold text-gray-100 text-sm">{detailChat.agentName || 'AI Assistant'}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{detailChat.sessionId}</p>
              </div>
              <button
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                onClick={() => setDetailChat(null)}
                aria-label="关闭"
                tabIndex={0}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {detailChat.messages
                .filter((m) => m.role !== 'system')
                .map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-sky-600/30 text-sky-100 border border-sky-600/30'
                          : 'bg-gray-800 text-gray-300 border border-gray-700'
                      }`}
                    >
                      <div className="text-xs font-medium mb-1 opacity-60">
                        {msg.role === 'user' ? '用户' : 'AI'}
                      </div>
                      <div className="whitespace-pre-wrap break-words">{msg.content.slice(0, 500)}{msg.content.length > 500 ? '...' : ''}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatsAdminPage;
