import { IFollowerData } from '@follower/interfaces/follower.interface';
import { Helpers } from '@global/helpers/helpers';
import { IPostDocument } from '@post/interfaces/post.interface';
import { followerService } from '@service/db/follower.service';
import { postService } from '@service/db/post.service';
import { userService } from '@service/db/user.service';
import { FollowerCache } from '@service/redis/follower.cache';
import { PostCache } from '@service/redis/post.cache';
import { UserCache } from '@service/redis/user.cache';
import { IAllUsers, IUserDocument } from '@user/interfaces/user.interface';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import mongoose from 'mongoose';

interface IUserAll {
  newSkip: number;
  limit: number;
  skip: number;
  userId: string;
}

const postCache: PostCache = new PostCache();
const userCache: UserCache = new UserCache();
const followerCache: FollowerCache = new FollowerCache();

const PAGE_SIZE = 12;

export class GetProfileController {
  public async getAllUsers(req: Request, res: Response): Promise<void> {
    const { page } = req.params;
    const skip: number = (parseInt(page as string) - 1) * PAGE_SIZE;
    const limit: number = PAGE_SIZE * parseInt(page as string);
    const newSkip: number = skip === 0 ? skip : skip + 1;
    const allUsers: IAllUsers = await GetProfileController.prototype.allUsers({
      newSkip,
      limit,
      skip,
      userId: `${req.currentUser!.userId}`,
    });
    const followers: IFollowerData[] =
      await GetProfileController.prototype.followers(
        `${req.currentUser!.userId}`,
      );

    res.status(HTTP_STATUS.OK).json({
      message: 'Get all users successfully',
      users: allUsers.users,
      totalUsers: allUsers.totalUsers,
      followers,
    });
  }

  public async getUserProfile(req: Request, res: Response): Promise<void> {
    const cachedUser: IUserDocument = (await userCache.getUserFromCache(
      `${req.currentUser!.userId}`,
    )) as IUserDocument;
    const existingUser: IUserDocument = cachedUser
      ? cachedUser
      : await userService.getUserById(`${req.currentUser!.userId}`);

    res.status(HTTP_STATUS.OK).json({
      message: 'Get user profile successfully',
      user: existingUser,
    });
  }

  public async getUserProfileById(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const cachedUser: IUserDocument = (await userCache.getUserFromCache(
      `${userId}`,
    )) as IUserDocument;
    const existingUser: IUserDocument = cachedUser
      ? cachedUser
      : await userService.getUserById(`${userId}`);

    res.status(HTTP_STATUS.OK).json({
      message: 'Get user profile by id successfully',
      user: existingUser,
    });
  }

  public async getUserProfileAndPosts(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { userId, username, uId } = req.params;
    const userName: string = Helpers.firstLetterUppercase(username as string);
    const cachedUser: IUserDocument = (await userCache.getUserFromCache(
      `${userId}`,
    )) as IUserDocument;
    const cachedUserPosts: IPostDocument[] =
      await postCache.getUserPostsFromCache(
        'post',
        parseInt(uId as string, 10),
      );

    const existingUser: IUserDocument = cachedUser
      ? cachedUser
      : await userService.getUserById(`${userId}`);

    const userPosts: IPostDocument[] = cachedUserPosts.length
      ? cachedUserPosts
      : await postService.getPosts({ username: userName }, 0, 100, {
          createdAt: -1,
        });

    res.status(HTTP_STATUS.OK).json({
      message: 'Get user profile and posts successfully',
      user: existingUser,
      posts: userPosts,
    });
  }

  public async randomUserSuggestions(
    req: Request,
    res: Response,
  ): Promise<void> {
    let randomUsers: IUserDocument[] = [];
    const cachedUsers: IUserDocument[] =
      await userCache.getRandomUsersFromCache(
        `${req.currentUser!.userId}`,
        req.currentUser!.username,
      );

    if (cachedUsers.length) {
      randomUsers = [...cachedUsers];
    } else {
      const users: IUserDocument[] = await userService.getRandomUsers(
        `${req.currentUser!.userId}`,
      );
      randomUsers = [...users];
    }

    res.status(HTTP_STATUS.OK).json({
      message: 'Get random users successfully',
      users: randomUsers,
    });
  }

  private async allUsers({
    newSkip,
    limit,
    skip,
    userId,
  }: IUserAll): Promise<IAllUsers> {
    let users;
    let type = '';
    const cachedUsers: IUserDocument[] = await userCache.getUsersFromCache(
      newSkip,
      limit,
      userId,
    );

    if (cachedUsers.length) {
      type = 'redis';
      users = cachedUsers;
    } else {
      type = 'mongodb';
      users = await userService.getAllUsers(userId, skip, limit);
    }

    const totalUsers: number =
      await GetProfileController.prototype.getTotalUsers(type);

    return {
      users,
      totalUsers,
    };
  }

  private async getTotalUsers(type: string): Promise<number> {
    const totalUsers: number =
      type === 'redis'
        ? await userCache.getTotalUsersInCache()
        : await userService.getTotalUsersInDB();

    return totalUsers;
  }

  private async followers(userId: string): Promise<IFollowerData[]> {
    const cachedFollowers: IFollowerData[] =
      await followerCache.getFollowersFromCache(`followers:${userId}`);
    const result = cachedFollowers.length
      ? cachedFollowers
      : await followerService.getFollowerData(
          new mongoose.Types.ObjectId(userId),
        );
    return result;
  }
}
