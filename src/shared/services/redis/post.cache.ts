import Logger from 'bunyan';
import { ServerError } from '@global/helpers/error-handler';
import { BaseCache } from '@service/redis/base.cache';
import {
  IPostDocument,
  IReactions,
  ISavePostToCache,
} from '@post/interfaces/post.interface';
import { Helpers } from '@global/helpers/helpers';

const log: Logger = Logger.createLogger({ name: 'post-cache' });

export type PostCacheMultiType =
  | string
  | number
  | Buffer
  | IPostDocument
  | IPostDocument[];

export class PostCache extends BaseCache {
  constructor() {
    super('post-cache');
  }

  public async savePostToCache(data: ISavePostToCache): Promise<void> {
    const { key, currentUserId, uId, createdPost } = data;
    const {
      _id,
      userId,
      username,
      email,
      avatarColor,
      profilePicture,
      post,
      bgColor,
      feelings,
      privacy,
      gifUrl,
      commentsCount,
      imgVersion,
      imgId,
      videoId,
      videoVersion,
      reactions,
      createdAt,
    } = createdPost;

    // const firstList: string[] = [
    //   '_id',
    //   `${_id}`,
    //   'userId',
    //   `${userId}`,
    //   'username',
    //   `${username}`,
    //   'email',
    //   `${email}`,
    //   'privacy',
    //   `${privacy}`,
    //   'avatarColor',
    //   `${avatarColor}`,
    //   'profilePicture',
    //   `${profilePicture}`,
    //   'post',
    //   `${post}`,
    //   'bgColor',
    //   `${bgColor}`,
    //   'feelings',
    //   `${feelings}`,
    //   'gifUrl',
    //   `${gifUrl}`,
    // ];

    // const secondList: string[] = [
    //   'commentsCount',
    //   `${commentsCount}`,
    //   'reactions',
    //   JSON.stringify(reactions),
    //   'imgVersion',
    //   `${imgVersion}`,
    //   'imgId',
    //   `${imgId}`,
    //   'createdAt',
    //   `${createdAt}`,
    // ];

    // const dataToSave: string[] = [...firstList, ...secondList];

    const dataToSave = {
      _id: `${_id}`,
      userId: `${userId}`,
      username: `${username}`,
      email: `${email}`,
      avatarColor: `${avatarColor}`,
      profilePicture: `${profilePicture}`,
      post: `${post}`,
      bgColor: `${bgColor}`,
      feelings: `${feelings}`,
      privacy: `${privacy}`,
      gifUrl: `${gifUrl}`,
      commentsCount: `${commentsCount}`,
      reactions: JSON.stringify(reactions),
      imgVersion: `${imgVersion}`,
      imgId: `${imgId}`,
      videoId: `${videoId}`,
      videoVersion: `${videoVersion}`,
      createdAt: `${createdAt}`,
    };

    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const postCount: (string | null)[] = await this.client.HMGET(
        `users:${currentUserId}`,
        'postsCount',
      );

      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      multi.ZADD('post', { score: parseInt(uId, 10), value: `${key}` });
      for (const [itemKey, itemValue] of Object.entries(dataToSave)) {
        multi.HSET(`posts:${key}`, `${itemKey}`, `${itemValue}`);
      }
      const count: number = parseInt(postCount[0] ?? '0', 10) + 1;
      multi.HSET(`users:${currentUserId}`, 'postsCount', count);
      multi.exec();
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again');
    }
  }

  public async getPostsFromCache(
    key: string,
    start: number,
    end: number,
  ): Promise<IPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      // ZRANGE: returns the specified range of elements in the sorted set at <key>
      // REV: true: returns the elements in descending order (from highest score to lowest score)
      const postIds: string[] = (await this.client.ZRANGE(
        key,
        start,
        end,
      )) as string[];

      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      for (let i = postIds.length - 1; i >= 0; i--) {
        multi.HGETALL(`posts:${postIds[i]}`);
      }

      const replies: PostCacheMultiType =
        (await multi.exec()) as PostCacheMultiType;
      const posts: IPostDocument[] = [];
      for (const post of replies as IPostDocument[]) {
        post.commentsCount = Helpers.parseJson(
          `${post.commentsCount}`,
        ) as number;
        post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
        post.createdAt = new Date(
          Helpers.parseJson(`${post.createdAt}`),
        ) as Date;
        posts.push(post);
      }

      return posts;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again');
    }
  }

  public async getTotalPostsFromCache(): Promise<number> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      // ZCARD: returns the number of elements in the sorted set at <key>
      const count: number = await this.client.ZCARD('post');

      return count;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again');
    }
  }

  public async getPostsWithImagesFromCache(
    key: string,
    start: number,
    end: number,
  ): Promise<IPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      // ZRANGE: returns the specified range of elements in the sorted set at <key>
      // REV: true: returns the elements in descending order (from highest score to lowest score)
      const postIds: string[] = await this.client.ZRANGE(key, start, end);

      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      for (let i = postIds.length - 1; i >= 0; i--) {
        multi.HGETALL(`posts:${postIds[i]}`);
      }

      const replies: PostCacheMultiType =
        (await multi.exec()) as PostCacheMultiType;
      const postsWithImages: IPostDocument[] = [];
      for (const post of replies as IPostDocument[]) {
        if ((post.imgId && post.imgVersion) || post.gifUrl) {
          post.commentsCount = Helpers.parseJson(
            `${post.commentsCount}`,
          ) as number;
          post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
          post.createdAt = new Date(
            Helpers.parseJson(`${post.createdAt}`),
          ) as Date;
          postsWithImages.push(post);
        }
      }

      return postsWithImages;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again');
    }
  }

  public async getUserPostsFromCache(
    key: string,
    uId: number,
  ): Promise<IPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      // ZRANGE: returns the specified range of elements in the sorted set at <key>
      // REV: true: returns the elements in descending order (from highest score to lowest score)
      const postIds: string[] = await this.client.ZRANGE(key, uId, uId, {
        REV: true,
        BY: 'SCORE',
      });

      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      for (const postId of postIds) {
        multi.HGETALL(`posts:${postId}`);
      }

      const replies: PostCacheMultiType =
        (await multi.exec()) as PostCacheMultiType;
      const posts: IPostDocument[] = [];
      for (const post of replies as IPostDocument[]) {
        post.commentsCount = Helpers.parseJson(
          `${post.commentsCount}`,
        ) as number;
        post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
        post.createdAt = new Date(
          Helpers.parseJson(`${post.createdAt}`),
        ) as Date;
        posts.push(post);
      }

      return posts;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again');
    }
  }

  public async deletePostFromCache(
    key: string,
    currentUserId: string,
  ): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const postCount: (string | null)[] = await this.client.HMGET(
        `users:${currentUserId}`,
        'postsCount',
      );
      const multi: ReturnType<typeof this.client.multi> = this.client.multi();

      // ZREM: removes the specified members from the sorted set at <key>
      multi.ZREM('post', `${key}`);
      multi.DEL(`posts:${key}`);
      multi.DEL(`comments:${key}`);
      multi.DEL(`reactions:${key}`);
      const count: number = parseInt(postCount[0] ?? '0', 10) - 1;
      multi.HSET(`users:${currentUserId}`, 'postsCount', count);
      await multi.exec();
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again');
    }
  }

  public async updatePostInCache(
    key: string,
    updatedPost: IPostDocument,
  ): Promise<IPostDocument> {
    const {
      post,
      bgColor,
      feelings,
      privacy,
      gifUrl,
      imgVersion,
      imgId,
      videoId,
      videoVersion,
      profilePicture,
    } = updatedPost;

    // const firstList: string[] = [
    //   'post',
    //   `${post}`,
    //   'bgColor',
    //   `${bgColor}`,
    //   'feelings',
    //   `${feelings}`,
    //   'privacy',
    //   `${privacy}`,
    //   'gifUrl',
    //   `${gifUrl}`,
    // ];

    // const secondList: string[] = [
    //   'imgVersion',
    //   `${imgVersion}`,
    //   'imgId',
    //   `${imgId}`,
    //   'profilePicture',
    //   `${profilePicture}`,
    // ];

    // const dataToSave: string[] = [...firstList, ...secondList];

    const dataToSave = {
      post: `${post}`,
      bgColor: `${bgColor}`,
      feelings: `${feelings}`,
      privacy: `${privacy}`,
      gifUrl: `${gifUrl}`,
      imgVersion: `${imgVersion}`,
      imgId: `${imgId}`,
      videoId: `${videoId}`,
      videoVersion: `${videoVersion}`,
      profilePicture: `${profilePicture}`,
    };

    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      // await this.client.HSET(`posts:${key}`, dataToSave);
      for (const [itemKey, itemValue] of Object.entries(dataToSave)) {
        await this.client.HSET(`posts:${key}`, `${itemKey}`, `${itemValue}`);
      }
      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      multi.HGETALL(`posts:${key}`);
      const reply: PostCacheMultiType =
        (await multi.exec()) as PostCacheMultiType;
      const postReply = reply as IPostDocument[];
      postReply[0].commentsCount = Helpers.parseJson(
        `${postReply[0].commentsCount}`,
      ) as number;
      postReply[0].reactions = Helpers.parseJson(
        `${postReply[0].reactions}`,
      ) as IReactions;
      postReply[0].createdAt = new Date(
        Helpers.parseJson(`${postReply[0].createdAt}`),
      ) as Date;

      return postReply[0];
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again');
    }
  }
}
