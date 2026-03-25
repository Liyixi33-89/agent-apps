import { useState, useEffect, useCallback } from 'react';
import { historyDB } from './db';
import type { VibeHistoryItem, CodeParts } from './types';

const MAX_HISTORY = 50; // 最多保留 50 条历史

export const useVibeHistory = () => {
  const [history, setHistory] = useState<VibeHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 初始化：从 IndexedDB 加载历史
  useEffect(() => {
    historyDB.getAll()
      .then((items) => {
        // 按时间倒序排列
        const sorted = items.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setHistory(sorted);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // 保存一条历史记录
  const saveHistory = useCallback(async (label: string, codeParts: CodeParts): Promise<VibeHistoryItem> => {
    const item: VibeHistoryItem = {
      id: `vibe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: label.slice(0, 40),
      codeParts,
      createdAt: new Date().toISOString(),
    };
    await historyDB.save(item);
    setHistory((prev) => {
      const next = [item, ...prev];
      // 超出上限时删除最旧的
      if (next.length > MAX_HISTORY) {
        const toRemove = next.slice(MAX_HISTORY);
        toRemove.forEach((r) => historyDB.remove(r.id).catch(console.error));
        return next.slice(0, MAX_HISTORY);
      }
      return next;
    });
    return item;
  }, []);

  // 删除一条历史记录
  const removeHistory = useCallback(async (id: string) => {
    await historyDB.remove(id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  }, []);

  // 清空所有历史
  const clearHistory = useCallback(async () => {
    await historyDB.clear();
    setHistory([]);
  }, []);

  return {
    history,
    loading,
    saveHistory,
    removeHistory,
    clearHistory,
  };
};
