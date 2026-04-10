import mongoose, { Document, Schema } from 'mongoose';
import { localizedTextSchema, type ILocalizedText } from './shared.js';
export type { ILocalizedText } from './shared.js';

export interface ISection {
  key: string;
  heading: ILocalizedText;
  markdown: ILocalizedText;
  order: number;
}

export interface IPipelineNode {
  nodeId: string;
  label: ILocalizedText;
  type: string;
  dependsOn: string[];
  promptHint: ILocalizedText;
  modelType: 'text' | 'vision';
}

export interface IAgent extends Document {
  slug: string;
  categoryKey: string;
  name: ILocalizedText;
  description: ILocalizedText;
  vibe: ILocalizedText;
  emoji: string;
  color: string;
  sourcePath: string;
  rawMarkdown: string;
  frontmatter: Record<string, unknown>;
  sections: ISection[];
  tags: string[];
  capabilities: ILocalizedText[];
  workflow: {
    summary: ILocalizedText;
    nodes: IPipelineNode[];
  };
  modelPreferences: {
    primary: 'text' | 'vision';
    recommendedProvider: 'ollama' | 'openai' | 'claude' | 'gemini' | 'deepseek';
  };
  stats: {
    sectionCount: number;
    wordCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const sectionSchema = new Schema<ISection>(
  {
    key: { type: String, required: true },
    heading: localizedTextSchema,
    markdown: localizedTextSchema,
    order: { type: Number, default: 0 }
  },
  { _id: false }
);

const pipelineNodeSchema = new Schema<IPipelineNode>(
  {
    nodeId: { type: String, required: true },
    label: localizedTextSchema,
    type: { type: String, required: true },
    dependsOn: { type: [String], default: [] },
    promptHint: localizedTextSchema,
    modelType: { type: String, enum: ['text', 'vision'], default: 'text' }
  },
  { _id: false }
);

const agentSchema = new Schema<IAgent>(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    categoryKey: { type: String, required: true, index: true },
    name: localizedTextSchema,
    description: localizedTextSchema,
    vibe: localizedTextSchema,
    emoji: { type: String, default: '🤖' },
    color: { type: String, default: 'slate' },
    sourcePath: { type: String, required: true },
    rawMarkdown: { type: String, required: true },
    frontmatter: { type: Schema.Types.Mixed, default: {} },
    sections: { type: [sectionSchema], default: [] },
    tags: { type: [String], default: [] },
    capabilities: { type: [localizedTextSchema], default: [] },
    workflow: {
      summary: localizedTextSchema,
      nodes: { type: [pipelineNodeSchema], default: [] }
    },
    modelPreferences: {
      primary: { type: String, enum: ['text', 'vision'], default: 'text' },
      recommendedProvider: { type: String, enum: ['ollama', 'openai'], default: 'openai' }
    },
    stats: {
      sectionCount: { type: Number, default: 0 },
      wordCount: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

export const Agent = mongoose.models.Agent || mongoose.model<IAgent>('Agent', agentSchema);
