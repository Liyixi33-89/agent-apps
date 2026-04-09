import mongoose, { Document, Schema } from 'mongoose';
import { localizedTextSchema } from './shared.js';
import type { ILocalizedText } from './shared.js';

export interface ICategory extends Document {
  key: string;
  name: ILocalizedText;
  description: ILocalizedText;
  icon: string;
  color: string;
  sortOrder: number;
  stats: { agentCount: number };
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    name: localizedTextSchema,
    description: localizedTextSchema,
    icon: { type: String, default: '📁' },
    color: { type: String, default: 'slate' },
    sortOrder: { type: Number, default: 999 },
    stats: { agentCount: { type: Number, default: 0 } }
  },
  { timestamps: true }
);

export const Category = mongoose.models.Category || mongoose.model<ICategory>('Category', categorySchema);
