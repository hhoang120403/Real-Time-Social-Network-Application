import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { FollowerCache } from '@service/redis/follower.cache';
import { followerQueue } from '@service/queues/follower.queue';

const followerCache: FollowerCache = new FollowerCache();

export class UnfollowUserController {
  public async unfollowUser(req: Request, res: Response): Promise<void> {
    const { followeeId, followerId } = req.params;

    const removeFollowerFromCache: Promise<void> =
      followerCache.removeFollowerFromCache(
        `following:${req.currentUser!.userId}`,
        followeeId as string,
      );

    const removeFolloweeFromCache: Promise<void> =
      followerCache.removeFollowerFromCache(
        `followers:${followeeId}`,
        followerId as string,
      );

    // Update follower in cache
    const followersCount: Promise<void> =
      followerCache.updateFollowersCountInCache(
        `${followeeId}`,
        'followersCount',
        -1,
      );

    const followeeCount: Promise<void> =
      followerCache.updateFollowersCountInCache(
        `${followerId}`,
        'followingCount',
        -1,
      );

    await Promise.all([
      removeFollowerFromCache,
      removeFolloweeFromCache,
      followersCount,
      followeeCount,
    ]);

    // Remove follower in db
    followerQueue.addFollowerJob('removeFollowerFromDB', {
      keyOne: `${followeeId}`,
      keyTwo: `${followerId}`,
    });

    res.status(HTTP_STATUS.OK).json({ message: 'Unfollowed user now' });
  }
}
