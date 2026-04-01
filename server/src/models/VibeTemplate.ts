import { Schema, model, Document } from 'mongoose';

export interface IVibeTemplate extends Document {
  title: string;
  description: string;
  category: string;
  author: string;
  codeParts: {
    html: string;
    css: string;
    js: string;
    jsx?: string;
    isFullHtml?: boolean;
    isReact?: boolean;
  };
  /** 后端代码（全栈模式） */
  serverParts?: {
    model: string;       // Mongoose Model 代码
    route: string;       // Koa Router 代码
    service: string;     // Service 层代码
    middleware: string;   // 中间件代码
    envTemplate: string;  // .env 模板
  };
  /** 数据库 Schema（全栈模式） */
  dbSchema?: {
    collections: string; // MongoDB 集合定义 JSON
    indexes: string;     // 索引定义
    seedData: string;    // 种子数据
  };
  /** 菜单权限配置（全栈模式） */
  menuConfig?: {
    menus: string;       // 菜单配置 JSON
    permissions: string; // 权限配置 JSON
    roles: string;       // 角色配置 JSON
  };
  /** 部署路径（发布时写入服务器目录的路径） */
  deployPath?: string;
  /** 是否为全栈项目 */
  isFullStack?: boolean;
  thumbnail?: string;
  publishedAt: Date;
  viewCount: number;
  likeCount: number;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const vibeTemplateSchema = new Schema<IVibeTemplate>(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category:    { type: String, default: '其他' },
    author:      { type: String, default: '匿名' },
    codeParts: {
      html:       { type: String, default: '' },
      css:        { type: String, default: '' },
      js:         { type: String, default: '' },
      jsx:        { type: String, default: '' },
      isFullHtml: { type: Boolean, default: false },
      isReact:    { type: Boolean, default: false },
    },
    // ─── 全栈模式扩展字段 ──────────────────────────────────────────────────
    serverParts: {
      type: {
        model:       { type: String, default: '' },
        route:       { type: String, default: '' },
        service:     { type: String, default: '' },
        middleware:   { type: String, default: '' },
        envTemplate: { type: String, default: '' },
      },
      default: undefined,
    },
    dbSchema: {
      type: {
        collections: { type: String, default: '' },
        indexes:     { type: String, default: '' },
        seedData:    { type: String, default: '' },
      },
      default: undefined,
    },
    menuConfig: {
      type: {
        menus:       { type: String, default: '' },
        permissions: { type: String, default: '' },
        roles:       { type: String, default: '' },
      },
      default: undefined,
    },
    deployPath:  { type: String },
    isFullStack: { type: Boolean, default: false },
    thumbnail:   { type: String },
    publishedAt: { type: Date, default: Date.now },
    viewCount:   { type: Number, default: 0 },
    likeCount:   { type: Number, default: 0 },
    tags:        { type: [String], default: [] },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

vibeTemplateSchema.index({ category: 1 });
vibeTemplateSchema.index({ publishedAt: -1 });
vibeTemplateSchema.index({ isActive: 1 });
vibeTemplateSchema.index({ isFullStack: 1 });

export const VibeTemplate = model<IVibeTemplate>('VibeTemplate', vibeTemplateSchema);
