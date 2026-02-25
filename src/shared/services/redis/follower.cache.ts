import { IFollowerData } from '@follower/interfaces/follower.interface';
import { ServerError } from '@global/helpers/error-handler';
import { config } from '@root/config';
import { BaseCache } from '@service/redis/base.cache';
import Logger from 'bunyan';
import { UserCache } from '@service/redis/user.cache';
import { IUserDocument } from '@user/interfaces/user.interface';
import mongoose from 'mongoose';
import { Helpers } from '@global/helpers/helpers';

const log: Logger = config.createLogger('followers-cache');
const userCache: UserCache = new UserCache();

export class FollowerCache extends BaseCache {
  constructor() {
    super('followers-cache');
  }

  public async saveFollowerToCache(key: string, value: string): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      await this.client.LPUSH(key, value);
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async removeFollowerFromCache(
    key: string,
    value: string,
  ): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      await this.client.LREM(key, 1, value);
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async updateFollowersCountInCache(
    userId: string,
    prop: string,
    value: number,
  ): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      await this.client.HINCRBY(`users:${userId}`, prop, value);
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getFollowersFromCache(key: string): Promise<IFollowerData[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const response: string[] = await this.client.LRANGE(key, 0, -1);
      const followers: IFollowerData[] = [];
      for (const item of response) {
        const user: IUserDocument = (await userCache.getUserFromCache(
          item,
        )) as IUserDocument;
        const data: IFollowerData = {
          _id: new mongoose.Types.ObjectId(user._id),
          username: user.username!,
          avatarColor: user.avatarColor!,
          uId: user.uId!,
          postCount: user.postsCount!,
          followersCount: user.followersCount!,
          followingCount: user.followingCount!,
          profilePicture: user.profilePicture!,
          userProfile: user,
        };

        followers.push(data);
      }
      return followers;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async updateBlockedUserPropInCache(
    key: string,
    prop: string,
    value: string,
    type: 'block' | 'unblock',
  ): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const response: string = (await this.client.HGET(
        `users:${key}`,
        prop,
      )) as string;
      let blocked: string[] = Helpers.parseJson(response) as string[];
      if (type === 'block') {
        blocked = [...blocked, value];
      } else {
        blocked = blocked.filter((id) => id !== value);
      }
      await this.client.HSET(
        `users:${key}`,
        `${prop}`,
        JSON.stringify(blocked),
      );
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }
}
