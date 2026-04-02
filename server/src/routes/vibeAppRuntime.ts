/**
 * @file routes/vibeAppRuntime.ts
 * @description Vibe App 动态运行时 — 将 AI 生成的后端代码内置到本地服务器
 *
 * 核心思路：
 *   1. 从 VibeTemplate 中读取 serverParts.model（Mongoose Model 代码字符串）
 *   2. 解析代码中的 Schema 字段定义，动态创建 Mongoose Model
 *   3. 为每个 Model 自动生成标准 CRUD RESTful API
 *   4. 所有路由挂载在 /api/vibe-runtime/:appId/ 前缀下，互不干扰
 *
 * 路由列表：
 *   POST   /api/vibe-runtime/:appId/deploy          → 部署/重新部署应用后端
 *   DELETE /api/vibe-runtime/:appId/deploy           → 卸载应用后端
 *   GET    /api/vibe-runtime/:appId/status           → 查询部署状态
 *   GET    /api/vibe-runtime/:appId/collections      → 列出所有已部署的集合
 *
 *   # 以下为动态 CRUD 路由（:collection 为 AI 生成的数据实体名）
 *   GET    /api/vibe-runtime/:appId/:collection      → 列表查询（分页+搜索+排序）
 *   GET    /api/vibe-runtime/:appId/:collection/:id  → 详情查询
 *   POST   /api/vibe-runtime/:appId/:collection      → 创建记录
 *   PUT    /api/vibe-runtime/:appId/:collection/:id  → 更新记录
 *   DELETE /api/vibe-runtime/:appId/:collection/:id  → 删除记录（软删除）
 */

import Router from '@koa/router';
import mongoose, { Schema, Model, Document } from 'mongoose';
import { VibeTemplate } from '../models/VibeTemplate.js';

export const vibeAppRuntimeRouter = new Router();

// =============================================================================
// § 1  动态 Model 注册表（内存缓存）
// =============================================================================

interface DeployedApp {
  appId: string;
  title: string;
  collections: Map<string, {
    modelName: string;       // Mongoose model 名称（全局唯一）
    collectionName: string;  // MongoDB 集合名称
    model: Model<any>;       // Mongoose Model 实例
    fields: Record<string, { type: string; required?: boolean; default?: any }>;
  }>;
  deployedAt: Date;
}

/** 已部署的应用注册表：appId → DeployedApp */
const deployedApps = new Map<string, DeployedApp>();

// =============================================================================
// § 1b  集合名模糊匹配（AI 生成的 API 路径可能与注册的集合名不完全一致）
// =============================================================================

/**
 * 从已部署应用中查找匹配的集合
 * 支持：
 *   - 精确匹配：orders → orders
 *   - 复数→单数：orders → order
 *   - 单数→复数：order → orders
 *   - 带路径前缀：v1/orders → orders（取最后一段）
 *   - 常见复数变体：categories → category, inventories → inventory
 */
const findCollection = (app: DeployedApp, collectionParam: string) => {
  // 取路径最后一段（处理 v1/orders 这种情况）
  const segments = collectionParam.split('/').filter(Boolean);
  const raw = segments[segments.length - 1] || collectionParam;
  // 统一：去掉连字符/下划线，全部小写
  const name = raw.toLowerCase().replace(/[-_]/g, '');

  const allKeys = Array.from(app.collections.keys());
  console.log(`[findCollection] 查找 "${collectionParam}" → 标准化 "${name}", 已注册集合: [${allKeys.join(', ')}]`);

  // 辅助：标准化集合 key（去掉连字符/下划线）
  const normalizeKey = (k: string) => k.toLowerCase().replace(/[-_]/g, '');

  // 1. 精确匹配（标准化后）
  for (const [key, col] of app.collections) {
    if (normalizeKey(key) === name) return col;
  }

  // 2. 复数→单数（去掉尾部 s/es/ies）
  const singulars = [
    name.replace(/ies$/, 'y'),      // categories → category
    name.replace(/ses$/, 's'),      // addresses → address
    name.replace(/es$/, ''),        // boxes → box
    name.replace(/s$/, ''),         // orders → order
  ];
  for (const s of singulars) {
    for (const [key, col] of app.collections) {
      if (normalizeKey(key) === s) return col;
    }
  }

  // 3. 单数→复数（加 s/es/ies）
  const plurals = [
    name + 's',                     // order → orders
    name + 'es',                    // box → boxes
    name.replace(/y$/, 'ies'),      // category → categories
  ];
  for (const p of plurals) {
    for (const [key, col] of app.collections) {
      if (normalizeKey(key) === p) return col;
    }
  }

  // 4. 包含匹配（如 order-management → order, orderitem → order）
  for (const [key, col] of app.collections) {
    const nk = normalizeKey(key);
    if (name.includes(nk) || nk.includes(name)) return col;
  }

  console.warn(`[findCollection] ❌ 未找到匹配集合: "${collectionParam}" (标准化: "${name}"), 可用: [${allKeys.join(', ')}]`);
  return null;
};

/**
 * 自动创建集合（Auto-Provision）
 * 当 AI 生成的前端代码请求的集合不存在时，自动创建一个通用集合
 * 使用 strict: false 的 Schema，允许存储任意字段
 */
const autoProvisionCollection = (app: DeployedApp, collectionName: string) => {
  const segments = collectionName.split('/').filter(Boolean);
  const name = (segments[segments.length - 1] || collectionName).toLowerCase().replace(/[-_]/g, '');

  // 通用字段：name + data（Mixed），其余字段由 strict: false 自动接收
  const fields: Record<string, any> = {
    name: { type: String, default: '' },
    data: { type: Schema.Types.Mixed, default: {} },
  };

  const { model, collectionName: colName, modelName } = createDynamicModel(app.appId, name, fields);

  const col = { modelName, collectionName: colName, model, fields };
  app.collections.set(name, col);

  console.log(`[autoProvision] ✅ 自动创建集合 "${name}" (${colName}) for app ${app.appId}`);
  return col;
};

// =============================================================================
// § 2  Schema 解析器 — 从 AI 生成的 Model 代码中提取字段定义
// =============================================================================

/**
 * 从 AI 生成的 Mongoose Model 代码字符串中解析出所有 Schema 定义
 * 支持格式：
 *   - new Schema({ field: { type: String, ... } })
 *   - new Schema({ field: String })
 *   - 多个 Model 定义在同一段代码中
 */
const parseModelDefinitions = (modelCode: string): Array<{
  name: string;
  fields: Record<string, any>;
}> => {
  const models: Array<{ name: string; fields: Record<string, any> }> = [];

  // 匹配模式 1：const xxxSchema = new Schema({ ... })
  // 从中提取 Schema 名称和字段
  const schemaRegex = /(?:const|let|var)\s+(\w+)Schema\s*(?::\s*\w+)?\s*=\s*new\s+(?:mongoose\.)?Schema\s*[<(]/g;
  let match: RegExpExecArray | null;

  while ((match = schemaRegex.exec(modelCode)) !== null) {
    const schemaVarName = match[1]; // 如 "user" from "userSchema"
    // 将首字母大写作为 Model 名称
    const modelName = schemaVarName.charAt(0).toUpperCase() + schemaVarName.slice(1);

    // 从 Schema 构造函数的参数中提取字段定义
    // 找到 new Schema( 或 new Schema< 后面的 { ... } 对象
    const startIdx = match.index + match[0].length;
    const fields = extractSchemaFields(modelCode, startIdx);

    if (Object.keys(fields).length > 0) {
      models.push({ name: modelName, fields });
    }
  }

  // 匹配模式 2：如果没有找到标准格式，尝试从 model('Name', schema) 中提取名称
  if (models.length === 0) {
    const modelCallRegex = /model\s*[<(]\s*['"](\w+)['"]/g;
    let modelMatch: RegExpExecArray | null;
    while ((modelMatch = modelCallRegex.exec(modelCode)) !== null) {
      const name = modelMatch[1];
      if (!models.some((m) => m.name === name)) {
        models.push({ name, fields: { _placeholder: true } as any });
      }
    }
  }

  return models;
};

/**
 * 从代码的指定位置开始，提取 Schema 字段定义对象
 * 使用括号匹配算法找到完整的 { ... } 块
 */
const extractSchemaFields = (code: string, startIdx: number): Record<string, any> => {
  // 找到第一个 { 
  let braceStart = code.indexOf('{', startIdx);
  if (braceStart === -1) return {};

  // 括号匹配找到对应的 }
  let depth = 0;
  let end = braceStart;
  for (let i = braceStart; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  const fieldBlock = code.slice(braceStart + 1, end);
  return parseFieldBlock(fieldBlock);
};

/**
 * 解析字段块，提取字段名和类型
 * 支持：
 *   field: String
 *   field: { type: String, required: true, default: 'xxx' }
 *   field: [String]
 *   field: { type: Schema.Types.ObjectId, ref: 'Other' }
 */
const parseFieldBlock = (block: string): Record<string, any> => {
  const fields: Record<string, any> = {};

  // 跳过 timestamps 等 Schema 选项
  const skipFields = new Set(['timestamps', '_id', '__v', 'versionKey', 'collection']);

  // 逐行解析
  const lines = block.split('\n');
  let currentField = '';
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    currentField += ' ' + trimmed;

    // 计算括号深度
    for (const ch of trimmed) {
      if (ch === '{' || ch === '[') braceDepth++;
      if (ch === '}' || ch === ']') braceDepth--;
    }

    // 当括号平衡时，尝试解析这一段
    if (braceDepth <= 0) {
      const fieldMatch = currentField.match(/^\s*(\w+)\s*:\s*(.+)/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        const fieldDef = fieldMatch[2].trim().replace(/,\s*$/, '');

        if (!skipFields.has(fieldName)) {
          fields[fieldName] = parseFieldType(fieldDef);
        }
      }
      currentField = '';
      braceDepth = 0;
    }
  }

  return fields;
};

/**
 * 将 AI 生成的类型字符串映射为 Mongoose Schema 类型
 */
const parseFieldType = (typeDef: string): any => {
  // 简单类型：String, Number, Boolean, Date
  const simpleTypeMap: Record<string, any> = {
    'String': { type: String },
    'Number': { type: Number },
    'Boolean': { type: Boolean },
    'Date': { type: Date },
    'Buffer': { type: Buffer },
    'Mixed': { type: Schema.Types.Mixed },
    'ObjectId': { type: Schema.Types.ObjectId },
    'Schema.Types.Mixed': { type: Schema.Types.Mixed },
    'Schema.Types.ObjectId': { type: Schema.Types.ObjectId },
    'mongoose.Schema.Types.ObjectId': { type: Schema.Types.ObjectId },
    'mongoose.Schema.Types.Mixed': { type: Schema.Types.Mixed },
  };

  // 直接匹配简单类型
  if (simpleTypeMap[typeDef]) return simpleTypeMap[typeDef];

  // 数组类型：[String], [Number] 等
  const arrayMatch = typeDef.match(/^\[(\w+)\]$/);
  if (arrayMatch && simpleTypeMap[arrayMatch[1]]) {
    return { type: [simpleTypeMap[arrayMatch[1]].type], default: [] };
  }

  // 对象类型：{ type: String, required: true, ... }
  if (typeDef.startsWith('{')) {
    const result: any = {};

    // 提取 type
    const typeMatch = typeDef.match(/type\s*:\s*(\w+(?:\.\w+)*)/);
    if (typeMatch) {
      const mappedType = simpleTypeMap[typeMatch[1]];
      result.type = mappedType ? mappedType.type : Schema.Types.Mixed;
    } else {
      result.type = Schema.Types.Mixed;
    }

    // 提取 required
    if (/required\s*:\s*true/.test(typeDef)) result.required = true;

    // 提取 default
    const defaultMatch = typeDef.match(/default\s*:\s*(['"]([^'"]*)['"]\s*|(\d+)\s*|true|false|null|\[\]|\{\}|Date\.now|new Date)/);
    if (defaultMatch) {
      const val = defaultMatch[0].replace(/^default\s*:\s*/, '').trim();
      if (val === 'true') result.default = true;
      else if (val === 'false') result.default = false;
      else if (val === 'null') result.default = null;
      else if (val === '[]') result.default = [];
      else if (val === '{}') result.default = {};
      else if (val === 'Date.now' || val === 'new Date') result.default = Date.now;
      else if (/^\d+$/.test(val)) result.default = Number(val);
      else if (val.startsWith("'") || val.startsWith('"')) result.default = val.slice(1, -1);
    }

    // 提取 enum
    const enumMatch = typeDef.match(/enum\s*:\s*\[([^\]]+)\]/);
    if (enumMatch) {
      result.enum = enumMatch[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
    }

    // 提取 ref（关联）
    const refMatch = typeDef.match(/ref\s*:\s*['"](\w+)['"]/);
    if (refMatch) {
      result.ref = refMatch[1];
    }

    // 提取 select: false（密码等敏感字段）
    if (/select\s*:\s*false/.test(typeDef)) result.select = false;

    // 提取 unique
    if (/unique\s*:\s*true/.test(typeDef)) result.unique = true;

    // 提取 trim
    if (/trim\s*:\s*true/.test(typeDef)) result.trim = true;

    // 提取 maxlength / minlength
    const maxLenMatch = typeDef.match(/maxlength\s*:\s*(\d+)/);
    if (maxLenMatch) result.maxlength = Number(maxLenMatch[1]);
    const minLenMatch = typeDef.match(/minlength\s*:\s*(\d+)/);
    if (minLenMatch) result.minlength = Number(minLenMatch[1]);

    // 提取 min / max（数字）
    const minMatch = typeDef.match(/\bmin\s*:\s*(\d+)/);
    if (minMatch) result.min = Number(minMatch[1]);
    const maxMatch = typeDef.match(/\bmax\s*:\s*(\d+)/);
    if (maxMatch) result.max = Number(maxMatch[1]);

    return result;
  }

  // 默认返回 Mixed
  return { type: Schema.Types.Mixed };
};

// =============================================================================
// § 3  动态 Model 创建器
// =============================================================================

/**
 * 对 AI 生成的 Schema 字段定义做容错处理：
 * 1. 将 ObjectId 类型字段的 required 去掉（前端通常不传合法 ObjectId）
 * 2. 将 select: false 的 required 字段（如 passwordHash）改为非必填并加默认值
 * 3. 保留 enum、ref 等约束但做宽松处理
 */
const sanitizeSchemaFields = (fields: Record<string, any>): Record<string, any> => {
  const sanitized: Record<string, any> = {};

  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    if (fieldName === '_placeholder') continue;

    // 深拷贝避免修改原始定义
    const def = JSON.parse(JSON.stringify(fieldDef, (_, v) => {
      // JSON.stringify 无法序列化函数和特殊类型，需要特殊处理
      if (v === String) return '__TYPE_STRING__';
      if (v === Number) return '__TYPE_NUMBER__';
      if (v === Boolean) return '__TYPE_BOOLEAN__';
      if (v === Date) return '__TYPE_DATE__';
      if (v === Buffer) return '__TYPE_BUFFER__';
      return v;
    }, 2));

    // 还原类型
    const restoreTypes = (obj: any): any => {
      if (obj === '__TYPE_STRING__') return String;
      if (obj === '__TYPE_NUMBER__') return Number;
      if (obj === '__TYPE_BOOLEAN__') return Boolean;
      if (obj === '__TYPE_DATE__') return Date;
      if (obj === '__TYPE_BUFFER__') return Buffer;
      if (Array.isArray(obj)) return obj.map(restoreTypes);
      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [k, v] of Object.entries(obj)) {
          result[k] = restoreTypes(v);
        }
        return result;
      }
      return obj;
    };

    const restored = restoreTypes(def);

    if (typeof restored === 'object' && restored !== null && !Array.isArray(restored)) {
      const typeName = String(restored.type?.name || restored.type || '');
      const isObjectId = typeName.includes('ObjectId') ||
        (typeof fieldDef.type === 'function' && fieldDef.type === Schema.Types.ObjectId) ||
        (fieldDef.type === Schema.Types.ObjectId);
      const isObjectIdArray = Array.isArray(fieldDef.type) &&
        fieldDef.type.length > 0 &&
        (fieldDef.type[0]?.type === Schema.Types.ObjectId || fieldDef.type[0] === Schema.Types.ObjectId);

      // ObjectId 类型字段：改为 Mixed，去掉 required，前端传什么都能存
      if (isObjectId) {
        sanitized[fieldName] = { type: Schema.Types.Mixed, default: null };
        continue;
      }

      // ObjectId 数组字段：改为 Mixed 数组
      if (isObjectIdArray) {
        sanitized[fieldName] = { type: [Schema.Types.Mixed], default: [] };
        continue;
      }

      // select: false 且 required 的字段（如 passwordHash）：去掉 required，加默认值
      if (restored.select === false && restored.required) {
        restored.required = false;
        if (restored.default === undefined) {
          // 根据类型给默认值
          if (restored.type === String) restored.default = '';
          else if (restored.type === Number) restored.default = 0;
          else restored.default = null;
        }
        sanitized[fieldName] = restored;
        continue;
      }

      // 带 validator 自定义验证器的字段：去掉 validator（JSON 序列化会丢失函数）
      if (fieldDef.validate) {
        const cleanDef = { ...fieldDef };
        delete cleanDef.validate;
        // 如果是 ObjectId 相关的 validator，也去掉 required
        cleanDef.required = false;
        sanitized[fieldName] = cleanDef;
        continue;
      }
    }

    // 直接使用原始定义（保留函数引用等）
    sanitized[fieldName] = fieldDef;
  }

  return sanitized;
};

/**
 * 根据解析出的字段定义，动态创建 Mongoose Model
 * 集合名称格式：vibe_{appId}_{entityName}（小写）
 */
const createDynamicModel = (
  appId: string,
  entityName: string,
  fields: Record<string, any>
): { model: Model<any>; collectionName: string; modelName: string } => {
  const collectionName = `vibe_${appId.slice(0, 8)}_${entityName.toLowerCase()}`;
  const modelName = `Vibe_${appId.slice(0, 8)}_${entityName}`;

  // 如果已经注册过同名 Model，先删除
  if (mongoose.models[modelName]) {
    delete mongoose.models[modelName];
    delete (mongoose.connection as any).collections[collectionName];
  }

  // 对字段定义做容错处理
  const sanitizedFields = sanitizeSchemaFields(fields);

  // 构建 Schema 定义
  const schemaDef: Record<string, any> = {};

  for (const [fieldName, fieldDef] of Object.entries(sanitizedFields)) {
    if (fieldName === '_placeholder') continue;
    schemaDef[fieldName] = fieldDef;
  }

  // 添加通用字段
  if (!schemaDef.isDeleted) {
    schemaDef.isDeleted = { type: Boolean, default: false };
  }

  const schema = new Schema(schemaDef, {
    timestamps: true,
    collection: collectionName,
    strict: false, // 允许存储 Schema 中未定义的字段（AI 生成的前端可能发送额外字段）
  });

  // 为常用查询字段添加索引
  schema.index({ isDeleted: 1 });
  schema.index({ createdAt: -1 });

  const model = mongoose.model(modelName, schema);

  return { model, collectionName, modelName };
};

// =============================================================================
// § 4  部署管理路由
// =============================================================================

// ─── 部署核心逻辑（可被 Pipeline 等模块直接调用）──────────────────────────────

export interface DeployResult {
  appId: string;
  basePath: string;
  collections: Array<{ name: string; fields: string[] }>;
  deployedAt: Date;
}

/**
 * 部署应用后端的核心函数（不依赖 Koa ctx）
 * 从数据库读取 Vibe App → 解析 Model → 创建动态 Mongoose Model → 注册 CRUD 路由
 *
 * @param appId  应用 ID（MongoDB ObjectId）
 * @returns 部署结果
 * @throws Error 如果应用不存在、不是全栈项目、或解析失败
 */
export const deployAppBackend = async (appId: string): Promise<DeployResult> => {
  // 从数据库读取 Vibe App
  const app = await VibeTemplate.findById(appId).lean();
  if (!app) {
    throw new Error('应用不存在');
  }

  if (!app.isFullStack || !app.serverParts?.model) {
    throw new Error('该应用不是全栈项目或缺少 Model 定义');
  }

  // 解析 Model 代码
  const modelDefs = parseModelDefinitions(app.serverParts.model);
  if (modelDefs.length === 0) {
    throw new Error('无法从 Model 代码中解析出数据实体');
  }

  // 如果已部署，先卸载
  if (deployedApps.has(appId)) {
    undeployApp(appId);
  }

  // 创建动态 Model
  const collections = new Map<string, any>();
  const deployedCollections: Array<{ name: string; fields: string[] }> = [];

  for (const def of modelDefs) {
    if (def.fields._placeholder) {
      // 没有解析出字段，创建一个通用 Schema
      def.fields = {
        name: { type: String, default: '' },
        data: { type: Schema.Types.Mixed, default: {} },
      };
    }

    const { model, collectionName, modelName } = createDynamicModel(appId, def.name, def.fields);

    collections.set(def.name.toLowerCase(), {
      modelName,
      collectionName,
      model,
      fields: def.fields,
    });

    deployedCollections.push({
      name: def.name.toLowerCase(),
      fields: Object.keys(def.fields).filter((f) => f !== '_placeholder'),
    });
  }

  // 注册到部署表
  const deployed: DeployedApp = {
    appId,
    title: app.title,
    collections,
    deployedAt: new Date(),
  };
  deployedApps.set(appId, deployed);

  // 更新数据库中的部署状态
  await VibeTemplate.findByIdAndUpdate(appId, {
    $set: { deployPath: `/api/vibe-runtime/${appId}` },
  });

  return {
    appId,
    basePath: `/api/vibe-runtime/${appId}`,
    collections: deployedCollections,
    deployedAt: deployed.deployedAt,
  };
};

// ─── 部署应用后端  POST /api/vibe-runtime/:appId/deploy ─────────────────────

vibeAppRuntimeRouter.post('/vibe-runtime/:appId/deploy', async (ctx) => {
  const { appId } = ctx.params;

  try {
    const result = await deployAppBackend(appId);
    ctx.body = {
      success: true,
      message: `应用后端部署成功`,
      data: result,
    };
  } catch (err: any) {
    const msg = err.message || '部署失败';
    ctx.status = msg.includes('不存在') ? 404 : msg.includes('不是全栈') || msg.includes('无法') ? 400 : 500;
    ctx.body = { success: false, message: msg };
  }
});

// ─── 卸载应用后端  DELETE /api/vibe-runtime/:appId/deploy ───────────────────

const undeployApp = (appId: string) => {
  const app = deployedApps.get(appId);
  if (!app) return;

  // 从 Mongoose 中移除动态 Model
  for (const [, col] of app.collections) {
    if (mongoose.models[col.modelName]) {
      delete mongoose.models[col.modelName];
    }
  }

  deployedApps.delete(appId);
};

vibeAppRuntimeRouter.delete('/vibe-runtime/:appId/deploy', async (ctx) => {
  const { appId } = ctx.params;

  if (!deployedApps.has(appId)) {
    ctx.status = 404;
    ctx.body = { success: false, message: '该应用未部署' };
    return;
  }

  undeployApp(appId);

  await VibeTemplate.findByIdAndUpdate(appId, { $unset: { deployPath: 1 } });

  ctx.body = { success: true, message: '应用后端已卸载' };
});

// ─── 查询部署状态  GET /api/vibe-runtime/:appId/status ──────────────────────

vibeAppRuntimeRouter.get('/vibe-runtime/:appId/status', async (ctx) => {
  const { appId } = ctx.params;
  const app = deployedApps.get(appId);

  if (!app) {
    ctx.body = {
      success: true,
      data: { deployed: false, appId },
    };
    return;
  }

  const collections = Array.from(app.collections.entries()).map(([name, col]) => ({
    name,
    collectionName: col.collectionName,
    fields: Object.keys(col.fields).filter((f) => f !== '_placeholder'),
  }));

  ctx.body = {
    success: true,
    data: {
      deployed: true,
      appId,
      title: app.title,
      basePath: `/api/vibe-runtime/${appId}`,
      collections,
      deployedAt: app.deployedAt,
    },
  };
});

// ─── 列出已部署的集合  GET /api/vibe-runtime/:appId/collections ─────────────

vibeAppRuntimeRouter.get('/vibe-runtime/:appId/collections', async (ctx) => {
  const { appId } = ctx.params;
  const app = deployedApps.get(appId);

  if (!app) {
    ctx.status = 404;
    ctx.body = { success: false, message: '该应用未部署' };
    return;
  }

  const collections = Array.from(app.collections.entries()).map(([name, col]) => ({
    name,
    collectionName: col.collectionName,
    fields: Object.keys(col.fields).filter((f) => f !== '_placeholder'),
  }));

  ctx.body = { success: true, data: collections };
});

// ─── 列出所有已部署的应用  GET /api/vibe-runtime/apps ───────────────────────

vibeAppRuntimeRouter.get('/vibe-runtime/apps', async (ctx) => {
  const apps = Array.from(deployedApps.values()).map((app) => ({
    appId: app.appId,
    title: app.title,
    basePath: `/api/vibe-runtime/${app.appId}`,
    collectionCount: app.collections.size,
    deployedAt: app.deployedAt,
  }));

  ctx.body = { success: true, data: apps };
});

// =============================================================================
// § 5  动态 CRUD 路由（通用 RESTful API）
// =============================================================================

// ─── 列表查询  GET /api/vibe-runtime/:appId/:collection ─────────────────────

vibeAppRuntimeRouter.get('/vibe-runtime/:appId/:collection', async (ctx) => {
  const { appId, collection } = ctx.params;
  const app = deployedApps.get(appId);

  if (!app) {
    ctx.status = 404;
    ctx.body = { success: false, message: '该应用未部署，请先调用 deploy 接口' };
    return;
  }

  const col = findCollection(app, collection) || autoProvisionCollection(app, collection);

  const {
    page = '1',
    limit = '20',
    sort = '-createdAt',
    search,
    ...filters
  } = ctx.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  // 构建查询条件
  const query: Record<string, any> = { isDeleted: { $ne: true } };

  // 搜索：在所有 String 类型字段中模糊搜索
  if (search) {
    const stringFields = Object.entries(col.fields)
      .filter(([, def]) => (def as any).type === String || (def as any).type?.name === 'String')
      .map(([name]) => name);

    if (stringFields.length > 0) {
      query.$or = stringFields.map((field) => ({
        [field]: { $regex: search, $options: 'i' },
      }));
    }
  }

  // 精确过滤（允许任意查询参数，由 MongoDB 处理）
  for (const [key, value] of Object.entries(filters)) {
    if (key.startsWith('_') || key.startsWith('$') || ['page', 'limit', 'sort', 'search'].includes(key)) continue;
    if (value !== undefined && value !== '') {
      query[key] = value;
    }
  }

  // 排序
  const sortObj: Record<string, 1 | -1> = {};
  sort.split(',').forEach((s) => {
    const trimmed = s.trim();
    if (trimmed.startsWith('-')) sortObj[trimmed.slice(1)] = -1;
    else sortObj[trimmed] = 1;
  });

  try {
    const [data, total] = await Promise.all([
      col.model.find(query).sort(sortObj).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      col.model.countDocuments(query),
    ]);

    ctx.body = {
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  } catch (err: any) {
    ctx.status = 500;
    ctx.body = { success: false, message: `查询失败：${err.message}` };
  }
});

// ─── 详情查询  GET /api/vibe-runtime/:appId/:collection/:id ─────────────────

vibeAppRuntimeRouter.get('/vibe-runtime/:appId/:collection/:id', async (ctx) => {
  const { appId, collection, id } = ctx.params;
  const app = deployedApps.get(appId);

  if (!app) {
    ctx.status = 404;
    ctx.body = { success: false, message: '该应用未部署' };
    return;
  }

  const col = findCollection(app, collection) || autoProvisionCollection(app, collection);

  try {
    const doc = await col.model.findOne({ _id: id, isDeleted: { $ne: true } }).lean();
    if (!doc) {
      ctx.status = 404;
      ctx.body = { success: false, message: '记录不存在' };
      return;
    }
    ctx.body = { success: true, data: doc };
  } catch (err: any) {
    ctx.status = 500;
    ctx.body = { success: false, message: `查询失败：${err.message}` };
  }
});

// ─── 创建记录  POST /api/vibe-runtime/:appId/:collection ────────────────────

vibeAppRuntimeRouter.post('/vibe-runtime/:appId/:collection', async (ctx) => {
  const { appId, collection } = ctx.params;
  const app = deployedApps.get(appId);

  if (!app) {
    ctx.status = 404;
    ctx.body = { success: false, message: '该应用未部署' };
    return;
  }

  const col = findCollection(app, collection) || autoProvisionCollection(app, collection);

  try {
    const body = ctx.request.body as Record<string, any>;
    // 过滤掉危险字段，其余字段交给 Mongoose Schema 验证
    const dangerousKeys = new Set(['_id', '__v', 'isDeleted', '$set', '$unset', '$push', '$pull']);
    const safeData: Record<string, any> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!dangerousKeys.has(key) && !key.startsWith('$')) {
        safeData[key] = value;
      }
    }

    // 对 ObjectId 类型字段做容错：如果值不是合法 ObjectId 则保留原值（Schema 已改为 Mixed）
    // 对 required 但未提供的字段，Mongoose 会使用 Schema 中的 default 值

    const doc = await col.model.create(safeData);
    ctx.status = 201;
    ctx.body = { success: true, data: doc.toObject(), message: '创建成功' };
  } catch (err: any) {
    // Mongoose 验证错误
    if (err.name === 'ValidationError') {
      ctx.status = 400;
      ctx.body = { success: false, message: `验证失败：${err.message}` };
      return;
    }
    // 唯一索引冲突
    if (err.code === 11000) {
      ctx.status = 409;
      ctx.body = { success: false, message: '记录已存在（唯一字段冲突）' };
      return;
    }
    ctx.status = 500;
    ctx.body = { success: false, message: `创建失败：${err.message}` };
  }
});

// ─── 更新记录  PUT /api/vibe-runtime/:appId/:collection/:id ─────────────────

vibeAppRuntimeRouter.put('/vibe-runtime/:appId/:collection/:id', async (ctx) => {
  const { appId, collection, id } = ctx.params;
  const app = deployedApps.get(appId);

  if (!app) {
    ctx.status = 404;
    ctx.body = { success: false, message: '该应用未部署' };
    return;
  }

  const col = findCollection(app, collection) || autoProvisionCollection(app, collection);

  try {
    const body = ctx.request.body as Record<string, any>;
    // 过滤掉危险字段，其余字段交给 Mongoose Schema 验证
    const dangerousKeys = new Set(['_id', '__v', '$set', '$unset', '$push', '$pull']);
    const safeData: Record<string, any> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!dangerousKeys.has(key) && !key.startsWith('$')) {
        safeData[key] = value;
      }
    }

    const doc = await col.model.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { $set: safeData },
      { new: true, runValidators: true }
    ).lean();

    if (!doc) {
      ctx.status = 404;
      ctx.body = { success: false, message: '记录不存在' };
      return;
    }

    ctx.body = { success: true, data: doc, message: '更新成功' };
  } catch (err: any) {
    if (err.name === 'ValidationError') {
      ctx.status = 400;
      ctx.body = { success: false, message: `验证失败：${err.message}` };
      return;
    }
    ctx.status = 500;
    ctx.body = { success: false, message: `更新失败：${err.message}` };
  }
});

// ─── 删除记录  DELETE /api/vibe-runtime/:appId/:collection/:id ──────────────

vibeAppRuntimeRouter.delete('/vibe-runtime/:appId/:collection/:id', async (ctx) => {
  const { appId, collection, id } = ctx.params;
  const app = deployedApps.get(appId);

  if (!app) {
    ctx.status = 404;
    ctx.body = { success: false, message: '该应用未部署' };
    return;
  }

  const col = findCollection(app, collection) || autoProvisionCollection(app, collection);

  const { hard } = ctx.query as Record<string, string>;

  try {
    if (hard === 'true') {
      // 硬删除
      const result = await col.model.findByIdAndDelete(id);
      if (!result) {
        ctx.status = 404;
        ctx.body = { success: false, message: '记录不存在' };
        return;
      }
    } else {
      // 软删除
      const doc = await col.model.findOneAndUpdate(
        { _id: id, isDeleted: { $ne: true } },
        { $set: { isDeleted: true } },
        { new: true }
      );
      if (!doc) {
        ctx.status = 404;
        ctx.body = { success: false, message: '记录不存在' };
        return;
      }
    }

    ctx.body = { success: true, message: '删除成功' };
  } catch (err: any) {
    ctx.status = 500;
    ctx.body = { success: false, message: `删除失败：${err.message}` };
  }
});

// =============================================================================
// § 6  服务器启动时自动恢复已部署的应用
// =============================================================================

/**
 * 从数据库中恢复所有已部署的 Vibe App
 * 在服务器启动时调用
 */
export const restoreDeployedApps = async (): Promise<void> => {
  try {
    const apps = await VibeTemplate.find({
      isFullStack: true,
      deployPath: { $exists: true, $ne: '' },
      'serverParts.model': { $exists: true, $ne: '' },
    }).lean();

    if (apps.length === 0) return;

    console.log(`🔄 恢复 ${apps.length} 个已部署的 Vibe App 后端...`);

    for (const app of apps) {
      try {
        const modelDefs = parseModelDefinitions(app.serverParts!.model);
        if (modelDefs.length === 0) continue;

        const collections = new Map<string, any>();

        for (const def of modelDefs) {
          if (def.fields._placeholder) {
            def.fields = {
              name: { type: String, default: '' },
              data: { type: Schema.Types.Mixed, default: {} },
            };
          }

          const { model, collectionName, modelName } = createDynamicModel(
            app._id.toString(),
            def.name,
            def.fields
          );

          collections.set(def.name.toLowerCase(), {
            modelName,
            collectionName,
            model,
            fields: def.fields,
          });
        }

        deployedApps.set(app._id.toString(), {
          appId: app._id.toString(),
          title: app.title,
          collections,
          deployedAt: new Date(),
        });

        console.log(`  ✅ ${app.title} (${collections.size} 个集合)`);
      } catch (err: any) {
        console.error(`  ❌ ${app.title} 恢复失败：${err.message}`);
      }
    }

    console.log(`🎉 Vibe App 后端恢复完成，共 ${deployedApps.size} 个应用`);
  } catch (err: any) {
    console.error('❌ Vibe App 后端恢复失败：', err.message);
  }
};
