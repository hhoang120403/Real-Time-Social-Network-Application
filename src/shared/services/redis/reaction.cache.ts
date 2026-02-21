import { ServerError } from '@global/helpers/error-handler';
import { Helpers } from '@global/helpers/helpers';
import {
  IReactionDocument,
  IReactions,
} from '@reaction/interfaces/reaction.interface';
import { BaseCache } from '@service/redis/base.cache';
import Logger from 'bunyan';
import { find } from 'lodash';

const log: Logger = Logger.createLogger({ name: 'reactions-cache' });

export class ReactionCache extends BaseCache {
  constructor() {
    super('reactions-cache');
  }

  public async savePostReactionsToCache(
    key: string,
    reaction: IReactionDocument,
    postReactions: IReactions,
    type: string,
    previousReaction: string,
  ): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      if (previousReaction) {
        this.removePostReactionFromCache(key, reaction.username, postReactions);
      }

      if (type) {
        await this.client.LPUSH(`reactions:${key}`, JSON.stringify(reaction));
        await this.client.HSET(
          `posts:${key}`,
          'reactions',
          JSON.stringify(postReactions),
        );
      }
    } catch (error) {
      log.error('Error saving post reactions to cache', error);
      throw new ServerError(
        'Server error while saving post reactions to cache',
      );
    }
  }

  public async removePostReactionFromCache(
    key: string,
    username: string,
    postReactions: IReactions,
  ): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const response: string[] = await this.client.LRANGE(
        `reactions:${key}`,
        0,
        -1,
      );
      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      const userPreviousReaction: IReactionDocument | undefined =
        this.getPreviousReaction(response, username);

      if (userPreviousReaction) {
        multi.LREM(`reactions:${key}`, 1, JSON.stringify(userPreviousReaction));
      }

      await multi.exec();

      await this.client.HSET(
        `posts:${key}`,
        'reactions',
        JSON.stringify(postReactions),
      );
    } catch (error) {
      log.error('Error removing post reaction from cache', error);
      throw new ServerError(
        'Server error while removing post reaction from cache',
      );
    }
  }

  public async getReactionsFromCache(
    postId: string,
  ): Promise<[IReactionDocument[], number]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const reactionsCount: number = await this.client.LLEN(
        `reactions:${postId}`,
      );

      const response: string[] = await this.client.LRANGE(
        `reactions:${postId}`,
        0,
        -1,
      );

      const list: IReactionDocument[] = [];

      for (const item of response) {
        list.push(Helpers.parseJson(item) as IReactionDocument);
      }

      return response.length ? [list, reactionsCount] : [[], 0];
    } catch (error) {
      log.error('Error getting reactions from cache', error);
      throw new ServerError('Server error while getting reactions from cache');
    }
  }

  public async getSingleReactionByUsernameFromCache(
    postId: string,
    username: string,
  ): Promise<[IReactionDocument, number] | []> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      const response: string[] = await this.client.LRANGE(
        `reactions:${postId}`,
        0,
        -1,
      );

      const list: IReactionDocument[] = [];

      for (const item of response) {
        list.push(Helpers.parseJson(item) as IReactionDocument);
      }

      const result: IReactionDocument = find(
        list,
        (item: IReactionDocument) => {
          return item?.postId === postId && item?.username === username;
        },
      ) as IReactionDocument;

      return result ? [result, 1] : [];
    } catch (error) {
      log.error('Error getting reactions from cache', error);
      throw new ServerError('Server error while getting reactions from cache');
    }
  }

  private getPreviousReaction(
    response: string[],
    username: string,
  ): IReactionDocument | undefined {
    const list: IReactionDocument[] = [];
    for (const item of response) {
      list.push(Helpers.parseJson(item) as IReactionDocument);
    }
    return find(list, (item: IReactionDocument) => item.username === username);
  }
}
