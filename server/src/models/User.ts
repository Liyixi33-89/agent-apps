import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  /** 角色 key（关联 Role 模型） */
  role: string;
  /** 用户头像 URL */
  avatar?: string;
  /** 租户 ID（多租户隔离） */
  tenantId?: string;
  /** OAuth 第三方登录信息 */
  oauth?: {
    provider: 'github' | 'google' | 'wechat';
    providerId: string;
    accessToken?: string;
  };
  /** 用户偏好设置 */
  preferences?: {
    lang: 'zh' | 'en';
    theme: 'light' | 'dark' | 'auto';
    defaultProvider?: string;
  };
  /** Token 配额（每日） */
  dailyTokenQuota: number;
  /** 今日已用 Token */
  todayTokenUsed: number;
  /** Token 用量重置日期 */
  tokenResetDate?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'viewer', index: true },
    avatar: { type: String },
    tenantId: { type: String, index: true },
    oauth: {
      provider: { type: String, enum: ['github', 'google', 'wechat'] },
      providerId: { type: String },
      accessToken: { type: String },
    },
    preferences: {
      lang: { type: String, enum: ['zh', 'en'], default: 'zh' },
      theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
      defaultProvider: { type: String },
    },
    dailyTokenQuota: { type: Number, default: 0 },
    todayTokenUsed: { type: Number, default: 0 },
    tokenResetDate: { type: String },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date }
  },
  { timestamps: true }
);

// 复合索引：多租户 + 用户名唯一
userSchema.index({ tenantId: 1, username: 1 }, { unique: true, sparse: true });

export const User = mongoose.models.User || mongoose.model<IUser>('User', userSchema);
