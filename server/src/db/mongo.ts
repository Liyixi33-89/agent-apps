import mongoose from 'mongoose';
import { env } from '../config/env.js';

export const connectToMongo = async (): Promise<void> => {
  await mongoose.connect(env.mongodbUri);
  console.log('✅ MongoDB connected:', env.mongodbUri);
};

export const disconnectFromMongo = async (): Promise<void> => {
  await mongoose.disconnect();
  console.log('🔌 MongoDB disconnected');
};
