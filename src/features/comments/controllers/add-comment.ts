/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { ObjectId } from 'mongodb';
import { addCommentSchema } from '@comment/schemas/comment';
import { CommentCache } from '@service/redis/comment.cache';
import {
  ICommentDocument,
  ICommentJob,
} from '@comment/interfaces/comment.interface';
import { commentQueue } from '@service/queues/comment.queue';
import { uploads } from '@global/helpers/cloudinary-upload';
import { BadRequestError } from '@global/helpers/error-handler';
import { UploadApiResponse } from 'cloudinary';
import { config } from '@root/config';

const commentCache: CommentCache = new CommentCache();
const log = config.createLogger('addCommentController');
import { moderationService } from '@ai/services/moderation.service';

export class AddCommentController {
  @joiValidation(addCommentSchema)
  public async addComment(req: Request, res: Response): Promise<void> {
    log.info('Received add comment request body:', req.body);
    const { userTo, postId, profilePicture, comment, image, gifUrl } = req.body;

    let commentImage = '';
    if (image) {
      try {
        const result: UploadApiResponse = (await uploads(
          image,
        )) as UploadApiResponse;
        if (!result?.public_id) {
          log.error('Cloudinary upload failed:', result);
          throw new BadRequestError(result.message || 'Image upload failed');
        }
        commentImage = result.url;
      } catch (uploadError: any) {
        log.error('Upload Error:', uploadError);
        throw new BadRequestError(
          uploadError.message || 'Error uploading image',
        );
      }
    }

    if (comment) {
      const moderationResult = await moderationService.checkContent(comment);
      if (moderationResult?.is_inappropriate) {
        throw new BadRequestError('Comment content is inappropriate. Please check again.');
      }
    }

    const commentObjectId: ObjectId = new ObjectId();
    const commentData: ICommentDocument = {
      _id: commentObjectId,
      postId,
      username: `${req.currentUser!.username}`,
      avatarColor: `${req.currentUser!.avatarColor}`,
      profilePicture,
      comment,
      image: commentImage,
      gifUrl: gifUrl || '',
      userTo,
      userFrom: req.currentUser!.userId,
      reactions: {
        like: 0,
        love: 0,
        happy: 0,
        wow: 0,
        sad: 0,
        angry: 0,
      },
      reactionList: [],
      replies: [],
      createdAt: new Date(),
    } as unknown as ICommentDocument;

    await commentCache.savePostCommentToCache(
      postId,
      JSON.stringify(commentData),
    );

    const databaseCommentData: ICommentJob = {
      postId,
      userTo,
      userFrom: req.currentUser!.userId,
      username: req.currentUser!.username,
      comment: commentData,
    };

    commentQueue.addCommentJob('addCommentToDB', databaseCommentData);

    res.status(HTTP_STATUS.OK).json({ 
      message: 'Comment added successfully',
      comment: commentData
    });
  }
}
