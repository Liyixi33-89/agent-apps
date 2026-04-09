/**
 * @file routes/upload.ts
 * @description § 8  文件上传路由 — 图片上传
 *
 * 路由列表：
 *   POST /api/upload/image          → 图片上传（仅支持图片格式，5MB 限制）
 *                                     返回：{ success: true, url: string }
 */

import Router from '@koa/router';
import multer from '@koa/multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('只支持图片文件'));
  },
});

export const uploadRouter = new Router();

// ─── 图片上传  POST /api/upload/image ────────────────────────────────────────

uploadRouter.post('/upload/image', upload.single('image'), async (ctx) => {
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
