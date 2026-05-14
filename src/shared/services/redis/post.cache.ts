/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import Logger from 'bunyan';
import { ServerError } from '@global/helpers/error-handler';
import { BaseCache } from '@service/redis/base.cache';
import {
  IPostDocument,
  ISavePostToCache,
} from '@post/interfaces/post.interface';
import { Helpers } from '@global/helpers/helpers';
import { IReactions } from '@root/features/reactions/interfaces/reaction.interface';
import { config } from '@root/config';

const log: Logger = config.createLogger('post-cache');

export type PostCacheMultiType =
  | string
  | number
  | Buffer
  | IPostDocument
  | IPostDocument[];

interface IDeletePostCacheResult {
  deletedPostIds: string[];
  updatedOriginalPost?: IPostDocument;
}

export class PostCache extends BaseCache {
  constructor() {
    super('post-cache');
  }

  public async savePostToCache(data: ISavePostToCache): Promise<void> {
    const { key, currentUserId, createdPost } = data;
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
      sharesCount,
      savesCount,
      sharedPost,
      createdAt,
    } = createdPost;

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
      sharesCount: `${sharesCount}`,
      savesCount: `${savesCount}`,
      reactions: JSON.stringify(reactions),
      imgVersion: `${imgVersion}`,
      imgId: `${imgId}`,
      videoId: `${videoId}`,
      videoVersion: `${videoVersion}`,
      createdAt: `${createdAt}`,
      sharedPost: sharedPost ? JSON.stringify(sharedPost) : '',
    };

    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const postCount: (string | null)[] = await this.client.HMGET(
        `users:${currentUserId}`,
        'postsCount',
      );

      const score = Date.now();

      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      multi.ZADD('post', { score, value: `${key}` });
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

      // Controller hiện tại truyền:
      // page 1: start=0, end=10
      // page 2: start=11, end=20
      // page 3: start=21, end=30
      //
      // Convert sang:
      // pageSize = 10
      // page 1 -> newest indices: total-10 ... total-1
      // page 2 -> newest indices: total-20 ... total-11
      // ...

      const total: number = await this.client.ZCARD(key);

      const pageSize = start === 0 ? end : end - start + 1;
      const page = Math.ceil(end / pageSize);

      let redisStart = total - page * pageSize;
      const redisEnd = redisStart + pageSize - 1;

      if (redisStart < 0) {
        redisStart = 0;
      }

      if (redisEnd < 0 || redisStart > redisEnd) {
        return [];
      }

      const postIds: string[] = (await this.client.ZRANGE(
        key,
        redisStart,
        redisEnd,
      )) as string[];

      postIds.reverse();

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
        post.sharesCount = Helpers.parseJson(`${post.sharesCount}`) as number;
        post.savesCount = Helpers.parseJson(`${post.savesCount}`) as number;
        post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
        post.createdAt = new Date(
          Helpers.parseJson(`${post.createdAt}`),
        ) as Date;
        if (post.sharedPost) {
          post.sharedPost = Helpers.parseJson(`${post.sharedPost}`) as any;
        }
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
      const total: number = await this.client.ZCARD(key);

      const pageSize = start === 0 ? end : end - start + 1;
      const page = Math.ceil(end / pageSize);

      let redisStart = total - page * pageSize;
      const redisEnd = total - (page - 1) * pageSize - 1;

      if (redisStart < 0) {
        redisStart = 0;
      }

      if (redisEnd < 0 || redisStart > redisEnd) {
        return [];
      }

      const postIds: string[] = (await this.client.ZRANGE(
        key,
        redisStart,
        redisEnd,
      )) as string[];

      postIds.reverse();

      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      for (const postId of postIds) {
        multi.HGETALL(`posts:${postId}`);
      }

      const replies: PostCacheMultiType =
        (await multi.exec()) as PostCacheMultiType;
      const postsWithImages: IPostDocument[] = [];
      for (const post of replies as IPostDocument[]) {
        if ((post.imgId && post.imgVersion) || post.gifUrl) {
          post.commentsCount = Helpers.parseJson(
            `${post.commentsCount}`,
          ) as number;
          post.sharesCount = Helpers.parseJson(`${post.sharesCount}`) as number;
          post.savesCount = Helpers.parseJson(`${post.savesCount}`) as number;
          post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
          post.createdAt = new Date(
            Helpers.parseJson(`${post.createdAt}`),
          ) as Date;
          if (post.sharedPost) {
            post.sharedPost = Helpers.parseJson(`${post.sharedPost}`) as any;
          }
          postsWithImages.push(post);
        }
      }

      return postsWithImages;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again');
    }
  }

  public async getPostsWithVideosFromCache(
    key: string,
    start: number,
    end: number,
  ): Promise<IPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const total: number = await this.client.ZCARD(key);

      const pageSize = start === 0 ? end : end - start + 1;
      const page = Math.ceil(end / pageSize);

      let redisStart = total - page * pageSize;
      const redisEnd = total - (page - 1) * pageSize - 1;

      if (redisStart < 0) {
        redisStart = 0;
      }

      if (redisEnd < 0 || redisStart > redisEnd) {
        return [];
      }

      const postIds: string[] = (await this.client.ZRANGE(
        key,
        redisStart,
        redisEnd,
      )) as string[];

      postIds.reverse();

      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      for (const postId of postIds) {
        multi.HGETALL(`posts:${postId}`);
      }

      const replies: PostCacheMultiType =
        (await multi.exec()) as PostCacheMultiType;
      const postsWithVideos: IPostDocument[] = [];
      for (const post of replies as IPostDocument[]) {
        if (post.videoId && post.videoVersion) {
          post.commentsCount = Helpers.parseJson(
            `${post.commentsCount}`,
          ) as number;
          post.sharesCount = Helpers.parseJson(`${post.sharesCount}`) as number;
          post.savesCount = Helpers.parseJson(`${post.savesCount}`) as number;
          post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
          post.createdAt = new Date(
            Helpers.parseJson(`${post.createdAt}`),
          ) as Date;
          if (post.sharedPost) {
            post.sharedPost = Helpers.parseJson(`${post.sharedPost}`) as any;
          }
          postsWithVideos.push(post);
        }
      }

      return postsWithVideos;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again');
    }
  }

  public async getUserPostsFromCache(
    _key: string,
    _uId: number,
  ): Promise<IPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      // Return empty to force fetching user posts from DB because
      // the global 'post' set shouldn't be indexed by uId (which is a long integer identifier).
      return [];
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again');
    }
  }

  private async updateUserPostsCount(userId: string, delta: number): Promise<void> {
    const postCount: (string | null)[] = await this.client.HMGET(
      `users:${userId}`,
      'postsCount',
    );
    const count = Math.max(parseInt(postCount[0] ?? '0', 10) + delta, 0);
    await this.client.HSET(`users:${userId}`, 'postsCount', count);
  }

  public async deletePostFromCache(
    key: string,
    currentUserId: string,
  ): Promise<IDeletePostCacheResult> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const targetPost = (await this.client.HGETALL(`posts:${key}`)) as unknown as IPostDocument;
      const sharedPostIds: string[] = [];
      const sharedPosts: IPostDocument[] = [];
      const allPostIds: string[] = (await this.client.ZRANGE(
        'post',
        0,
        -1,
      )) as string[];

      for (const postId of allPostIds) {
        if (postId === key) {
          continue;
        }

        const sharedPost = await this.client.HGET(`posts:${postId}`, 'sharedPost');
        if (!sharedPost) {
          continue;
        }

        const parsedSharedPost = Helpers.parseJson(sharedPost);
        if (`${parsedSharedPost?._id || ''}` === `${key}`) {
          sharedPostIds.push(postId);
          const sharedPostData = (await this.client.HGETALL(
            `posts:${postId}`,
          )) as unknown as IPostDocument;
          sharedPosts.push(sharedPostData);
        }
      }

      const deletedPostIds = [key, ...sharedPostIds];
      const multi: ReturnType<typeof this.client.multi> = this.client.multi();

      for (const postId of deletedPostIds) {
        multi.ZREM('post', `${postId}`);
        multi.DEL(`posts:${postId}`);
        multi.DEL(`comments:${postId}`);
        multi.DEL(`reactions:${postId}`);
      }
      await multi.exec();

      const ownerCounts = new Map<string, number>();
      if (targetPost?.userId) {
        ownerCounts.set(`${targetPost.userId}`, 1);
      } else {
        ownerCounts.set(currentUserId, 1);
      }

      for (const post of sharedPosts) {
        if (post?.userId) {
          ownerCounts.set(`${post.userId}`, (ownerCounts.get(`${post.userId}`) || 0) + 1);
        }
      }

      await Promise.all(
        Array.from(ownerCounts.entries()).map(([userId, count]) =>
          this.updateUserPostsCount(userId, -count),
        ),
      );

      let updatedOriginalPost: IPostDocument | undefined;
      const targetSharedPost = targetPost?.sharedPost
        ? Helpers.parseJson(`${targetPost.sharedPost}`)
        : null;
      const targetSharedPostId = `${targetSharedPost?._id || ''}`;
      if (targetSharedPostId && !deletedPostIds.includes(targetSharedPostId)) {
        const originalPost = (await this.client.HGETALL(
          `posts:${targetSharedPostId}`,
        )) as unknown as IPostDocument;
        if (originalPost?._id) {
          const sharesCount = Math.max(
            Number(Helpers.parseJson(`${originalPost.sharesCount}`) || 0) - 1,
            0,
          );
          await this.client.HSET(
            `posts:${targetSharedPostId}`,
            'sharesCount',
            `${sharesCount}`,
          );
          updatedOriginalPost = {
            ...originalPost,
            sharesCount,
            commentsCount: Helpers.parseJson(`${originalPost.commentsCount}`) as number,
            savesCount: Helpers.parseJson(`${originalPost.savesCount}`) as number,
            reactions: Helpers.parseJson(`${originalPost.reactions}`) as IReactions,
            createdAt: new Date(Helpers.parseJson(`${originalPost.createdAt}`)),
          } as IPostDocument;
        }
      }

      return { deletedPostIds, updatedOriginalPost };
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
      sharesCount,
      savesCount,
    } = updatedPost;

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
      sharesCount: `${sharesCount}`,
      savesCount: `${savesCount}`,
    };

    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

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
      postReply[0].sharesCount = Helpers.parseJson(
        `${postReply[0].sharesCount}`,
      ) as number;
      postReply[0].savesCount = Helpers.parseJson(
        `${postReply[0].savesCount}`,
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

  public async updatePostUserProfilePictureInCache(
    userId: string,
    profilePicture: string,
  ): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const postIds: string[] = (await this.client.ZRANGE(
        'post',
        0,
        -1,
      )) as string[];

      const multi: ReturnType<typeof this.client.multi> = this.client.multi();

      // For a massive database we would use SCAN or lua script, but since it's a worker this is acceptable.
      for (const postId of postIds) {
        const postUserId = await this.client.HGET(`posts:${postId}`, 'userId');
        if (postUserId === userId) {
          multi.HSET(`posts:${postId}`, 'profilePicture', profilePicture);
        }
      }

      await multi.exec();
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again');
    }
  }
}
