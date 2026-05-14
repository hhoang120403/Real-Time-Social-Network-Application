import { authMiddleware } from '@global/helpers/auth-middleware';
import { GetCommentController } from '@comment/controllers/get-comments';
import express, { Router } from 'express';
import { AddCommentController } from '@comment/controllers/add-comment';
import { UpdateCommentController } from '@comment/controllers/update-comment';

class CommentRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get(
      '/post/comments/:postId',
      authMiddleware.checkAuthentication,
      GetCommentController.prototype.getComments,
    );
    this.router.get(
      '/post/comments/names/:postId',
      authMiddleware.checkAuthentication,
      GetCommentController.prototype.getCommentsNames,
    );
    this.router.get(
      '/post/single/comment/:postId/:commentId',
      authMiddleware.checkAuthentication,
      GetCommentController.prototype.getSingleComment,
    );
    this.router.post(
      '/post/comment',
      authMiddleware.checkAuthentication,
      AddCommentController.prototype.addComment,
    );
    this.router.put(
      '/post/comment/reaction',
      authMiddleware.checkAuthentication,
      UpdateCommentController.prototype.addCommentReaction,
    );
    this.router.post(
      '/post/comment/reply',
      authMiddleware.checkAuthentication,
      UpdateCommentController.prototype.addCommentReply,
    );
    this.router.put(
      '/post/comment/reply',
      authMiddleware.checkAuthentication,
      UpdateCommentController.prototype.editCommentReply,
    );
    this.router.put(
      '/post/comment/reply/reaction',
      authMiddleware.checkAuthentication,
      UpdateCommentController.prototype.addCommentReplyReaction,
    );
    this.router.put(
      '/post/comment/:postId/:commentId',
      authMiddleware.checkAuthentication,
      UpdateCommentController.prototype.editComment,
    );
    this.router.delete(
      '/post/comment/:postId/:commentId',
      authMiddleware.checkAuthentication,
      UpdateCommentController.prototype.deleteComment,
    );
    this.router.put(
      '/post/comment/:postId/:commentId/reply/:replyId',
      authMiddleware.checkAuthentication,
      UpdateCommentController.prototype.editCommentReply,
    );
    this.router.delete(
      '/post/comment/:postId/:commentId/reply/:replyId',
      authMiddleware.checkAuthentication,
      UpdateCommentController.prototype.deleteCommentReply,
    );

    return this.router;
  }
}

export const commentRoutes: CommentRoutes = new CommentRoutes();
