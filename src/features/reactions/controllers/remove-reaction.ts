import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { IReactionJob } from '@reaction/interfaces/reaction.interface';
import { ReactionCache } from '@service/redis/reaction.cache';
import { reactionQueue } from '@service/queues/reaction.queue';

const reactionCache: ReactionCache = new ReactionCache();

export class RemoveReactionController {
  public async removeReaction(req: Request, res: Response): Promise<void> {
    const { postId, previousReaction, postReactions } = req.params;

    await reactionCache.removePostReactionFromCache(
      postId as string,
      `${req.currentUser!.username}`,
      JSON.parse(postReactions as string),
    );

    const databaseReactionData: IReactionJob = {
      postId: postId as string,
      username: req.currentUser!.username,
      previousReaction: previousReaction as string,
    };

    reactionQueue.addReactionJob('removeReactionFromDB', databaseReactionData);

    res
      .status(HTTP_STATUS.OK)
      .json({ message: 'Reaction removed successfully' });
  }
}
