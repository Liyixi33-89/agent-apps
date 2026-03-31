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

export const VibeTemplate = model<IVibeTemplate>('VibeTemplate', vibeTemplateSchema);
