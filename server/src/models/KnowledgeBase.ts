import mongoose, { Document, Schema } from 'mongoose';
import { localizedTextSchema } from './shared.js';
import type { ILocalizedText } from './shared.js';

export interface IKnowledgeChunk {
  chunkId: string;
  content: ILocalizedText;
  embedding?: number[];
  order: number;
}

export interface IKnowledgeBase extends Document {
  title: ILocalizedText;
  description: ILocalizedText;
  sourceType: 'markdown' | 'text' | 'url';
  sourcePath?: string;
  sourceUrl?: string;
  categoryKey?: string;
  agentSlug?: string;
  chunks: IKnowledgeChunk[];
  tags: string[];
  isActive: boolean;
  stats: {
    chunkCount: number;
    wordCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeChunkSchema = new Schema<IKnowledgeChunk>(
  {
    chunkId: { type: String, required: true },
    content: localizedTextSchema,
    embedding: { type: [Number], default: undefined },
    order: { type: Number, default: 0 }
  },
  { _id: false }
);

const knowledgeBaseSchema = new Schema<IKnowledgeBase>(
  {
    title: localizedTextSchema,
    description: localizedTextSchema,
    sourceType: { type: String, enum: ['markdown', 'text', 'url'], default: 'markdown' },
    sourcePath: { type: String },
    sourceUrl: { type: String },
    categoryKey: { type: String, index: true },
    agentSlug: { type: String, index: true },
    chunks: { type: [knowledgeChunkSchema], default: [] },
    tags: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    stats: {
      chunkCount: { type: Number, default: 0 },
      wordCount: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

export const KnowledgeBase = mongoose.models.KnowledgeBase || mongoose.model<IKnowledgeBase>('KnowledgeBase', knowledgeBaseSchema);
