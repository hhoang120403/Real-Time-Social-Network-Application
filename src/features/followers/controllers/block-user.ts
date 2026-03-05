import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { FollowerCache } from '@service/redis/follower.cache';
import { blockedUserQueue } from '@service/queues/blocked.queue';

const followerCache: FollowerCache = new FollowerCache();

export class BlockUserController {
  public async blockUser(req: Request, res: Response): Promise<void> {
    const { followerId } = req.params;
    BlockUserController.prototype.updateBlockedUser(
      followerId as string,
      req.currentUser?.userId as string,
      'block',
    );
    blockedUserQueue.addBlockedUserJob('addBlockedUserToDB', {
      keyOne: req.currentUser?.userId as string,
      keyTwo: followerId as string,
      type: 'block',
    });

    res.status(HTTP_STATUS.OK).json({ message: 'User blocked successfully' });
  }

  public async unblockUser(req: Request, res: Response): Promise<void> {
    const { followerId } = req.params;
    BlockUserController.prototype.updateBlockedUser(
      followerId as string,
      req.currentUser?.userId as string,
      'unblock',
    );
    blockedUserQueue.addBlockedUserJob('removeBlockedUserFromDB', {
      keyOne: req.currentUser?.userId as string,
      keyTwo: followerId as string,
      type: 'unblock',
    });

    res.status(HTTP_STATUS.OK).json({ message: 'User unblocked successfully' });
  }

  private async updateBlockedUser(
    followerId: string,
    userId: string,
    type: 'block' | 'unblock',
  ): Promise<void> {
    const blocked: Promise<void> = followerCache.updateBlockedUserPropInCache(
      userId,
      'blocked',
      followerId,
      type,
    );
    const blockedBy: Promise<void> = followerCache.updateBlockedUserPropInCache(
      followerId,
      'blockedBy',
      userId,
      type,
    );
    await Promise.all([blocked, blockedBy]);
  }
}
