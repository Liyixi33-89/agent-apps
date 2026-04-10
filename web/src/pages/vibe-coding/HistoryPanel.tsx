import { useState, useMemo } from 'react';
import { Clock, Trash2, Globe, ChevronRight, RotateCcw, X, GitCompare } from 'lucide-react';
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

// ─── 简易 Diff 算法（逐行对比） ──────────────────────────────────────────────

interface DiffLine {
  type: 'same' | 'add' | 'remove';
  content: string;
  lineNum?: number;
}

const computeLineDiff = (oldText: string, newText: string): DiffLine[] => {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: DiffLine[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);
  let oi = 0;
  let ni = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    if (oi >= oldLines.length) {
      result.push({ type: 'add', content: newLines[ni], lineNum: ni + 1 });
      ni++;
    } else if (ni >= newLines.length) {
      result.push({ type: 'remove', content: oldLines[oi], lineNum: oi + 1 });
      oi++;
    } else if (oldLines[oi] === newLines[ni]) {
      result.push({ type: 'same', content: oldLines[oi], lineNum: ni + 1 });
      oi++;
      ni++;
    } else {
      let foundInNew = -1;
      let foundInOld = -1;
      const lookAhead = Math.min(5, maxLen);
      for (let k = 1; k <= lookAhead; k++) {
        if (ni + k < newLines.length && oldLines[oi] === newLines[ni + k]) { foundInNew = ni + k; break; }
        if (oi + k < oldLines.length && oldLines[oi + k] === newLines[ni]) { foundInOld = oi + k; break; }
      }
      if (foundInNew > -1) {
        for (let k = ni; k < foundInNew; k++) result.push({ type: 'add', content: newLines[k], lineNum: k + 1 });
        ni = foundInNew;
      } else if (foundInOld > -1) {
        for (let k = oi; k < foundInOld; k++) result.push({ type: 'remove', content: oldLines[k], lineNum: k + 1 });
        oi = foundInOld;
      } else {
        result.push({ type: 'remove', content: oldLines[oi], lineNum: oi + 1 });
        result.push({ type: 'add', content: newLines[ni], lineNum: ni + 1 });
        oi++;
        ni++;
      }
    }
  }
  return result;
};

// ─── Diff 对比视图组件 ───────────────────────────────────────────────────────

const DiffView = ({
  oldItem, newItem, lang, onClose,
}: {
  oldItem: VibeHistoryItem; newItem: VibeHistoryItem; lang: 'zh' | 'en'; onClose: () => void;
}) => {
  const [codeType, setCodeType] = useState<'html' | 'css' | 'js' | 'jsx'>('html');

  const getCode = (item: VibeHistoryItem, type: string): string => {
    if (type === 'jsx' && item.codeParts.jsx) return item.codeParts.jsx;
    if (type === 'html') return item.codeParts.html || '';
    if (type === 'css') return item.codeParts.css || '';
    if (type === 'js') return item.codeParts.js || '';
    return '';
  };

  const diffLines = useMemo(
    () => computeLineDiff(getCode(oldItem, codeType), getCode(newItem, codeType)),
    [oldItem, newItem, codeType]
  );

  const stats = useMemo(() => ({
    added: diffLines.filter((l) => l.type === 'add').length,
    removed: diffLines.filter((l) => l.type === 'remove').length,
  }), [diffLines]);

  const tabs = ['html', 'css', 'js'];
  if (newItem.codeParts.jsx || oldItem.codeParts.jsx) tabs.push('jsx');

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">{lang === 'zh' ? '版本对比' : 'Version Diff'}</span>
          <span className="text-[10px] text-green-400">+{stats.added}</span>
          <span className="text-[10px] text-red-400">-{stats.removed}</span>
        </div>
        <button className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800 transition-colors" onClick={onClose} tabIndex={0} aria-label="Close diff">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800/60 text-[10px]">
        <span className="text-red-400">◀ {oldItem.label.slice(0, 25)}</span>
        <span className="text-gray-600">vs</span>
        <span className="text-green-400">{newItem.label.slice(0, 25)} ▶</span>
      </div>
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800/60">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`px-2.5 py-1 text-[10px] rounded-md transition-colors ${codeType === tab ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'}`}
            onClick={() => setCodeType(tab as typeof codeType)}
            tabIndex={0}
            aria-label={`View ${tab} diff`}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto font-mono text-[11px] leading-5">
        {diffLines.map((line, i) => (
          <div key={i} className={`flex px-2 ${line.type === 'add' ? 'bg-green-500/10 text-green-300' : line.type === 'remove' ? 'bg-red-500/10 text-red-300' : 'text-gray-500'}`}>
            <span className="w-8 text-right pr-2 select-none opacity-40 flex-shrink-0">{line.lineNum || ''}</span>
            <span className="w-4 flex-shrink-0 select-none">{line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}</span>
            <span className="whitespace-pre-wrap break-all">{line.content}</span>
          </div>
        ))}
        {diffLines.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            {lang === 'zh' ? '两个版本完全相同' : 'No differences'}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 主面板 ──────────────────────────────────────────────────────────────────

const HistoryPanel = ({
  history, lang, onRestore, onRemove, onClear, onPublish, onClose,
}: HistoryPanelProps) => {
  const [confirmClear, setConfirmClear] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [diffPair, setDiffPair] = useState<[VibeHistoryItem, VibeHistoryItem] | null>(null);
  const [diffSelectMode, setDiffSelectMode] = useState(false);
  const [diffFirstItem, setDiffFirstItem] = useState<VibeHistoryItem | null>(null);

  const handleClear = () => {
    if (confirmClear) {
      onClear();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  const handleDiffSelect = (item: VibeHistoryItem) => {
    if (!diffFirstItem) {
      setDiffFirstItem(item);
    } else {
      const first = new Date(diffFirstItem.createdAt) < new Date(item.createdAt) ? diffFirstItem : item;
      const second = first === diffFirstItem ? item : diffFirstItem;
      setDiffPair([first, second]);
      setDiffSelectMode(false);
      setDiffFirstItem(null);
    }
  };

  // 显示 Diff 视图
  if (diffPair) {
    return <DiffView oldItem={diffPair[0]} newItem={diffPair[1]} lang={lang} onClose={() => setDiffPair(null)} />;
  }

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
          {history.length > 1 && (
            <button
              className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                diffSelectMode
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-gray-500 hover:text-amber-400 hover:bg-gray-800'
              }`}
              onClick={() => { setDiffSelectMode(!diffSelectMode); setDiffFirstItem(null); }}
              tabIndex={0}
              aria-label={lang === 'zh' ? '版本对比' : 'Compare versions'}
            >
              {diffSelectMode
                ? (diffFirstItem ? (lang === 'zh' ? '选第二个' : 'Select 2nd') : (lang === 'zh' ? '选第一个' : 'Select 1st'))
                : (lang === 'zh' ? '对比' : 'Diff')}
            </button>
          )}
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
              {confirmClear ? (lang === 'zh' ? '确认清空' : 'Confirm') : (lang === 'zh' ? '清空' : 'Clear')}
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

      {/* Diff 选择提示 */}
      {diffSelectMode && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[10px] text-amber-400 flex items-center gap-2">
          <GitCompare className="w-3 h-3" />
          {diffFirstItem
            ? `已选「${diffFirstItem.label.slice(0, 20)}」，请点击第二个版本`
            : '请点击要对比的第一个版本'}
        </div>
      )}

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
              className={`group relative rounded-xl border transition-all cursor-pointer ${
                diffSelectMode
                  ? (diffFirstItem?.id === item.id
                      ? 'border-amber-500/60 bg-amber-500/10'
                      : 'border-transparent hover:border-amber-500/40 hover:bg-amber-500/5')
                  : 'border-transparent hover:border-gray-700/60 hover:bg-gray-900/60'
              }`}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={diffSelectMode ? () => handleDiffSelect(item) : undefined}
            >
              <div className="flex items-start gap-3 p-3">
                <div className="w-2 h-2 rounded-full bg-violet-500/40 mt-1.5 flex-shrink-0 group-hover:bg-violet-400 transition-colors" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 leading-relaxed line-clamp-2 group-hover:text-white transition-colors">
                    {item.label}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-gray-600">{formatTime(item.createdAt)}</span>
                  </div>
                </div>
                {!diffSelectMode && (
                  <div className={`relative z-10 flex items-center gap-0.5 transition-opacity ${hoveredId === item.id ? 'opacity-100' : 'opacity-0'}`}>
                    <button className="p-1.5 text-gray-500 hover:text-violet-400 rounded-lg hover:bg-violet-500/10 transition-colors" onClick={() => onRestore(item)} tabIndex={0} aria-label={lang === 'zh' ? '恢复此版本' : 'Restore'} title={lang === 'zh' ? '恢复此版本' : 'Restore'}>
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    <button className="p-1.5 text-gray-500 hover:text-emerald-400 rounded-lg hover:bg-emerald-500/10 transition-colors" onClick={() => onPublish(item)} tabIndex={0} aria-label={lang === 'zh' ? '发布应用' : 'Publish App'} title={lang === 'zh' ? '发布应用' : 'Publish App'}>
                      <Globe className="w-3 h-3" />
                    </button>
                    <button className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors" onClick={() => onRemove(item.id)} tabIndex={0} aria-label={lang === 'zh' ? '删除' : 'Delete'} title={lang === 'zh' ? '删除' : 'Delete'}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              {!diffSelectMode && (
                <button className="absolute inset-0 w-full h-full opacity-0" onClick={() => onRestore(item)} tabIndex={-1} aria-hidden="true" />
              )}
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
