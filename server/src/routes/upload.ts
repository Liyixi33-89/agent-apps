/**
 * @file routes/upload.ts
 * @description § 8  文件上传路由 — 图片上传 + 文档上传（PDF/Word/Excel/TXT）
 *
 * 路由列表：
 *   POST /api/upload/image                → 图片上传（仅支持图片格式，5MB 限制）
 *   POST /api/upload/document             → 文档上传并解析（PDF/Word/Excel/TXT，20MB 限制）
 *   POST /api/upload/document-to-knowledge → 文档上传 → 解析 → 自动导入知识库
 */

import Router from '@koa/router';
import multer from '@koa/multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { v4 as uuidv4 } from 'uuid';
import { parseDocument, isSupportedDocument, chunkDocumentContent } from '../services/documentParser.js';
import { KnowledgeBase } from '../models/KnowledgeBase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ─── 图片上传 multer 配置 ─────────────────────────────────────────────────────

const imageUpload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('只支持图片文件'));
  },
});

// ─── 文档上传 multer 配置 ─────────────────────────────────────────────────────

const documentUpload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req: any, file: any, cb: any) => {
    if (isSupportedDocument(file.mimetype, file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式，仅支持 PDF、Word(.docx)、Excel(.xlsx)、TXT、Markdown'));
    }
  },
});

export const uploadRouter = new Router();

// ─── 图片上传  POST /api/upload/image ────────────────────────────────────────

uploadRouter.post('/upload/image', imageUpload.single('image'), async (ctx) => {
  const file = (ctx as any).file as Express.Multer.File | undefined;
  if (!file) {
    ctx.status = 400;
    ctx.body = { success: false, message: '未收到图片文件' };
    return;
  }

  const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg';
  const newName = `${uuidv4()}.${ext}`;
  const newPath = path.join(UPLOADS_DIR, newName);
  fs.renameSync(file.path, newPath);

  // 使用请求的 host 头动态构建 URL，兼容生产环境
  const protocol = ctx.request.protocol || 'http';
  const host = ctx.request.get('host') || `localhost:${env.port}`;
  const baseUrl = `${protocol}://${host}`;
  ctx.body = { success: true, url: `${baseUrl}/uploads/${newName}` };
});

// ─── 文档上传并解析  POST /api/upload/document ───────────────────────────────

uploadRouter.post('/upload/document', documentUpload.single('document'), async (ctx) => {
  const file = (ctx as any).file as Express.Multer.File | undefined;
  if (!file) {
    ctx.status = 400;
    ctx.body = { success: false, message: '未收到文档文件' };
    return;
  }

  try {
    const parsed = await parseDocument(file.path, file.mimetype, file.originalname);

    // 解析完成后删除临时文件
    try { fs.unlinkSync(file.path); } catch { /* 忽略 */ }

    ctx.body = {
      success: true,
      data: {
        fileName: parsed.fileName,
        fileType: parsed.fileType,
        content: parsed.content,
        wordCount: parsed.wordCount,
        pageCount: parsed.pageCount,
        parseTime: parsed.parseTime,
        contentPreview: parsed.content.slice(0, 500) + (parsed.content.length > 500 ? '...' : ''),
      },
    };
  } catch (err: unknown) {
    // 解析失败也要清理临时文件
    try { fs.unlinkSync(file.path); } catch { /* 忽略 */ }
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: `文档解析失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});

// ─── 文档上传 → 解析 → 导入知识库  POST /api/upload/document-to-knowledge ────

uploadRouter.post('/upload/document-to-knowledge', documentUpload.single('document'), async (ctx) => {
  const file = (ctx as any).file as Express.Multer.File | undefined;
  if (!file) {
    ctx.status = 400;
    ctx.body = { success: false, message: '未收到文档文件' };
    return;
  }

  // 从 body 中获取可选参数（multipart/form-data 中的字段）
  const body = ctx.request.body as Record<string, string>;
  const categoryKey = body.categoryKey || '';
  const agentSlug = body.agentSlug || '';
  const tags = body.tags ? body.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
  const maxChunkSize = parseInt(body.maxChunkSize || '1500', 10);

  try {
    // 1. 解析文档
    const parsed = await parseDocument(file.path, file.mimetype, file.originalname);

    // 2. 分块
    const textChunks = chunkDocumentContent(parsed.content, maxChunkSize);

    // 3. 创建知识库条目
    const titleBase = parsed.fileName.replace(/\.[^.]+$/, '');
    const chunks = textChunks.map((text, i) => ({
      chunkId: `${uuidv4().slice(0, 8)}_chunk_${i}`,
      content: { zh: text, en: '' },
      order: i,
    }));

    const kb = await KnowledgeBase.create({
      title: { zh: titleBase, en: titleBase },
      description: {
        zh: `从 ${parsed.fileType.toUpperCase()} 文档「${parsed.fileName}」导入，共 ${parsed.wordCount} 字`,
        en: `Imported from ${parsed.fileType.toUpperCase()} document "${parsed.fileName}", ${parsed.wordCount} words`,
      },
      sourceType: 'text',
      sourcePath: parsed.fileName,
      categoryKey,
      agentSlug,
      chunks,
      tags: [...tags, `doc:${parsed.fileType}`],
      isActive: true,
      stats: {
        chunkCount: chunks.length,
        wordCount: parsed.wordCount,
      },
    });

    // 清理临时文件
    try { fs.unlinkSync(file.path); } catch { /* 忽略 */ }

    ctx.body = {
      success: true,
      data: {
        knowledgeId: kb._id,
        title: titleBase,
        fileType: parsed.fileType,
        wordCount: parsed.wordCount,
        chunkCount: chunks.length,
        pageCount: parsed.pageCount,
        parseTime: parsed.parseTime,
      },
      message: `文档「${parsed.fileName}」已成功导入知识库，生成 ${chunks.length} 个知识块`,
    };
  } catch (err: unknown) {
    try { fs.unlinkSync(file.path); } catch { /* 忽略 */ }
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: `文档导入失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});
