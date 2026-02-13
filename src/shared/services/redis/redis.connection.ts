import Logger from 'bunyan';
import { BaseCache } from '@service/redis/base.cache';

const log: Logger = Logger.createLogger({ name: 'redis-connection' });

class RedisConnection extends BaseCache {
  constructor() {
    super('redis-connection');
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      const res = await this.client.ping();
      console.log('Redis connection established:', res);
    } catch (error) {
      log.error('Redis connection failed', error);
    }
  }
}

export const redisConnection: RedisConnection = new RedisConnection();
