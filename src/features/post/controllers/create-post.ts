import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { IPostDocument } from '@post/interfaces/post.interface';
import {
  postSchema,
  postWithImageSchema,
  postWithVideoSchema,
} from '@post/schemas/post.schemas';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { ObjectId } from 'mongodb';
import { PostCache } from '@service/redis/post.cache';
import { socketIOPostObject } from '@socket/post';
import { postQueue } from '@service/queues/post.queue';
import { UploadApiResponse } from 'cloudinary';
import { uploadVideo, uploads } from '@global/helpers/cloudinary-upload';
import { BadRequestError } from '@global/helpers/error-handler';
import { imageQueue } from '@service/queues/image.queue';
import { UserCache } from '@service/redis/user.cache';
import { analyticsQueue } from '@service/queues/analytics.queue';
import { moderationService } from '@ai/services/moderation.service';

const postCache: PostCache = new PostCache();
const userCache: UserCache = new UserCache();

export class CreatePostController {
  @joiValidation(postSchema)
  public async post(req: Request, res: Response): Promise<void> {
    const { post, bgColor, privacy, gifUrl, profilePicture, feelings } =
      req.body;

    const user = await userCache.getUserFromCache(`${req.currentUser!.userId}`);

    const postObjectId: ObjectId = new ObjectId();
    const createdPost: IPostDocument = {
      _id: postObjectId,
      userId: req.currentUser!.userId,
      username: req.currentUser!.username,
      email: req.currentUser!.email,
      avatarColor: req.currentUser!.avatarColor,
      profilePicture,
      post,
      bgColor,
      feelings,
      privacy,
      gifUrl,
      commentsCount: 0,
      sharesCount: 0,
      savesCount: 0,
      imgVersion: '',
      imgId: '',
      videoVersion: '',
      videoId: '',
      followerCountAtPostTime: user?.followersCount || 0,
      createdAt: new Date(),
      reactions: { like: 0, love: 0, happy: 0, angry: 0, sad: 0, wow: 0 },
    } as IPostDocument;

    if (post) {
      const moderationResult = await moderationService.checkContent(post);
      if (moderationResult?.is_inappropriate) {
        throw new BadRequestError('Post content is inappropriate. Please check again.');
      }
    }

    socketIOPostObject.emit('add post', createdPost);

    await postCache.savePostToCache({
      key: postObjectId.toString(),
      currentUserId: `${req.currentUser!.userId}`,
      uId: `${req.currentUser!.uId}`,
      createdPost,
    });

    postQueue.addPostJob('addPostToDB', {
      key: req.currentUser!.userId,
      value: createdPost,
    });

    analyticsQueue.addAnalyticsJob(
      'calculate-post-engagement',
      { postId: postObjectId.toString(), userId: req.currentUser!.userId },
      { delay: 24 * 60 * 60 * 1000 },
    );

    res
      .status(HTTP_STATUS.CREATED)
      .json({ message: 'Post created successfully' });
  }

  @joiValidation(postWithImageSchema)
  public async postWithImage(req: Request, res: Response): Promise<void> {
    const { post, bgColor, privacy, gifUrl, profilePicture, feelings, image } =
      req.body;

    const result: UploadApiResponse = (await uploads(
      image,
    )) as UploadApiResponse;

    if (!result?.public_id) {
      throw new BadRequestError(result.message);
    }

    const user = await userCache.getUserFromCache(`${req.currentUser!.userId}`);

    const postObjectId: ObjectId = new ObjectId();
    const createdPost: IPostDocument = {
      _id: postObjectId,
      userId: req.currentUser!.userId,
      username: req.currentUser!.username,
      email: req.currentUser!.email,
      avatarColor: req.currentUser!.avatarColor,
      profilePicture,
      post,
      bgColor,
      feelings,
      privacy,
      gifUrl,
      commentsCount: 0,
      sharesCount: 0,
      savesCount: 0,
      imgVersion: result.version.toString(),
      imgId: result.public_id!,
      videoVersion: '',
      videoId: '',
      followerCountAtPostTime: user?.followersCount || 0,
      createdAt: new Date(),
      reactions: { like: 0, love: 0, happy: 0, angry: 0, sad: 0, wow: 0 },
    } as IPostDocument;

    if (post) {
      const moderationResult = await moderationService.checkContent(post);
      if (moderationResult?.is_inappropriate) {
        throw new BadRequestError('Post content is inappropriate. Please check again.');
      }
    }

    socketIOPostObject.emit('add post', createdPost);

    await postCache.savePostToCache({
      key: postObjectId.toString(),
      currentUserId: `${req.currentUser!.userId}`,
      uId: `${req.currentUser!.uId}`,
      createdPost,
    });

    postQueue.addPostJob('addPostToDB', {
      key: req.currentUser!.userId,
      value: createdPost,
    });

    analyticsQueue.addAnalyticsJob(
      'calculate-post-engagement',
      { postId: postObjectId.toString(), userId: req.currentUser!.userId },
      { delay: 24 * 60 * 60 * 1000 },
    );

    // Call image queue to add image to mongodb database
    imageQueue.addImageJob('addImageToDB', {
      key: `${req.currentUser!.userId}`,
      imgId: result.public_id,
      imgVersion: result.version.toString(),
    });

    res
      .status(HTTP_STATUS.CREATED)
      .json({ message: 'Post created with image successfully' });
  }

  @joiValidation(postWithVideoSchema)
  public async postWithVideo(req: Request, res: Response): Promise<void> {
    const { post, bgColor, privacy, gifUrl, profilePicture, feelings, video } =
      req.body;

    const result: UploadApiResponse = (await uploadVideo(
      video,
    )) as UploadApiResponse;

    if (!result?.public_id) {
      throw new BadRequestError(result.message);
    }

    const user = await userCache.getUserFromCache(`${req.currentUser!.userId}`);

    const postObjectId: ObjectId = new ObjectId();
    const createdPost: IPostDocument = {
      _id: postObjectId,
      userId: req.currentUser!.userId,
      username: req.currentUser!.username,
      email: req.currentUser!.email,
      avatarColor: req.currentUser!.avatarColor,
      profilePicture,
      post,
      bgColor,
      feelings,
      privacy,
      gifUrl,
      commentsCount: 0,
      sharesCount: 0,
      savesCount: 0,
      imgVersion: '',
      imgId: '',
      videoVersion: result.version.toString(),
      videoId: result.public_id!,
      followerCountAtPostTime: user?.followersCount || 0,
      createdAt: new Date(),
      reactions: { like: 0, love: 0, happy: 0, angry: 0, sad: 0, wow: 0 },
    } as IPostDocument;

    if (post) {
      const moderationResult = await moderationService.checkContent(post);
      if (moderationResult?.is_inappropriate) {
        throw new BadRequestError('Post content is inappropriate. Please check again.');
      }
    }

    socketIOPostObject.emit('add post', createdPost);

    await postCache.savePostToCache({
      key: postObjectId.toString(),
      currentUserId: `${req.currentUser!.userId}`,
      uId: `${req.currentUser!.uId}`,
      createdPost,
    });

    postQueue.addPostJob('addPostToDB', {
      key: req.currentUser!.userId,
      value: createdPost,
    });

    analyticsQueue.addAnalyticsJob(
      'calculate-post-engagement',
      { postId: postObjectId.toString(), userId: req.currentUser!.userId },
      { delay: 24 * 60 * 60 * 1000 },
    );

    res
      .status(HTTP_STATUS.CREATED)
      .json({ message: 'Post created with video successfully' });
  }
}
