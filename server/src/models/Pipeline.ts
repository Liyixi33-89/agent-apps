import mongoose, { Document, Schema } from 'mongoose';
import { localizedTextSchema } from './shared.js';
import type { ILocalizedText } from './shared.js';

export interface IPipelineStep {
  key: string;
  title: ILocalizedText;
  description: ILocalizedText;
  modelType: 'text' | 'vision';
  order: number;
}

export interface IPipeline extends Document {
  key: string;
  name: ILocalizedText;
  description: ILocalizedText;
  systemPrompt: ILocalizedText;
  steps: IPipelineStep[];
  createdAt: Date;
  updatedAt: Date;
}

const pipelineStepSchema = new Schema<IPipelineStep>(
  {
    key: { type: String, required: true },
    title: localizedTextSchema,
    description: localizedTextSchema,
    modelType: { type: String, enum: ['text', 'vision'], default: 'text' },
    order: { type: Number, default: 0 }
  },
  { _id: false }
);

const pipelineSchema = new Schema<IPipeline>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    name: localizedTextSchema,
    description: localizedTextSchema,
    systemPrompt: localizedTextSchema,
    steps: { type: [pipelineStepSchema], default: [] }
  },
  { timestamps: true }
);

// ─── 索引优化 ──────────────────────────────────────────────────────────────────
pipelineSchema.index({ createdAt: -1 });

export const Pipeline = mongoose.models.Pipeline || mongoose.model<IPipeline>('Pipeline', pipelineSchema);
