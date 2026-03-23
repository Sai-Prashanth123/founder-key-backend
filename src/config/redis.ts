/**
 * Redis client with in-memory fallback.
 * When Redis is not available (no REDIS_URL configured or connection fails),
 * falls back to a simple in-memory Map store so the server can still run.
 */

import logger from '@utils/logger';

// ─── In-Memory Fallback Store ─────────────────────────────────────────────────

interface MemoryStore {
  data: Map<string, { value: string; expiresAt: number | null }>;
}

const memStore: MemoryStore = { data: new Map() };

// Clean expired keys every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memStore.data.entries()) {
    if (entry.expiresAt !== null && entry.expiresAt < now) {
      memStore.data.delete(key);
    }
  }
}, 5 * 60 * 1000);

const memoryClient = {
  async get(key: string): Promise<string | null> {
    const entry = memStore.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      memStore.data.delete(key);
      return null;
    }
    return entry.value;
  },
  async set(key: string, value: string): Promise<'OK'> {
    memStore.data.set(key, { value, expiresAt: null });
    return 'OK';
  },
  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    memStore.data.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
    return 'OK';
  },
  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (memStore.data.delete(key)) count++;
    }
    return count;
  },
  async exists(...keys: string[]): Promise<number> {
    const now = Date.now();
    let count = 0;
    for (const key of keys) {
      const entry = memStore.data.get(key);
      if (entry && (entry.expiresAt === null || entry.expiresAt >= now)) count++;
    }
    return count;
  },
  async keys(pattern: string): Promise<string[]> {
    const now = Date.now();
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const result: string[] = [];
    for (const [key, entry] of memStore.data.entries()) {
      if (regex.test(key) && (entry.expiresAt === null || entry.expiresAt >= now)) {
        result.push(key);
      }
    }
    return result;
  },
  async quit(): Promise<'OK'> { return 'OK'; },
  disconnect(): void {},
  status: 'ready' as const,
  on(_event: string, _handler: unknown): unknown { return memoryClient; },
};

// ─── Redis Client ─────────────────────────────────────────────────────────────

type RedisClient = typeof memoryClient;

let redis: RedisClient = memoryClient;
let subscriber: RedisClient = memoryClient;
let usingMemoryFallback = true;

const REDIS_URL = process.env.REDIS_URL;

if (REDIS_URL && REDIS_URL !== 'redis://localhost:6379') {
  // Real Redis URL provided — try to connect
  try {
    const IORedis = require('ioredis');

    const realClient = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 5000,
      retryStrategy(times: number): number | null {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 500, 2000);
      },
    });

    const realSubscriber = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 5000,
      retryStrategy(times: number): number | null {
        if (times > 3) return null;
        return Math.min(times * 500, 2000);
      },
    });

    realClient.on('ready', () => {
      usingMemoryFallback = false;
      logger.info('Redis [main]: connected');
    });

    realClient.on('error', (err: Error) => {
      logger.warn('Redis [main]: error — using in-memory fallback', { error: err.message });
    });

    realSubscriber.on('error', (err: Error) => {
      logger.warn('Redis [subscriber]: error', { error: err.message });
    });

    // Connect lazily
    realClient.connect().catch(() => {
      logger.warn('Redis: connection failed — running with in-memory store');
    });

    redis = realClient;
    subscriber = realSubscriber;
  } catch {
    logger.warn('Redis: ioredis load failed — running with in-memory store');
  }
} else {
  logger.warn('Redis: no REDIS_URL configured — running with in-memory store (not suitable for production)');
}

export { redis, subscriber, usingMemoryFallback };

export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
    await subscriber.quit();
  } catch {
    redis.disconnect();
    subscriber.disconnect();
  }
}

export default redis;
