/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { ObjectId } from 'mongodb';
import {
  addCommentReactionSchema,
  addCommentReplyReactionSchema,
  addCommentReplySchema,
  editCommentSchema,
  editCommentReplySchema,
} from '@comment/schemas/comment';
import { CommentCache } from '@service/redis/comment.cache';
import {
  ICommentDocument,
  ICommentReaction,
  ICommentReply,
} from '@comment/interfaces/comment.interface';
import { commentService } from '@service/db/comment.service';
import { uploads } from '@global/helpers/cloudinary-upload';
import { BadRequestError, NotAuthorizedError, NotFoundError } from '@global/helpers/error-handler';
import { UploadApiResponse } from 'cloudinary';
import mongoose from 'mongoose';

const commentCache: CommentCache = new CommentCache();

const getComment = async (postId: string, commentId: string): Promise<ICommentDocument> => {
  const cachedComment = await commentCache.getSingleCommentFromCache(postId, commentId);
  const comment =
    cachedComment.length > 0
      ? cachedComment[0]
      : (
          await commentService.getPostCommentsFromDB(
            {
              _id: new mongoose.Types.ObjectId(commentId),
              postId: new mongoose.Types.ObjectId(postId),
            },
            { createdAt: -1 },
          )
        )[0];

  if (!comment) {
    throw new NotFoundError('Comment not found');
  }

  return comment;
};

const isCommentOwner = (comment: ICommentDocument, req: Request): boolean =>
  `${comment.userFrom || ''}` === `${req.currentUser!.userId}` ||
  (!comment.userFrom && comment.username === req.currentUser!.username);

const isPostOwner = (comment: ICommentDocument, req: Request): boolean =>
  `${comment.userTo || ''}` === `${req.currentUser!.userId}`;

const getReply = (comment: ICommentDocument, replyId: string) => {
  const reply = (comment.replies || []).find(
    (item) => item._id?.toString() === replyId,
  );

  if (!reply) {
    throw new NotFoundError('Reply not found');
  }

  return reply;
};

const isReplyOwner = (reply: any, req: Request): boolean =>
  `${reply.userFrom || ''}` === `${req.currentUser!.userId}` ||
  (!reply.userFrom && reply.username === req.currentUser!.username);

export class UpdateCommentController {
  @joiValidation(addCommentReactionSchema)
  public async addCommentReaction(req: Request, res: Response): Promise<void> {
    const { postId, commentId, type, profilePicture, previousReaction } =
      req.body;
    const reaction: ICommentReaction = {
      username: `${req.currentUser!.username}`,
      avatarColor: `${req.currentUser!.avatarColor}`,
      type,
      profilePicture,
      createdAt: new Date(),
    };

    const cachedComment: ICommentDocument | null =
      await commentCache.updateCommentReactionInCache(
        postId,
        commentId,
        reaction,
        previousReaction,
      );
    const comment: ICommentDocument | null =
      await commentService.updateCommentReactionInDB(
        postId,
        commentId,
        reaction,
        previousReaction,
      );

    res.status(HTTP_STATUS.OK).json({
      message: 'Comment reaction updated successfully',
      comment: cachedComment || comment,
    });
  }

  @joiValidation(addCommentReplySchema)
  public async addCommentReply(req: Request, res: Response): Promise<void> {
    const { postId, commentId, profilePicture, comment, image, gifUrl } =
      req.body;

    let replyImage = '';
    if (image) {
      try {
        const result: UploadApiResponse = (await uploads(
          image,
        )) as UploadApiResponse;
        if (!result?.public_id) {
          throw new BadRequestError(result.message || 'Image upload failed');
        }
        replyImage = result.url;
      } catch (uploadError: any) {
        throw new BadRequestError(
          uploadError.message || 'Error uploading image',
        );
      }
    }

    const reply: ICommentReply = {
      _id: new ObjectId(),
      username: `${req.currentUser!.username}`,
      avatarColor: `${req.currentUser!.avatarColor}`,
      profilePicture,
      comment,
      image: replyImage,
      gifUrl: gifUrl || '',
      userFrom: req.currentUser!.userId,
      createdAt: new Date(),
    };

    const cachedComment: ICommentDocument | null =
      await commentCache.addCommentReplyToCache(postId, commentId, reply);
    const updatedComment: ICommentDocument | null =
      await commentService.addCommentReplyToDB(postId, commentId, reply);

    res.status(HTTP_STATUS.OK).json({
      message: 'Comment reply added successfully',
      comment: cachedComment || updatedComment,
      reply,
    });
  }

  @joiValidation(addCommentReplyReactionSchema)
  public async addCommentReplyReaction(
    req: Request,
    res: Response,
  ): Promise<void> {
    const {
      postId,
      commentId,
      replyId,
      type,
      profilePicture,
      previousReaction,
    } = req.body;
    const reaction: ICommentReaction = {
      username: `${req.currentUser!.username}`,
      avatarColor: `${req.currentUser!.avatarColor}`,
      type,
      profilePicture,
      createdAt: new Date(),
    };

    const cachedComment: ICommentDocument | null =
      await commentCache.updateCommentReplyReactionInCache(
        postId,
        commentId,
        replyId,
        reaction,
        previousReaction,
      );
    const comment: ICommentDocument | null =
      await commentService.updateCommentReplyReactionInDB(
        postId,
        commentId,
        replyId,
        reaction,
        previousReaction,
      );

    res.status(HTTP_STATUS.OK).json({
      message: 'Comment reply reaction updated successfully',
      comment: cachedComment || comment,
    });
  }

  @joiValidation(editCommentSchema)
  public async editComment(req: Request, res: Response): Promise<void> {
    const postId = req.params.postId as string;
    const commentId = req.params.commentId as string;
    const { comment } = req.body;
    const existingComment = await getComment(postId, commentId);

    if (!isCommentOwner(existingComment, req)) {
      throw new NotAuthorizedError('You are not allowed to edit this comment');
    }

    const cachedComment = await commentCache.updateCommentTextInCache(
      postId,
      commentId,
      comment,
    );
    const updatedComment = await commentService.updateCommentTextInDB(
      postId,
      commentId,
      comment,
    );

    res.status(HTTP_STATUS.OK).json({
      message: 'Comment updated successfully',
      comment: cachedComment || updatedComment,
    });
  }

  public async deleteComment(req: Request, res: Response): Promise<void> {
    const postId = req.params.postId as string;
    const commentId = req.params.commentId as string;
    const existingComment = await getComment(postId, commentId);

    if (!isCommentOwner(existingComment, req) && !isPostOwner(existingComment, req)) {
      throw new NotAuthorizedError('You are not allowed to delete this comment');
    }

    const cachedComment = await commentCache.deleteCommentFromCache(
      postId,
      commentId,
    );
    const deletedComment = await commentService.deleteCommentFromDB(
      postId,
      commentId,
    );

    res.status(HTTP_STATUS.OK).json({
      message: 'Comment deleted successfully',
      comment: cachedComment || deletedComment,
    });
  }

  @joiValidation(editCommentReplySchema)
  public async editCommentReply(req: Request, res: Response): Promise<void> {
    const postId = (req.params.postId || req.body.postId) as string;
    const commentId = (req.params.commentId || req.body.commentId) as string;
    const replyId = (req.params.replyId || req.body.replyId) as string;
    const { comment } = req.body;
    const existingComment = await getComment(postId, commentId);
    const reply = getReply(existingComment, replyId);

    if (!isReplyOwner(reply, req)) {
      throw new NotAuthorizedError('You are not allowed to edit this reply');
    }

    const cachedComment = await commentCache.updateCommentReplyTextInCache(
      postId,
      commentId,
      replyId,
      comment,
    );
    const updatedComment = await commentService.updateCommentReplyTextInDB(
      postId,
      commentId,
      replyId,
      comment,
    );

    res.status(HTTP_STATUS.OK).json({
      message: 'Reply updated successfully',
      comment: cachedComment || updatedComment,
    });
  }

  public async deleteCommentReply(req: Request, res: Response): Promise<void> {
    const postId = req.params.postId as string;
    const commentId = req.params.commentId as string;
    const replyId = req.params.replyId as string;
    const existingComment = await getComment(postId, commentId);
    const reply = getReply(existingComment, replyId);

    if (
      !isReplyOwner(reply, req) &&
      !isCommentOwner(existingComment, req) &&
      !isPostOwner(existingComment, req)
    ) {
      throw new NotAuthorizedError('You are not allowed to delete this reply');
    }

    const cachedComment = await commentCache.deleteCommentReplyFromCache(
      postId,
      commentId,
      replyId,
    );
    const updatedComment = await commentService.deleteCommentReplyFromDB(
      postId,
      commentId,
      replyId,
    );

    res.status(HTTP_STATUS.OK).json({
      message: 'Reply deleted successfully',
      comment: cachedComment || updatedComment,
    });
  }
}
