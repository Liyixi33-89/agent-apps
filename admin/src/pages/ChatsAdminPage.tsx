import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchAdminChats, deleteChat } from '../api';

interface ChatItem {
  _id: string;
  sessionId: string;
  agentName?: string;
  title: string;
  provider: string;
  modelType: string;
  updatedAt: string;
  messages: Array<{ role: string; content: string }>;
}

const ChatsAdminPage = () => {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const loadChats = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAdminChats({ page, limit: 20 });
      setChats(result.data);
      setTotal(result.pagination.total);
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

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-amber-400" />
          对话记录
          <span className="text-sm font-normal text-gray-500 ml-2">共 {total} 条</span>
        </h1>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
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
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : chats.map((chat) => {
                const lastMsg = chat.messages?.[0];
                return (
                  <tr key={chat._id} className="table-row">
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
                      <button
                        className="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-900/20 text-xs px-2 py-1"
                        onClick={() => handleDelete(chat._id)}
                        aria-label="删除对话"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
    </div>
  );
};

export default ChatsAdminPage;
