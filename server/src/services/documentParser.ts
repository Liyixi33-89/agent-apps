/**
 * @file services/documentParser.ts
 * @description 文档解析服务 — 支持 PDF / Word / Excel / TXT 文件解析为纯文本
 *
 * 支持格式：
 *   - PDF  (.pdf)     → 使用 pdf-parse 提取文本
 *   - Word (.docx)    → 使用 mammoth 提取文本
 *   - Excel (.xlsx)   → 使用 xlsx 提取表格文本
 *   - TXT  (.txt/.md) → 直接读取
 */

import fs from 'node:fs';
import path from 'node:path';

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

export interface ParsedDocument {
  /** 文件名 */
  fileName: string;
  /** 文件类型 */
  fileType: 'pdf' | 'docx' | 'xlsx' | 'txt' | 'md';
  /** 解析后的纯文本内容 */
  content: string;
  /** 字数统计 */
  wordCount: number;
  /** 页数（PDF 专用） */
  pageCount?: number;
  /** 解析耗时（ms） */
  parseTime: number;
}

/** 支持的文件 MIME 类型映射 */
const SUPPORTED_MIMES: Record<string, ParsedDocument['fileType']> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xlsx',
  'text/plain': 'txt',
  'text/markdown': 'md',
};

/** 支持的文件扩展名 */
const SUPPORTED_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'xls', 'txt', 'md']);

// ─── 解析函数 ──────────────────────────────────────────────────────────────────

/**
 * 解析 PDF 文件
 */
const parsePdf = async (filePath: string): Promise<{ content: string; pageCount: number }> => {
  const pdfParse = (await import('pdf-parse' as string)) as any;
  const pdfFn = pdfParse.default || pdfParse;
  const buffer = fs.readFileSync(filePath);
  const data = await pdfFn(buffer);
  return {
    content: data.text.trim(),
    pageCount: data.numpages,
  };
};

/**
 * 解析 Word (.docx) 文件
 */
const parseDocx = async (filePath: string): Promise<{ content: string }> => {
  const mammoth = await import('mammoth' as string) as any;
  const result = await mammoth.extractRawText({ path: filePath });
  return { content: result.value.trim() };
};

/**
 * 解析 Excel (.xlsx) 文件 — 将所有 Sheet 转为文本表格
 */
const parseXlsx = async (filePath: string): Promise<{ content: string }> => {
  const XLSX = await import('xlsx' as string) as any;
  const readFile = XLSX.readFile || XLSX.default?.readFile;
  const workbook = readFile(filePath);
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    parts.push(`## Sheet: ${sheetName}\n`);

    // 转为 CSV 格式文本
    const utils = XLSX.utils || XLSX.default?.utils;
    const csv = utils.sheet_to_csv(sheet, { FS: '\t', RS: '\n' });
    if (csv.trim()) {
      parts.push(csv.trim());
    }
    parts.push('');
  }

  return { content: parts.join('\n').trim() };
};

/**
 * 解析纯文本文件
 */
const parseTxt = async (filePath: string): Promise<{ content: string }> => {
  const content = fs.readFileSync(filePath, 'utf-8');
  return { content: content.trim() };
};

// ─── 主入口 ────────────────────────────────────────────────────────────────────

/**
 * 检查文件是否为支持的文档格式
 */
export const isSupportedDocument = (mimetype: string, originalname: string): boolean => {
  if (SUPPORTED_MIMES[mimetype]) return true;
  const ext = originalname.split('.').pop()?.toLowerCase() ?? '';
  return SUPPORTED_EXTENSIONS.has(ext);
};

/**
 * 获取文件类型
 */
export const getFileType = (mimetype: string, originalname: string): ParsedDocument['fileType'] => {
  if (SUPPORTED_MIMES[mimetype]) return SUPPORTED_MIMES[mimetype];
  const ext = originalname.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'md') return 'md';
  return 'txt';
};

/**
 * 解析文档文件，返回纯文本内容
 */
export const parseDocument = async (
  filePath: string,
  mimetype: string,
  originalname: string
): Promise<ParsedDocument> => {
  const startTime = Date.now();
  const fileType = getFileType(mimetype, originalname);

  let content = '';
  let pageCount: number | undefined;

  switch (fileType) {
    case 'pdf': {
      const result = await parsePdf(filePath);
      content = result.content;
      pageCount = result.pageCount;
      break;
    }
    case 'docx': {
      const result = await parseDocx(filePath);
      content = result.content;
      break;
    }
    case 'xlsx': {
      const result = await parseXlsx(filePath);
      content = result.content;
      break;
    }
    case 'txt':
    case 'md': {
      const result = await parseTxt(filePath);
      content = result.content;
      break;
    }
    default:
      throw new Error(`不支持的文件类型: ${fileType}`);
  }

  const wordCount = content.split(/\s+/).filter(Boolean).length;

  return {
    fileName: originalname,
    fileType,
    content,
    wordCount,
    pageCount,
    parseTime: Date.now() - startTime,
  };
};

/**
 * 将文档内容分块（用于知识库导入）
 * 按段落分割，每块不超过 maxChunkSize 字符
 */
export const chunkDocumentContent = (
  content: string,
  maxChunkSize = 1500,
  overlap = 200
): string[] => {
  const paragraphs = content.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (!para.trim()) continue;

    if (current.length + para.length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      // 保留重叠部分
      const words = current.split(' ');
      const overlapWords = Math.floor(overlap / 5);
      current = words.slice(-overlapWords).join(' ') + '\n\n' + para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  // 如果没有分出任何块，按固定长度切割
  if (chunks.length === 0 && content.trim()) {
    for (let i = 0; i < content.length; i += maxChunkSize - overlap) {
      chunks.push(content.slice(i, i + maxChunkSize).trim());
    }
  }

  return chunks;
};
