import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { addReactionSchema } from '@reaction/schemas/reactions';
import {
  IReactionDocument,
  IReactionJob,
} from '@reaction/interfaces/reaction.interface';
import { ObjectId } from 'mongodb';
import { ReactionCache } from '@service/redis/reaction.cache';
import { reactionQueue } from '@service/queues/reaction.queue';

const reactionCache: ReactionCache = new ReactionCache();

export class AddReactionController {
  @joiValidation(addReactionSchema)
  public async addReaction(req: Request, res: Response): Promise<void> {
    const {
      userTo,
      postId,
      type,
      previousReaction,
      postReactions,
      profilePicture,
    } = req.body;
    const reactionObject: IReactionDocument = {
      _id: new ObjectId(),
      postId,
      type,
      username: req.currentUser!.username,
      profilePicture: profilePicture,
    } as IReactionDocument;

    await reactionCache.savePostReactionsToCache(
      postId,
      reactionObject,
      postReactions,
      type,
      previousReaction,
    );

    const databaseReactionData: IReactionJob = {
      postId,
      userTo,
      userFrom: req.currentUser!.userId,
      username: req.currentUser!.username,
      type,
      previousReaction,
      reactionObject,
    };

    reactionQueue.addReactionJob('addReactionToDB', databaseReactionData);

    res.status(HTTP_STATUS.OK).json({ message: 'Reaction added successfully' });
  }
}
