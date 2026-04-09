import mongoose from 'mongoose';
import { env } from '../config/env.js';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

// 隐藏 URI 中的密码用于日志输出
const safeUri = (uri: string): string => uri.replace(/:([^@/]+)@/, ':***@');

export const connectToMongo = async (): Promise<void> => {
  // ── 连接事件监听 ──
  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB 连接错误:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB 连接断开，Mongoose 将自动重连...');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB 已重新连接');
  });

  // ── 重试连接 ──
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(env.mongodbUri, {
        serverSelectionTimeoutMS: 5000,
        heartbeatFrequencyMS: 10000,
        socketTimeoutMS: 45000,
      });
      console.log(`✅ MongoDB connected: ${safeUri(env.mongodbUri)}`);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt === MAX_RETRIES) {
        console.error(`❌ MongoDB 连接失败（已重试 ${MAX_RETRIES} 次）: ${message}`);
        throw err;
      }
      console.warn(`⚠️  MongoDB 连接失败（第 ${attempt}/${MAX_RETRIES} 次），${RETRY_DELAY_MS / 1000}s 后重试: ${message}`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
};

export const disconnectFromMongo = async (): Promise<void> => {
  await mongoose.disconnect();
  console.log('🔌 MongoDB disconnected');
};
