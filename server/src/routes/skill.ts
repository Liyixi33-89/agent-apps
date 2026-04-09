/**
 * @file routes/skill.ts
 * @description Skill 管理路由（维度 7 — 管理后台）
 *
 * 路由列表：
 *   GET    /api/skills                    → Skill 列表（支持分页、分类过滤）
 *   GET    /api/skills/:key               → Skill 详情
 *   POST   /api/skills                    → 创建 Skill
 *   PUT    /api/skills/:key               → 更新 Skill（自动创建版本快照）
 *   DELETE /api/skills/:key               → 删除 Skill（内置 Skill 不可删除）
 *   POST   /api/skills/:key/execute       → 手动执行 Skill（测试台）
 *   POST   /api/skills/:key/toggle        → 启用/禁用 Skill
 *   GET    /api/skills/:key/executions    → 执行历史
 *   GET    /api/skills/:key/stats         → 统计概览
 *   POST   /api/skills/:key/rollback      → 版本回退（维度 8）
 *   POST   /api/skills/match              → 测试路由匹配
 */

import Router from '@koa/router';
import { Skill } from '../models/Skill.js';
import { SkillExecution } from '../models/SkillExecution.js';
import { executeSkill, getSkillExecutionHistory, getSkillStats } from '../services/skillEngine.js';
import { matchSkill, invalidateSkillCache } from '../services/skillRouter.js';

export const skillRouter = new Router();

// ─── Skill 列表  GET /api/skills ─────────────────────────────────────────────

skillRouter.get('/skills', async (ctx) => {
  const { page = '1', limit = '20', category, search, sort = 'sortOrder' } = ctx.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));

  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { key: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    sortOrder: { sortOrder: 1, createdAt: -1 },
    newest: { createdAt: -1 },
    popular: { usageCount: -1 },
    name: { name: 1 },
  };
  const sortOption = sortMap[sort] || sortMap.sortOrder;

  const [skills, total] = await Promise.all([
    Skill.find(filter)
      .sort(sortOption)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Skill.countDocuments(filter),
  ]);

  ctx.body = {
    success: true,
    data: skills,
    pagination: { page: pageNum, limit: limitNum, total },
  };
});

// ─── 全局统计  GET /api/skills/overview/stats ────────────────────────────────
// ⚠️ 必须放在 /skills/:key 之前，否则 "overview" 会被当作 :key 参数

skillRouter.get('/skills/overview/stats', async (ctx) => {
  const [totalSkills, activeSkills, totalExecutions, recentExecutions] = await Promise.all([
    Skill.countDocuments(),
    Skill.countDocuments({ isActive: true }),
    SkillExecution.countDocuments(),
    SkillExecution.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ]);

  const successCount = recentExecutions.filter(e => e.status === 'success').length;
  const avgDuration = recentExecutions.length > 0
    ? Math.round(recentExecutions.reduce((sum, e) => sum + e.totalDuration, 0) / recentExecutions.length)
    : 0;

  // 按 Skill 分组统计
  const skillUsage: Record<string, number> = {};
  for (const exec of recentExecutions) {
    skillUsage[exec.skillKey] = (skillUsage[exec.skillKey] || 0) + 1;
  }

  const topSkills = Object.entries(skillUsage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([key, count]) => ({ key, count }));

  ctx.body = {
    success: true,
    data: {
      totalSkills,
      activeSkills,
      totalExecutions,
      recentSuccessRate: recentExecutions.length > 0 ? successCount / recentExecutions.length : 1,
      avgDuration,
      topSkills,
    },
  };
});

// ─── Skill 详情  GET /api/skills/:key ────────────────────────────────────────

skillRouter.get('/skills/:key', async (ctx) => {
  const skill = await Skill.findOne({ key: ctx.params.key }).lean();
  if (!skill) {
    ctx.status = 404;
    ctx.body = { success: false, message: `Skill "${ctx.params.key}" 不存在` };
    return;
  }
  ctx.body = { success: true, data: skill };
});

// ─── 创建 Skill  POST /api/skills ────────────────────────────────────────────

skillRouter.post('/skills', async (ctx) => {
  const body = ctx.request.body as Record<string, unknown>;

  if (!body.key || !body.name || !body.description || !body.category) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少必填字段：key, name, description, category' };
    return;
  }

  // 检查 key 唯一性
  const existing = await Skill.findOne({ key: body.key });
  if (existing) {
    ctx.status = 409;
    ctx.body = { success: false, message: `Skill key "${body.key}" 已存在` };
    return;
  }

  const skill = await Skill.create({
    ...body,
    isBuiltin: false,
    version: '1.0.0',
    versions: [],
  });

  invalidateSkillCache();
  ctx.body = { success: true, data: skill };
});

// ─── 更新 Skill  PUT /api/skills/:key ────────────────────────────────────────

skillRouter.put('/skills/:key', async (ctx) => {
  const skill = await Skill.findOne({ key: ctx.params.key });
  if (!skill) {
    ctx.status = 404;
    ctx.body = { success: false, message: `Skill "${ctx.params.key}" 不存在` };
    return;
  }

  const body = ctx.request.body as Record<string, unknown>;

  // 维度 8：版本管理 — 如果 steps 发生变化，自动创建版本快照
  if (body.steps && JSON.stringify(body.steps) !== JSON.stringify(skill.steps)) {
    const currentVersion = skill.version || '1.0.0';
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    const newVersion = `${major}.${minor}.${patch + 1}`;

    // 保存当前版本快照
    skill.versions.push({
      version: currentVersion,
      changelog: (body.changelog as string) || `更新于 ${new Date().toLocaleString('zh-CN')}`,
      stepsSnapshot: [...skill.steps],
      createdAt: new Date(),
    });

    // 只保留最近 20 个版本
    if (skill.versions.length > 20) {
      skill.versions = skill.versions.slice(-20);
    }

    body.version = newVersion;
  }

  // 不允许修改 key 和 isBuiltin
  delete body.key;
  delete body.isBuiltin;

  Object.assign(skill, body);
  await skill.save();

  invalidateSkillCache();
  ctx.body = { success: true, data: skill };
});

// ─── 删除 Skill  DELETE /api/skills/:key ─────────────────────────────────────

skillRouter.delete('/skills/:key', async (ctx) => {
  const skill = await Skill.findOne({ key: ctx.params.key });
  if (!skill) {
    ctx.status = 404;
    ctx.body = { success: false, message: `Skill "${ctx.params.key}" 不存在` };
    return;
  }

  if (skill.isBuiltin) {
    ctx.status = 403;
    ctx.body = { success: false, message: '内置 Skill 不可删除，只能禁用' };
    return;
  }

  await Skill.deleteOne({ key: ctx.params.key });
  invalidateSkillCache();
  ctx.body = { success: true, message: `Skill "${ctx.params.key}" 已删除` };
});

// ─── 手动执行 Skill（测试台）  POST /api/skills/:key/execute ─────────────────

skillRouter.post('/skills/:key/execute', async (ctx) => {
  const { input = {}, provider, modelType } = ctx.request.body as {
    input?: Record<string, unknown>;
    provider?: string;
    modelType?: string;
  };

  try {
    const result = await executeSkill(ctx.params.key, input, {
      provider: provider as 'ollama' | 'openai' | undefined,
      modelType: modelType as 'text' | 'vision' | undefined,
      triggerMethod: 'manual',
    });

    ctx.body = { success: true, data: result };
  } catch (err) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
});

// ─── 启用/禁用 Skill  POST /api/skills/:key/toggle ──────────────────────────

skillRouter.post('/skills/:key/toggle', async (ctx) => {
  const skill = await Skill.findOne({ key: ctx.params.key });
  if (!skill) {
    ctx.status = 404;
    ctx.body = { success: false, message: `Skill "${ctx.params.key}" 不存在` };
    return;
  }

  skill.isActive = !skill.isActive;
  await skill.save();

  invalidateSkillCache();
  ctx.body = { success: true, data: { key: skill.key, isActive: skill.isActive } };
});

// ─── 执行历史  GET /api/skills/:key/executions ───────────────────────────────

skillRouter.get('/skills/:key/executions', async (ctx) => {
  const { page = '1', limit = '20' } = ctx.query as Record<string, string>;
  const result = await getSkillExecutionHistory(ctx.params.key, {
    page: parseInt(page),
    limit: parseInt(limit),
  });
  ctx.body = { success: true, data: result };
});

// ─── 统计概览  GET /api/skills/:key/stats ────────────────────────────────────

skillRouter.get('/skills/:key/stats', async (ctx) => {
  const stats = await getSkillStats(ctx.params.key);
  if (!stats) {
    ctx.status = 404;
    ctx.body = { success: false, message: `Skill "${ctx.params.key}" 不存在` };
    return;
  }
  ctx.body = { success: true, data: stats };
});

// ─── 版本回退  POST /api/skills/:key/rollback ───────────────────────────────

skillRouter.post('/skills/:key/rollback', async (ctx) => {
  const { targetVersion } = ctx.request.body as { targetVersion: string };

  const skill = await Skill.findOne({ key: ctx.params.key });
  if (!skill) {
    ctx.status = 404;
    ctx.body = { success: false, message: `Skill "${ctx.params.key}" 不存在` };
    return;
  }

  const versionSnapshot = skill.versions.find((v: { version: string }) => v.version === targetVersion);
  if (!versionSnapshot) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      message: `版本 "${targetVersion}" 不存在`,
      availableVersions: skill.versions.map((v: { version: string }) => v.version),
    };
    return;
  }

  // 保存当前版本快照
  skill.versions.push({
    version: skill.version,
    changelog: `回退前的版本快照`,
    stepsSnapshot: [...skill.steps],
    createdAt: new Date(),
  });

  // 回退到目标版本
  skill.steps = versionSnapshot.stepsSnapshot;
  skill.version = targetVersion + '-rollback';
  await skill.save();

  invalidateSkillCache();
  ctx.body = { success: true, data: skill, message: `已回退到版本 ${targetVersion}` };
});

// ─── 测试路由匹配  POST /api/skills/match ───────────────────────────────────

skillRouter.post('/skills/match', async (ctx) => {
  const { message, context, useLLM = false } = ctx.request.body as {
    message: string;
    context?: { recentMessages?: Array<{ role: string; content: string }>; sessionType?: string };
    useLLM?: boolean;
  };

  if (!message?.trim()) {
    ctx.status = 400;
    ctx.body = { success: false, message: '请提供 message' };
    return;
  }

  const match = await matchSkill(message, context as any, { useLLM });

  ctx.body = {
    success: true,
    data: match
      ? {
          matched: true,
          skillKey: match.skill.key,
          skillName: match.skill.name,
          confidence: match.confidence,
          method: match.method,
          matchedTrigger: match.matchedTrigger,
        }
      : { matched: false },
  };
});


