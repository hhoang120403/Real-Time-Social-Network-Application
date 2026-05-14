import {
  ICommentDocument,
  ICommentNameList,
  ICommentReaction,
  ICommentReply,
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

  private async updatePostCommentsCount(postId: string, delta: number): Promise<void> {
    const commentsCount: (string | null)[] = await this.client.HMGET(
      `posts:${postId}`,
      'commentsCount',
    );
    const currentCount = Helpers.parseJson(commentsCount[0] as string) as number;
    const nextCount = Math.max(Number(currentCount || 0) + delta, 0);
    await this.client.HSET(`posts:${postId}`, 'commentsCount', `${nextCount}`);
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

      await this.updatePostCommentsCount(postId, 1);
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

      const comments: string[] = await this.client.LRANGE(
        `comments:${postId}`,
        0,
        -1,
      );

      const list: string[] = [];
      let commentsCount = 0;
      for (const item of comments) {
        const comment: ICommentDocument = Helpers.parseJson(
          item,
        ) as ICommentDocument;
        list.push(comment.username);
        commentsCount += 1 + (comment.replies || []).length;
        for (const reply of comment.replies || []) {
          list.push(reply.username);
        }
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

  public async updateCommentReactionInCache(
    postId: string,
    commentId: string,
    reaction: ICommentReaction,
    previousReaction = '',
  ): Promise<ICommentDocument | null> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const comments: string[] = await this.client.LRANGE(
        `comments:${postId}`,
        0,
        -1,
      );

      for (let index = 0; index < comments.length; index++) {
        const comment: ICommentDocument = Helpers.parseJson(comments[index]);
        if (comment._id.toString() !== commentId) {
          continue;
        }

        const reactions = comment.reactions || {
          like: 0,
          love: 0,
          happy: 0,
          wow: 0,
          sad: 0,
          angry: 0,
        };
        const reactionList = (comment.reactionList || []).filter(
          (item) => item.username !== reaction.username,
        );

        if (previousReaction && reactions[previousReaction as keyof typeof reactions] > 0) {
          reactions[previousReaction as keyof typeof reactions] -= 1;
        }

        if (previousReaction !== reaction.type) {
          reactions[reaction.type as keyof typeof reactions] =
            (reactions[reaction.type as keyof typeof reactions] || 0) + 1;
          reactionList.push(reaction);
        }

        comment.reactions = reactions;
        comment.reactionList = reactionList;
        await this.client.LSET(`comments:${postId}`, index, JSON.stringify(comment));
        return comment;
      }

      return null;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async updateCommentTextInCache(
    postId: string,
    commentId: string,
    commentText: string,
  ): Promise<ICommentDocument | null> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const comments: string[] = await this.client.LRANGE(
        `comments:${postId}`,
        0,
        -1,
      );

      for (let index = 0; index < comments.length; index++) {
        const comment: ICommentDocument = Helpers.parseJson(comments[index]);
        if (comment._id.toString() !== commentId) {
          continue;
        }

        comment.comment = commentText;
        await this.client.LSET(`comments:${postId}`, index, JSON.stringify(comment));
        return comment;
      }

      return null;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async deleteCommentFromCache(
    postId: string,
    commentId: string,
  ): Promise<ICommentDocument | null> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const comments: string[] = await this.client.LRANGE(
        `comments:${postId}`,
        0,
        -1,
      );

      for (const item of comments) {
        const comment: ICommentDocument = Helpers.parseJson(item);
        if (comment._id.toString() !== commentId) {
          continue;
        }

        await this.client.LREM(`comments:${postId}`, 1, item);
        await this.updatePostCommentsCount(
          postId,
          -1 - (comment.replies || []).length,
        );
        return comment;
      }

      return null;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async addCommentReplyToCache(
    postId: string,
    commentId: string,
    reply: ICommentReply,
  ): Promise<ICommentDocument | null> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const comments: string[] = await this.client.LRANGE(
        `comments:${postId}`,
        0,
        -1,
      );

      for (let index = 0; index < comments.length; index++) {
        const comment: ICommentDocument = Helpers.parseJson(comments[index]);
        if (comment._id.toString() !== commentId) {
          continue;
        }

        comment.replies = [
          ...(comment.replies || []),
          {
            ...reply,
            reactions: {
              like: 0,
              love: 0,
              happy: 0,
              wow: 0,
              sad: 0,
              angry: 0,
            },
            reactionList: [],
          },
        ];
        await this.client.LSET(`comments:${postId}`, index, JSON.stringify(comment));
        await this.updatePostCommentsCount(postId, 1);
        return comment;
      }

      return null;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async updateCommentReplyReactionInCache(
    postId: string,
    commentId: string,
    replyId: string,
    reaction: ICommentReaction,
    previousReaction = '',
  ): Promise<ICommentDocument | null> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const comments: string[] = await this.client.LRANGE(
        `comments:${postId}`,
        0,
        -1,
      );

      for (let index = 0; index < comments.length; index++) {
        const comment: ICommentDocument = Helpers.parseJson(comments[index]);
        if (comment._id.toString() !== commentId) {
          continue;
        }

        const replies = [...(comment.replies || [])];
        const replyIndex = replies.findIndex(
          (reply) => reply._id?.toString() === replyId,
        );
        if (replyIndex === -1) {
          return comment;
        }

        const reply = replies[replyIndex];
        const reactions = reply.reactions || {
          like: 0,
          love: 0,
          happy: 0,
          wow: 0,
          sad: 0,
          angry: 0,
        };
        const reactionList = (reply.reactionList || []).filter(
          (item) => item.username !== reaction.username,
        );

        if (previousReaction && reactions[previousReaction as keyof typeof reactions] > 0) {
          reactions[previousReaction as keyof typeof reactions] -= 1;
        }

        if (previousReaction !== reaction.type) {
          reactions[reaction.type as keyof typeof reactions] =
            (reactions[reaction.type as keyof typeof reactions] || 0) + 1;
          reactionList.push(reaction);
        }

        replies[replyIndex] = { ...reply, reactions, reactionList };
        comment.replies = replies;
        await this.client.LSET(`comments:${postId}`, index, JSON.stringify(comment));
        return comment;
      }

      return null;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async updateCommentReplyTextInCache(
    postId: string,
    commentId: string,
    replyId: string,
    commentText: string,
  ): Promise<ICommentDocument | null> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const comments: string[] = await this.client.LRANGE(
        `comments:${postId}`,
        0,
        -1,
      );

      for (let index = 0; index < comments.length; index++) {
        const comment: ICommentDocument = Helpers.parseJson(comments[index]);
        if (comment._id.toString() !== commentId) {
          continue;
        }

        const replies = [...(comment.replies || [])];
        const replyIndex = replies.findIndex((reply) => reply._id?.toString() === replyId);
        if (replyIndex === -1) {
          return comment;
        }

        replies[replyIndex] = { ...replies[replyIndex], comment: commentText };
        comment.replies = replies;
        await this.client.LSET(`comments:${postId}`, index, JSON.stringify(comment));
        return comment;
      }

      return null;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async deleteCommentReplyFromCache(
    postId: string,
    commentId: string,
    replyId: string,
  ): Promise<ICommentDocument | null> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const comments: string[] = await this.client.LRANGE(
        `comments:${postId}`,
        0,
        -1,
      );

      for (let index = 0; index < comments.length; index++) {
        const comment: ICommentDocument = Helpers.parseJson(comments[index]);
        if (comment._id.toString() !== commentId) {
          continue;
        }

        const previousReplyCount = (comment.replies || []).length;
        comment.replies = (comment.replies || []).filter(
          (reply) => reply._id?.toString() !== replyId,
        );
        if (comment.replies.length === previousReplyCount) {
          return comment;
        }
        await this.client.LSET(`comments:${postId}`, index, JSON.stringify(comment));
        await this.updatePostCommentsCount(postId, -1);
        return comment;
      }

      return null;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }
}
