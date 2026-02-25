import { IFollowerData } from '@follower/interfaces/follower.interface';
import { followerService } from '@service/db/follower.service';
import { FollowerCache } from '@service/redis/follower.cache';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { ObjectId } from 'mongodb';
import mongoose from 'mongoose';

const followerCache: FollowerCache = new FollowerCache();

export class GetFollowersController {
  public async getUserFollowing(req: Request, res: Response): Promise<void> {
    const userObjectId: ObjectId = new mongoose.Types.ObjectId(
      req.currentUser!.userId,
    );
    const cachedFollowees: IFollowerData[] =
      await followerCache.getFollowersFromCache(
        `following:${req.currentUser!.userId}`,
      );
    const following: IFollowerData[] = cachedFollowees.length
      ? cachedFollowees
      : await followerService.getFolloweeData(userObjectId);

    res.status(HTTP_STATUS.OK).json({ message: 'User following', following });
  }

  public async getUserFollowers(req: Request, res: Response): Promise<void> {
    const userObjectId: ObjectId = new mongoose.Types.ObjectId(
      req.params.userId as string,
    );
    const cachedFollowers: IFollowerData[] =
      await followerCache.getFollowersFromCache(
        `followers:${req.params.userId}`,
      );
    const followers: IFollowerData[] = cachedFollowers.length
      ? cachedFollowers
      : await followerService.getFollowerData(userObjectId);

    res.status(HTTP_STATUS.OK).json({ message: 'User followers', followers });
  }
}
