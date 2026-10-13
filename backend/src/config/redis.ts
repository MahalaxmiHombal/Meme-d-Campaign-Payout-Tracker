import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;
let isRedisConnected = false;

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (redisClient && isRedisConnected) {
    return redisClient;
  }

  try {
    redisClient = createClient({ url: process.env.REDIS_URL }) as RedisClientType;
    redisClient.on('error', (err) => {
      console.warn('Redis client error (cache disabled):', err.message);
      isRedisConnected = false;
    });
    redisClient.on('connect', () => {
      isRedisConnected = true;
      console.log('✅ Redis connected');
    });
    await redisClient.connect();
    return redisClient;
  } catch (err) {
    console.warn('Redis unavailable, continuing without cache:', err);
    return null;
  }
}

export async function cacheGet(key: string): Promise<string | null> {
  const client = await getRedisClient();
  if (!client) return null;
  try {
    return await client.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds = 60): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.setEx(key, ttlSeconds, value);
  } catch {
    // Silently fail - cache is optional
  }
}

export async function cacheDel(key: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.del(key);
  } catch {
    // Silently fail
  }
}
