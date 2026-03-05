import {
  ICommentDocument,
  ICommentNameList,
} from '@comment/interfaces/comment.interface';
import { ServerError } from '@global/helpers/error-handler';
import { Helpers } from '@global/helpers/helpers';
import { config } from '@root/config';
import { BaseCache } from '@service/redis/base.cache';
import Logger from 'bunyan';

const log: Logger = config.createLogger('comments-cache');

export class CommentCache extends BaseCache {
  constructor() {
    super('comments-cache');
  }

  public async savePostCommentToCache(
    postId: string,
    value: string,
  ): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      // Add comment to the list
      await this.client.LPUSH(`comments:${postId}`, value);

      const commentsCount: (string | null)[] = await this.client.HMGET(
        `posts:${postId}`,
        'commentsCount',
      );

      let count: number = Helpers.parseJson(
        commentsCount[0] as string,
      ) as number;
      count += 1;

      // Increment the comments count
      this.client.HSET(`posts:${postId}`, 'commentsCount', `${count}`);
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getCommentsFromCache(
    postId: string,
  ): Promise<ICommentDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      // Get all comments from the list
      const comments: string[] = await this.client.LRANGE(
        `comments:${postId}`,
        0,
        -1,
      );

      const list: ICommentDocument[] = [];
      for (const comment of comments) {
        list.push(Helpers.parseJson(comment));
      }

      return list;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getCommentsNamesFromCache(
    postId: string,
  ): Promise<ICommentNameList[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const commentsCount: number = await this.client.LLEN(
        `comments:${postId}`,
      );
      const comments: string[] = await this.client.LRANGE(
        `comments:${postId}`,
        0,
        -1,
      );

      const list: string[] = [];
      for (const item of comments) {
        const comment: ICommentDocument = Helpers.parseJson(
          item,
        ) as ICommentDocument;
        list.push(comment.username);
      }

      const response: ICommentNameList = {
        count: commentsCount,
        names: list,
      };

      return [response];
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getSingleCommentFromCache(
    postId: string,
    commentId: string,
  ): Promise<ICommentDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const comments: string[] = await this.client.LRANGE(
        `comments:${postId}`,
        0,
        -1,
      );

      const list: ICommentDocument[] = [];
      for (const item of comments) {
        list.push(Helpers.parseJson(item));
      }

      const result: ICommentDocument = list.find(
        (comment: ICommentDocument) => comment._id.toString() === commentId,
      ) as ICommentDocument;

      return result ? [result] : [];
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }
}
