import { authMiddleware } from '@global/helpers/auth-middleware';
import { AddReactionController } from '@reaction/controllers/add-reactions';
import { GetReactionsController } from '@reaction/controllers/get-reactions';
import { RemoveReactionController } from '@reaction/controllers/remove-reaction';
import express, { Router } from 'express';

class ReactionRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get(
      '/post/reactions/:postId',
      authMiddleware.checkAuthentication,
      GetReactionsController.prototype.getReactions,
    );
    this.router.get(
      '/post/single/reaction/username/:username/:postId',
      authMiddleware.checkAuthentication,
      GetReactionsController.prototype.getSingleReactionByUsername,
    );
    this.router.get(
      '/post/reactions/username/:username',
      authMiddleware.checkAuthentication,
      GetReactionsController.prototype.getReactionsByUsername,
    );
    this.router.post(
      '/post/reaction',
      authMiddleware.checkAuthentication,
      AddReactionController.prototype.addReaction,
    );
    this.router.delete(
      '/post/reaction/:postId/:previousReaction/:postReactions',
      authMiddleware.checkAuthentication,
      RemoveReactionController.prototype.removeReaction,
    );

    return this.router;
  }
}

export const reactionRoutes: ReactionRoutes = new ReactionRoutes();
