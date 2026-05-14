/* eslint-disable @typescript-eslint/no-explicit-any */
import { IPostDocument } from '@post/interfaces/post.interface';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { ObjectId } from 'mongodb';
import { PostCache } from '@service/redis/post.cache';
import { socketIOPostObject } from '@socket/post';
import { postQueue } from '@service/queues/post.queue';
import { UserCache } from '@service/redis/user.cache';
import { analyticsQueue } from '@service/queues/analytics.queue';
import { PostModel } from '@post/models/post.schema';
import { BadRequestError } from '@global/helpers/error-handler';
import { moderationService } from '@ai/services/moderation.service';

const postCache: PostCache = new PostCache();
const userCache: UserCache = new UserCache();

export class SharePostController {
  public async post(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;
    const { post: newCaption, privacy, feelings } = req.body;
    const postIdStr = `${postId}`;

    // 1. Fetch the original post
    const originalPost: IPostDocument = (await PostModel.findById(
      postIdStr,
    ).lean()) as IPostDocument;
    if (!originalPost) {
      throw new BadRequestError('Original post not found');
    }

    if (originalPost.userId.toString() === req.currentUser!.userId) {
      throw new BadRequestError('You cannot share your own post');
    }

    const user = await userCache.getUserFromCache(`${req.currentUser!.userId}`);

    // 2. Extract shared post details
    const sharedPostDetails = {
      _id: originalPost._id,
      userId: originalPost.userId,
      username: originalPost.username,
      email: originalPost.email,
      avatarColor: originalPost.avatarColor,
      profilePicture: originalPost.profilePicture,
      post: originalPost.post,
      bgColor: originalPost.bgColor,
      imgVersion: originalPost.imgVersion,
      imgId: originalPost.imgId,
      videoId: originalPost.videoId,
      videoVersion: originalPost.videoVersion,
      gifUrl: originalPost.gifUrl,
      privacy: originalPost.privacy,
      createdAt: originalPost.createdAt,
    };

    // 3. Create the new post
    const postObjectId: ObjectId = new ObjectId();
    const createdPost: IPostDocument = {
      _id: postObjectId,
      userId: req.currentUser!.userId,
      username: req.currentUser!.username,
      email: req.currentUser!.email,
      avatarColor: req.currentUser!.avatarColor,
      profilePicture: user?.profilePicture || '',
      post: newCaption || '',
      bgColor: '#ffffff', // Shared posts usually have a white background for the caption
      feelings: feelings || '',
      privacy: privacy || 'Public',
      gifUrl: '',
      imgVersion: '',
      imgId: '',
      videoVersion: '',
      videoId: '',
      commentsCount: 0,
      sharesCount: 0,
      savesCount: 0,
      followerCountAtPostTime: user?.followersCount || 0,
      createdAt: new Date(),
      reactions: { like: 0, love: 0, happy: 0, angry: 0, sad: 0, wow: 0 },
      sharedPost: sharedPostDetails,
    } as IPostDocument;

    if (newCaption) {
      const moderationResult = await moderationService.checkContent(newCaption);
      if (moderationResult?.is_inappropriate) {
        throw new BadRequestError('Post content is inappropriate. Please check again.');
      }
    }

    // 4. Save shared post to Cache & DB
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

    // 4. Increment sharesCount on original post
    const updatedPost = await PostModel.findOneAndUpdate(
      { _id: postIdStr },
      { $inc: { sharesCount: 1 } },
      { new: true },
    ).lean();

    if (updatedPost) {
      await postCache.updatePostInCache(postIdStr, updatedPost as any);

      // Socket update for the original post's count
      socketIOPostObject.emit('update post', updatedPost);
    }

    // 5. Analytics
    analyticsQueue.addAnalyticsJob(
      'calculate-post-engagement',
      { postId: postObjectId.toString(), userId: req.currentUser!.userId },
      { delay: 24 * 60 * 60 * 1000 },
    );

    res
      .status(HTTP_STATUS.OK)
      .json({ message: 'Post shared successfully', post: updatedPost });
  }
}
