import { BlockUserController } from '@follower/controllers/block-user';
import { AddFollowerController } from '@follower/controllers/follower-user';
import { GetFollowersController } from '@follower/controllers/get-followers';
import { UnfollowUserController } from '@follower/controllers/unfollow-user';
import { authMiddleware } from '@global/helpers/auth-middleware';

import express, { Router } from 'express';

class FollowerRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get(
      '/user/following',
      authMiddleware.checkAuthentication,
      GetFollowersController.prototype.getUserFollowing,
    );
    this.router.get(
      '/user/followers/:userId',
      authMiddleware.checkAuthentication,
      GetFollowersController.prototype.getUserFollowers,
    );
    this.router.put(
      '/user/follow/:followerId',
      authMiddleware.checkAuthentication,
      AddFollowerController.prototype.addFollower,
    );
    this.router.put(
      '/user/unfollow/:followeeId/:followerId',
      authMiddleware.checkAuthentication,
      UnfollowUserController.prototype.unfollowUser,
    );

    this.router.put(
      '/user/block/:followerId',
      authMiddleware.checkAuthentication,
      BlockUserController.prototype.blockUser,
    );

    this.router.put(
      '/user/unblock/:followerId',
      authMiddleware.checkAuthentication,
      BlockUserController.prototype.unblockUser,
    );

    return this.router;
  }
}

export const followerRoutes: FollowerRoutes = new FollowerRoutes();
