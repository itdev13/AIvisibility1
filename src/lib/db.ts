import mongoose from "mongoose";
import { env } from "./env";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = globalThis as unknown as { __mentiqMongo?: Cache };
const cache: Cache = g.__mentiqMongo ?? (g.__mentiqMongo = { conn: null, promise: null });

/** Connect once per process (survives Next.js hot reloads). */
export async function db() {
  if (cache.conn) return cache.conn;
  cache.promise ??= mongoose.connect(env.mongoUri(), { bufferCommands: false, maxPoolSize: 10 });
  try {
    cache.conn = await cache.promise;
  } catch (e) {
    cache.promise = null;
    throw e;
  }
  return cache.conn;
}
