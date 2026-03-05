import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { CommentCache } from '@service/redis/comment.cache';
import {
  ICommentDocument,
  ICommentNameList,
} from '@comment/interfaces/comment.interface';
import { commentService } from '@service/db/comment.service';
import mongoose from 'mongoose';

const commentCache: CommentCache = new CommentCache();

export class GetCommentController {
  public async getComments(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;
    const cachedComments: ICommentDocument[] =
      await commentCache.getCommentsFromCache(postId as string);
    const comments: ICommentDocument[] = cachedComments.length
      ? cachedComments
      : await commentService.getPostCommentsFromDB(
          {
            postId: new mongoose.Types.ObjectId(postId as string),
          },
          { createdAt: -1 },
        );

    res.status(HTTP_STATUS.OK).json({
      message: 'Comments retrieved successfully',
      comments,
    });
  }

  public async getCommentsNames(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;
    const cachedCommentsNames: ICommentNameList[] =
      await commentCache.getCommentsNamesFromCache(postId as string);
    const commentsNames: ICommentNameList[] = cachedCommentsNames.length
      ? cachedCommentsNames
      : await commentService.getPostCommentNames(
          {
            postId: new mongoose.Types.ObjectId(postId as string),
          },
          { createdAt: -1 },
        );

    res.status(HTTP_STATUS.OK).json({
      message: 'Comments names retrieved successfully',
      comments: commentsNames,
    });
  }

  public async getSingleComment(req: Request, res: Response): Promise<void> {
    const { postId, commentId } = req.params;
    const cachedComments: ICommentDocument[] =
      await commentCache.getSingleCommentFromCache(
        postId as string,
        commentId as string,
      );
    const comments: ICommentDocument[] = cachedComments.length
      ? cachedComments
      : await commentService.getPostCommentsFromDB(
          {
            _id: new mongoose.Types.ObjectId(commentId as string),
          },
          { createdAt: -1 },
        );

    res.status(HTTP_STATUS.OK).json({
      message: 'Single comment retrieved successfully',
      comments: comments.length ? comments[0] : [],
    });
  }
}
