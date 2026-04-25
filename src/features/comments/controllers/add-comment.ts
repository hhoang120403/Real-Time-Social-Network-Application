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

const commentCache: CommentCache = new CommentCache();

export class AddCommentController {
  @joiValidation(addCommentSchema)
  public async addComment(req: Request, res: Response): Promise<void> {
    const { userTo, postId, profilePicture, comment } = req.body;
    const commentObjectId: ObjectId = new ObjectId();
    const commentData: ICommentDocument = {
      _id: commentObjectId,
      postId,
      username: `${req.currentUser!.username}`,
      avatarColor: `${req.currentUser!.avatarColor}`,
      profilePicture,
      comment,
      userTo,
      userFrom: req.currentUser!.userId,
      createdAt: new Date(),
    } as ICommentDocument;

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

    res.status(HTTP_STATUS.OK).json({ message: 'Comment added successfully' });
  }
}
