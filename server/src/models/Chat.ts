import mongoose, { Document, Schema } from 'mongoose';

export interface IChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelType?: 'text' | 'vision';
  provider?: 'ollama' | 'codebuddy';
  timestamp: Date;
  imageUrl?: string;
}

export interface IChat extends Document {
  sessionId: string;
  agentSlug?: string;
  agentName?: string;
  title: string;
  messages: IChatMessage[];
  provider: 'ollama' | 'codebuddy';
  modelType: 'text' | 'vision';
  systemPrompt?: string;
  /** 会话类型：vibe=Vibe Coding 页面，chat=普通对话页面 */
  sessionType?: 'vibe' | 'chat';
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    modelType: { type: String, enum: ['text', 'vision'], default: 'text' },
    provider: { type: String, enum: ['ollama', 'codebuddy'], default: 'ollama' },
    timestamp: { type: Date, default: Date.now },
    imageUrl: { type: String }
  },
  { _id: false }
);

const chatSchema = new Schema<IChat>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    agentSlug: { type: String, index: true },
    agentName: { type: String },
    title: { type: String, default: '新对话' },
    messages: { type: [chatMessageSchema], default: [] },
    provider: { type: String, enum: ['ollama', 'codebuddy'], default: 'ollama' },
    modelType: { type: String, enum: ['text', 'vision'], default: 'text' },
    systemPrompt: { type: String },
    sessionType: { type: String, enum: ['vibe', 'chat'], default: 'chat' }
  },
  { timestamps: true }
);

export const Chat = mongoose.models.Chat || mongoose.model<IChat>('Chat', chatSchema);
