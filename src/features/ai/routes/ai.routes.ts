import express, { Router } from 'express';
import { AIController } from '@ai/controllers/ai.controller';
import { authMiddleware } from '@global/helpers/auth-middleware';

class AIRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.post('/ai/generate-caption', authMiddleware.checkAuthentication, AIController.prototype.generateCaption);
    this.router.post('/ai/check-content', authMiddleware.checkAuthentication, AIController.prototype.checkContent);
    this.router.post('/ai/moderation-advice', authMiddleware.checkAuthentication, AIController.prototype.getModerationAdvice);
    this.router.post('/ai/best-time', authMiddleware.checkAuthentication, AIController.prototype.getBestTime);
    return this.router;
  }
}

export const aiRoutes: AIRoutes = new AIRoutes();
