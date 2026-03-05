import { authMiddleware } from '@global/helpers/auth-middleware';
import { GetCommentController } from '@comment/controllers/get-comments';
import express, { Router } from 'express';
import { AddCommentController } from '@comment/controllers/add-comment';

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

    return this.router;
  }
}

export const commentRoutes: CommentRoutes = new CommentRoutes();
