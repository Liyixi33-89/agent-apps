/**
 * @file services/knowledgeScheduler.ts
 * @description 知识库定时更新服务 — URL 类型知识源自动爬取更新
 *
 * 功能：
 *   1. 定时检查所有 sourceType='url' 的知识库条目
 *   2. 重新抓取 URL 内容，与现有内容对比
 *   3. 如果内容有变化，自动更新知识块
 *   4. 支持手动触发单个/全部 URL 知识源更新
 */

import axios from 'axios';
import { KnowledgeBase } from '../models/KnowledgeBase.js';
import { createKnowledgeEntry } from './knowledgeService.js';
import { v4 as uuidv4 } from 'uuid';

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

export interface UrlUpdateResult {
  knowledgeId: string;
  title: string;
  url: string;
  status: 'updated' | 'unchanged' | 'error';
  message?: string;
  newWordCount?: number;
  newChunkCount?: number;
}

// ─── URL 内容抓取 ─────────────────────────────────────────────────────────────

/**
 * 抓取 URL 内容并提取纯文本
 */
const fetchUrlContent = async (url: string): Promise<string> => {
  const response = await axios.get(url, {
    timeout: 30_000,
    headers: {
      'User-Agent': 'AgencyAgents-KnowledgeBot/1.0',
      Accept: 'text/html,text/plain,application/json,*/*',
    },
    maxRedirects: 5,
    responseType: 'text',
  });

  const contentType = response.headers['content-type'] || '';
  let text = String(response.data);

  // HTML → 纯文本
  if (contentType.includes('text/html')) {
    // 移除 script/style 标签
    text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
    // 移除 HTML 标签
    text = text.replace(/<[^>]+>/g, ' ');
    // 解码 HTML 实体
    text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    // 清理多余空白
    text = text.replace(/\s+/g, ' ').trim();
  }

  // JSON → 格式化文本
  if (contentType.includes('application/json')) {
    try {
      const json = JSON.parse(text);
      text = JSON.stringify(json, null, 2);
    } catch { /* 保持原文 */ }
  }

  return text;
};

// ─── 文本分块（与 knowledgeService 保持一致） ─────────────────────────────────

const chunkText = (text: string, chunkSize = 800, overlap = 100): string[] => {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if ((current + para).length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      const words = current.split(' ');
      current = words.slice(-Math.floor(overlap / 5)).join(' ') + '\n\n' + para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 20);
};

// ─── 单个 URL 知识源更新 ─────────────────────────────────────────────────────

/**
 * 更新单个 URL 类型的知识库条目
 */
export const updateUrlKnowledge = async (knowledgeId: string): Promise<UrlUpdateResult> => {
  const kb = await KnowledgeBase.findById(knowledgeId);
  if (!kb) {
    return { knowledgeId, title: '', url: '', status: 'error', message: '知识库条目不存在' };
  }

  if (kb.sourceType !== 'url' || !kb.sourceUrl) {
    return {
      knowledgeId,
      title: kb.title?.zh || '',
      url: kb.sourceUrl || '',
      status: 'error',
      message: '非 URL 类型知识源',
    };
  }

  try {
    // 1. 抓取最新内容
    const newContent = await fetchUrlContent(kb.sourceUrl);
    if (!newContent || newContent.length < 10) {
      return {
        knowledgeId,
        title: kb.title?.zh || '',
        url: kb.sourceUrl,
        status: 'error',
        message: '抓取内容为空或过短',
      };
    }

    // 2. 与现有内容对比（简单比较总字数和首块内容）
    const existingContent = kb.chunks.map((c) => c.content?.zh || '').join('\n\n');
    const existingWordCount = existingContent.split(/\s+/).filter(Boolean).length;
    const newWordCount = newContent.split(/\s+/).filter(Boolean).length;

    // 如果字数差异小于 5%，认为内容未变化
    const wordDiffRatio = Math.abs(newWordCount - existingWordCount) / Math.max(existingWordCount, 1);
    if (wordDiffRatio < 0.05 && existingWordCount > 0) {
      return {
        knowledgeId,
        title: kb.title?.zh || '',
        url: kb.sourceUrl,
        status: 'unchanged',
        message: '内容无明显变化',
      };
    }

    // 3. 重新分块
    const textChunks = chunkText(newContent);
    const newChunks = textChunks.map((text, i) => ({
      chunkId: `${uuidv4().slice(0, 8)}_chunk_${i}`,
      content: { zh: text, en: '' },
      order: i,
    }));

    // 4. 更新知识库
    kb.chunks = newChunks as any;
    kb.stats = { chunkCount: newChunks.length, wordCount: newWordCount };
    kb.updatedAt = new Date();
    await kb.save();

    return {
      knowledgeId,
      title: kb.title?.zh || '',
      url: kb.sourceUrl,
      status: 'updated',
      message: `内容已更新：${existingWordCount} → ${newWordCount} 字，${newChunks.length} 个知识块`,
      newWordCount,
      newChunkCount: newChunks.length,
    };
  } catch (err: unknown) {
    return {
      knowledgeId,
      title: kb.title?.zh || '',
      url: kb.sourceUrl || '',
      status: 'error',
      message: `抓取失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

// ─── 批量更新所有 URL 知识源 ─────────────────────────────────────────────────

/**
 * 更新所有 URL 类型的知识库条目
 */
export const updateAllUrlKnowledge = async (): Promise<{
  total: number;
  updated: number;
  unchanged: number;
  errors: number;
  results: UrlUpdateResult[];
}> => {
  const urlKnowledges = await KnowledgeBase.find({ sourceType: 'url', isActive: true }).lean();

  const results: UrlUpdateResult[] = [];
  let updated = 0;
  let unchanged = 0;
  let errors = 0;

  for (const kb of urlKnowledges) {
    const result = await updateUrlKnowledge(String(kb._id));
    results.push(result);

    if (result.status === 'updated') updated++;
    else if (result.status === 'unchanged') unchanged++;
    else errors++;

    // 每次请求间隔 1 秒，避免过快请求
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return {
    total: urlKnowledges.length,
    updated,
    unchanged,
    errors,
    results,
  };
};

// ─── 定时任务调度器 ──────────────────────────────────────────────────────────

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 启动 URL 知识源定时更新（默认每 6 小时）
 */
export const startKnowledgeScheduler = (intervalHours = 6) => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }

  const intervalMs = intervalHours * 60 * 60 * 1000;

  console.log(`📅 知识库定时更新已启动：每 ${intervalHours} 小时检查 URL 知识源`);

  schedulerTimer = setInterval(async () => {
    console.log('[KnowledgeScheduler] 开始定时更新 URL 知识源...');
    try {
      const result = await updateAllUrlKnowledge();
      console.log(
        `[KnowledgeScheduler] 更新完成：共 ${result.total} 个，更新 ${result.updated}，未变 ${result.unchanged}，失败 ${result.errors}`
      );
    } catch (err) {
      console.error('[KnowledgeScheduler] 定时更新失败:', err);
    }
  }, intervalMs);
};

/**
 * 停止定时更新
 */
export const stopKnowledgeScheduler = () => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log('📅 知识库定时更新已停止');
  }
};
