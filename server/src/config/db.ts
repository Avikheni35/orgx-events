import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  console.log(`[M2] MongoDB connected: ${mongoose.connection.host}`);
}
