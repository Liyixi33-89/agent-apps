/**
 * @file models/Role.ts
 * @description RBAC 角色权限模型
 *
 * 支持细粒度权限控制：
 *   - 预定义角色：super_admin / admin / editor / viewer
 *   - 自定义角色：用户可创建自定义角色
 *   - 权限粒度：resource:action（如 agent:create, chat:delete）
 */

import mongoose, { Document, Schema } from 'mongoose';

/** 权限操作类型 */
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'execute' | 'manage';

/** 资源类型 */
export type ResourceType =
  | 'agent' | 'chat' | 'skill' | 'pipeline' | 'knowledge'
  | 'mcp' | 'prompt' | 'vibe' | 'user' | 'role' | 'settings' | 'token_usage';

/** 权限定义 */
export interface IPermission {
  /** 资源类型 */
  resource: ResourceType;
  /** 允许的操作列表 */
  actions: PermissionAction[];
}

/** 角色文档接口 */
export interface IRole extends Document {
  /** 角色唯一标识 */
  key: string;
  /** 角色显示名称 */
  name: string;
  /** 角色描述 */
  description: string;
  /** 权限列表 */
  permissions: IPermission[];
  /** 是否为内置角色（不可删除） */
  isBuiltin: boolean;
  /** 是否启用 */
  isActive: boolean;
  /** 租户 ID（多租户隔离） */
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const permissionSchema = new Schema<IPermission>(
  {
    resource: {
      type: String,
      enum: ['agent', 'chat', 'skill', 'pipeline', 'knowledge', 'mcp', 'prompt', 'vibe', 'user', 'role', 'settings', 'token_usage'],
      required: true,
    },
    actions: {
      type: [String],
      enum: ['create', 'read', 'update', 'delete', 'execute', 'manage'],
      default: ['read'],
    },
  },
  { _id: false }
);

const roleSchema = new Schema<IRole>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    permissions: { type: [permissionSchema], default: [] },
    isBuiltin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    tenantId: { type: String, index: true },
  },
  { timestamps: true }
);

export const Role = mongoose.models.Role || mongoose.model<IRole>('Role', roleSchema);

// =============================================================================
// 预定义角色
// =============================================================================

/** 所有资源类型 */
const ALL_RESOURCES: ResourceType[] = [
  'agent', 'chat', 'skill', 'pipeline', 'knowledge', 'mcp', 'prompt', 'vibe', 'user', 'role', 'settings', 'token_usage',
];

/** 所有操作类型 */
const ALL_ACTIONS: PermissionAction[] = ['create', 'read', 'update', 'delete', 'execute', 'manage'];

/** 预定义角色种子数据 */
export const BUILTIN_ROLES = [
  {
    key: 'super_admin',
    name: '超级管理员',
    description: '拥有所有权限，可管理角色和用户',
    permissions: ALL_RESOURCES.map(resource => ({ resource, actions: ALL_ACTIONS })),
    isBuiltin: true,
  },
  {
    key: 'admin',
    name: '管理员',
    description: '可管理大部分资源，但不能管理角色',
    permissions: ALL_RESOURCES.filter(r => r !== 'role').map(resource => ({
      resource,
      actions: ['create', 'read', 'update', 'delete', 'execute'] as PermissionAction[],
    })),
    isBuiltin: true,
  },
  {
    key: 'editor',
    name: '编辑者',
    description: '可创建和编辑内容，但不能删除或管理用户',
    permissions: [
      { resource: 'agent' as ResourceType, actions: ['create', 'read', 'update'] as PermissionAction[] },
      { resource: 'chat' as ResourceType, actions: ['create', 'read', 'update', 'delete'] as PermissionAction[] },
      { resource: 'skill' as ResourceType, actions: ['read', 'execute'] as PermissionAction[] },
      { resource: 'pipeline' as ResourceType, actions: ['read', 'execute'] as PermissionAction[] },
      { resource: 'knowledge' as ResourceType, actions: ['create', 'read', 'update'] as PermissionAction[] },
      { resource: 'vibe' as ResourceType, actions: ['create', 'read', 'update', 'execute'] as PermissionAction[] },
      { resource: 'prompt' as ResourceType, actions: ['read'] as PermissionAction[] },
    ],
    isBuiltin: true,
  },
  {
    key: 'viewer',
    name: '查看者',
    description: '只读权限，可查看所有资源但不能修改',
    permissions: ALL_RESOURCES.filter(r => !['role', 'user', 'settings'].includes(r)).map(resource => ({
      resource,
      actions: ['read'] as PermissionAction[],
    })),
    isBuiltin: true,
  },
];

/** 初始化内置角色 */
export const seedBuiltinRoles = async () => {
  for (const role of BUILTIN_ROLES) {
    await Role.findOneAndUpdate(
      { key: role.key },
      { $setOnInsert: role },
      { upsert: true, new: true }
    );
  }
  console.log(`✅ 内置角色初始化完成（${BUILTIN_ROLES.length} 个）`);
};
