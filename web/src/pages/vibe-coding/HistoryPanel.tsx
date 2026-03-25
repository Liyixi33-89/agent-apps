import { useState } from 'react';
import { Clock, Trash2, Globe, ChevronRight, RotateCcw, X } from 'lucide-react';
import type { VibeHistoryItem } from './types';

interface HistoryPanelProps {
  history: VibeHistoryItem[];
  lang: 'zh' | 'en';
  onRestore: (item: VibeHistoryItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onPublish: (item: VibeHistoryItem) => void;
  onClose: () => void;
}

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

const HistoryPanel = ({
  history,
  lang,
  onRestore,
  onRemove,
  onClear,
  onPublish,
  onClose,
}: HistoryPanelProps) => {
  const [confirmClear, setConfirmClear] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleClear = () => {
    if (confirmClear) {
      onClear();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* 面板头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">
            {lang === 'zh' ? '历史版本' : 'History'}
          </span>
          {history.length > 0 && (
            <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full">
              {history.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {history.length > 0 && (
            <button
              className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                confirmClear
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'text-gray-500 hover:text-red-400 hover:bg-gray-800'
              }`}
              onClick={handleClear}
              tabIndex={0}
              aria-label={lang === 'zh' ? '清空历史' : 'Clear history'}
            >
              {confirmClear
                ? (lang === 'zh' ? '确认清空' : 'Confirm')
                : (lang === 'zh' ? '清空' : 'Clear')}
            </button>
          )}
          <button
            className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            onClick={onClose}
            tabIndex={0}
            aria-label={lang === 'zh' ? '关闭' : 'Close'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 历史列表 */}
      <div className="flex-1 overflow-y-auto py-2 space-y-1 px-2">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center">
              <Clock className="w-5 h-5 text-gray-700" />
            </div>
            <p className="text-xs text-gray-600">
              {lang === 'zh' ? '暂无历史记录\n生成 UI 后自动保存' : 'No history yet\nAuto-saved after generation'}
            </p>
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              className="group relative rounded-xl border border-transparent hover:border-gray-700/60 hover:bg-gray-900/60 transition-all cursor-pointer"
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="flex items-start gap-3 p-3">
                {/* 时间线点 */}
                <div className="w-2 h-2 rounded-full bg-violet-500/40 mt-1.5 flex-shrink-0 group-hover:bg-violet-400 transition-colors" />

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 leading-relaxed line-clamp-2 group-hover:text-white transition-colors">
                    {item.label}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-gray-600">{formatTime(item.createdAt)}</span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className={`relative z-10 flex items-center gap-0.5 transition-opacity ${hoveredId === item.id ? 'opacity-100' : 'opacity-0'}`}>
                  <button
                    className="p-1.5 text-gray-500 hover:text-violet-400 rounded-lg hover:bg-violet-500/10 transition-colors"
                    onClick={() => onRestore(item)}
                    tabIndex={0}
                    aria-label={lang === 'zh' ? '恢复此版本' : 'Restore'}
                    title={lang === 'zh' ? '恢复此版本' : 'Restore'}
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                  <button
                    className="p-1.5 text-gray-500 hover:text-emerald-400 rounded-lg hover:bg-emerald-500/10 transition-colors"
                    onClick={() => onPublish(item)}
                    tabIndex={0}
                    aria-label={lang === 'zh' ? '发布到模板市场' : 'Publish'}
                    title={lang === 'zh' ? '发布到模板市场' : 'Publish to market'}
                  >
                    <Globe className="w-3 h-3" />
                  </button>
                  <button
                    className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                    onClick={() => onRemove(item.id)}
                    tabIndex={0}
                    aria-label={lang === 'zh' ? '删除' : 'Delete'}
                    title={lang === 'zh' ? '删除' : 'Delete'}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 恢复按钮（点击整行） */}
              <button
                className="absolute inset-0 w-full h-full opacity-0"
                onClick={() => onRestore(item)}
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
          ))
        )}
      </div>

      {/* 底部提示 */}
      {history.length > 0 && (
        <div className="px-4 py-2.5 border-t border-gray-800/60 flex-shrink-0">
          <p className="text-[10px] text-gray-600 flex items-center gap-1">
            <ChevronRight className="w-3 h-3" />
            {lang === 'zh' ? `最多保留 50 条，当前 ${history.length} 条` : `Up to 50 records, ${history.length} now`}
          </p>
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
