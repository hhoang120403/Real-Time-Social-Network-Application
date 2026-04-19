import { ServerError } from '@global/helpers/error-handler';
import { Helpers } from '@global/helpers/helpers';
import { BaseCache } from '@service/redis/base.cache';
import {
  INotificationSettings,
  ISocialLinks,
  IUserDocument,
} from '@user/interfaces/user.interface';
import Logger from 'bunyan';
import { findIndex, indexOf } from 'lodash';

const log: Logger = Logger.createLogger({ name: 'user-cache' });
type UserItem = string | ISocialLinks | INotificationSettings;
export type UserCacheMultiType =
  | string
  | number
  | Buffer
  | IUserDocument
  | IUserDocument[];

export class UserCache extends BaseCache {
  constructor() {
    super('user-cache');
  }

  public async saveUserToCache(
    key: string,
    userUId: string,
    createdUser: IUserDocument,
  ): Promise<void> {
    const createdAt = new Date();
    const {
      _id,
      uId,
      username,
      email,
      avatarColor,
      blocked,
      blockedBy,
      postsCount,
      profilePicture,
      followersCount,
      followingCount,
      notifications,
      work,
      location,
      school,
      quote,
      bgImageVersion,
      bgImageId,
      social,
    } = createdUser;

    const dataToSave = {
      _id: `${_id}`,
      uId: `${uId}`,
      username: `${username}`,
      email: `${email}`,
      avatarColor: `${avatarColor}`,
      createdAt: `${createdAt}`,
      postsCount: `${postsCount}`,
      blocked: JSON.stringify(blocked),
      blockedBy: JSON.stringify(blockedBy),
      profilePicture: `${profilePicture}`,
      followersCount: `${followersCount}`,
      followingCount: `${followingCount}`,
      notifications: JSON.stringify(notifications),
      social: JSON.stringify(social),
      work: `${work}`,
      location: `${location}`,
      school: `${school}`,
      quote: `${quote}`,
      bgImageVersion: `${bgImageVersion}`,
      bgImageId: `${bgImageId}`,
    };

    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      await this.client.ZADD('user', {
        score: parseInt(userUId, 10),
        value: `${key}`,
      });

      for (const [itemKey, itemValue] of Object.entries(dataToSave)) {
        await this.client.HSET(`users:${key}`, `${itemKey}`, `${itemValue}`);
      }
    } catch (error) {
      log.error('Error adding user to cache', error);
      throw new ServerError('Server error while adding user to cache');
    }
  }

  public async getUserFromCache(userId: string): Promise<IUserDocument | null> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const response: IUserDocument | null = (await this.client.HGETALL(
        `users:${userId}`,
      )) as unknown as IUserDocument;
      response.createdAt = new Date(Helpers.parseJson(`${response.createdAt}`));
      response.postsCount = Helpers.parseJson(`${response.postsCount}`);
      response.followersCount = Helpers.parseJson(`${response.followersCount}`);
      response.followingCount = Helpers.parseJson(`${response.followingCount}`);
      response.blocked = Helpers.parseJson(`${response.blocked}`);
      response.blockedBy = Helpers.parseJson(`${response.blockedBy}`);
      response.notifications = Helpers.parseJson(`${response.notifications}`);
      response.social = Helpers.parseJson(`${response.social}`);
      response.bgImageVersion = Helpers.parseJson(`${response.bgImageVersion}`);
      response.bgImageId = Helpers.parseJson(`${response.bgImageId}`);
      response.profilePicture = Helpers.parseJson(`${response.profilePicture}`);
      response.work = Helpers.parseJson(`${response.work}`);
      response.school = Helpers.parseJson(`${response.school}`);
      response.location = Helpers.parseJson(`${response.location}`);
      response.quote = Helpers.parseJson(`${response.quote}`);

      return response;
    } catch (error) {
      log.error('Error getting user from cache', error);
      throw new ServerError('Server error while getting user from cache');
    }
  }

  public async getUsersFromCache(
    start: number,
    end: number,
    excludedUserKey: string,
  ): Promise<IUserDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const response: string[] = (await this.client.ZRANGE(
        'user',
        start,
        end,
      )) as string[];

      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      for (let i = response.length - 1; i >= 0; i--) {
        if (response[i] !== excludedUserKey) {
          multi.HGETALL(`users:${response[i]}`);
        }
      }

      const replies: UserCacheMultiType =
        (await multi.exec()) as UserCacheMultiType;
      const users: IUserDocument[] = [];
      for (const reply of replies as IUserDocument[]) {
        reply.createdAt = new Date(Helpers.parseJson(`${reply.createdAt}`));
        reply.postsCount = Helpers.parseJson(`${reply.postsCount}`);
        reply.followersCount = Helpers.parseJson(`${reply.followersCount}`);
        reply.followingCount = Helpers.parseJson(`${reply.followingCount}`);
        reply.blocked = Helpers.parseJson(`${reply.blocked}`);
        reply.blockedBy = Helpers.parseJson(`${reply.blockedBy}`);
        reply.notifications = Helpers.parseJson(`${reply.notifications}`);
        reply.social = Helpers.parseJson(`${reply.social}`);
        reply.bgImageVersion = Helpers.parseJson(`${reply.bgImageVersion}`);
        reply.bgImageId = Helpers.parseJson(`${reply.bgImageId}`);
        reply.profilePicture = Helpers.parseJson(`${reply.profilePicture}`);
        reply.work = Helpers.parseJson(`${reply.work}`);
        reply.school = Helpers.parseJson(`${reply.school}`);
        reply.location = Helpers.parseJson(`${reply.location}`);
        reply.quote = Helpers.parseJson(`${reply.quote}`);

        users.push(reply);
      }

      return users;
    } catch (error) {
      log.error('Error getting user from cache', error);
      throw new ServerError('Server error while getting user from cache');
    }
  }

  public async getRandomUsersFromCache(
    userId: string,
    excludedUsername: string,
  ): Promise<IUserDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const replies: IUserDocument[] = [];
      const followers: string[] = await this.client.LRANGE(
        `following:${userId}`,
        0,
        -1,
      );
      const users: string[] = await this.client.ZRANGE('user', 0, -1);
      const randomUsers: string[] = Helpers.shuffle(users).slice(0, 10);
      for (const key of randomUsers) {
        const followerIndex = indexOf(followers, key);
        if (followerIndex < 0) {
          const userHash: IUserDocument = (await this.client.HGETALL(
            `users:${key}`,
          )) as unknown as IUserDocument;
          if (userHash) {
            replies.push(userHash);
          }
        }
      }

      const excludedUsernameIndex: number = findIndex(replies, [
        'username',
        excludedUsername,
      ]);

      if (excludedUsernameIndex > -1) {
        replies.splice(excludedUsernameIndex, 1);
      }

      for (const reply of replies as IUserDocument[]) {
        reply.createdAt = new Date(Helpers.parseJson(`${reply.createdAt}`));
        reply.postsCount = Helpers.parseJson(`${reply.postsCount}`);
        reply.followersCount = Helpers.parseJson(`${reply.followersCount}`);
        reply.followingCount = Helpers.parseJson(`${reply.followingCount}`);
        reply.blocked = Helpers.parseJson(`${reply.blocked}`);
        reply.blockedBy = Helpers.parseJson(`${reply.blockedBy}`);
        reply.notifications = Helpers.parseJson(`${reply.notifications}`);
        reply.social = Helpers.parseJson(`${reply.social}`);
        reply.bgImageVersion = Helpers.parseJson(`${reply.bgImageVersion}`);
        reply.bgImageId = Helpers.parseJson(`${reply.bgImageId}`);
        reply.profilePicture = Helpers.parseJson(`${reply.profilePicture}`);
        reply.work = Helpers.parseJson(`${reply.work}`);
        reply.school = Helpers.parseJson(`${reply.school}`);
        reply.location = Helpers.parseJson(`${reply.location}`);
        reply.quote = Helpers.parseJson(`${reply.quote}`);
      }

      return replies;
    } catch (error) {
      log.error('Error getting user from cache', error);
      throw new ServerError('Server error while getting user from cache');
    }
  }

  public async updateSingleUserItemInCache(
    userId: string,
    prop: string,
    value: UserItem,
  ): Promise<IUserDocument | null> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      await this.client.HSET(`users:${userId}`, prop, JSON.stringify(value));
      const response: IUserDocument | null =
        await this.getUserFromCache(userId);
      return response;
    } catch (error) {
      log.error('Error updating single user item in cache', error);
      throw new ServerError(
        'Server error while updating single user item in cache',
      );
    }
  }

  public async getTotalUsersInCache(): Promise<number> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const count: number = await this.client.ZCARD('user');

      return count;
    } catch (error) {
      log.error('Error getting total users in cache', error);
      throw new ServerError('Server error while getting total users in cache');
    }
  }
}
