import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { IReactionDocument } from '@reaction/interfaces/reaction.interface';
import { ReactionCache } from '@service/redis/reaction.cache';
import { reactionService } from '@service/db/reaction.service';
import mongoose from 'mongoose';

const reactionCache: ReactionCache = new ReactionCache();

export class GetReactionsController {
  public async getReactions(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;

    const cachedReactions: [IReactionDocument[], number] =
      await reactionCache.getReactionsFromCache(postId as string);

    const reactions: [IReactionDocument[], number] = cachedReactions[0].length
      ? cachedReactions
      : await reactionService.getPostReactions(
          { postId: new mongoose.Types.ObjectId(postId as string) },
          { createdAt: -1 },
        );

    res.status(HTTP_STATUS.OK).json({
      message: 'Reactions retrieved successfully',
      reactions: reactions[0],
      count: reactions[1],
    });
  }

  public async getSingleReactionByUsername(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { postId, username } = req.params;

    const cachedReaction: [IReactionDocument, number] | [] =
      await reactionCache.getSingleReactionByUsernameFromCache(
        postId as string,
        username as string,
      );

    const reaction: [IReactionDocument, number] | [] = cachedReaction.length
      ? cachedReaction
      : await reactionService.getSinglePostReactionByUsername(
          postId as string,
          username as string,
        );

    res.status(HTTP_STATUS.OK).json({
      message: 'Reaction by username retrieved successfully',
      reaction: reaction.length ? reaction[0] : {},
      count: reaction.length ? reaction[1] : 0,
    });
  }

  public async getReactionsByUsername(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { username } = req.params;

    const reactions: IReactionDocument[] =
      await reactionService.getReactionsByUsername(username as string);

    res.status(HTTP_STATUS.OK).json({
      message: 'Reactions by username retrieved successfully',
      reactions,
    });
  }
}
