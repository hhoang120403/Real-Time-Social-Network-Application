import { authMiddleware } from '@global/helpers/auth-middleware';
import { CollectionController } from '@collections/controllers/collection.controller';
import express, { Router } from 'express';

class CollectionRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    const collectionController: CollectionController = new CollectionController();

    this.router.get('/collections', authMiddleware.checkAuthentication, collectionController.getCollections);
    this.router.get('/collections/:collectionId', authMiddleware.checkAuthentication, collectionController.getCollectionPosts);
    this.router.post('/collections', authMiddleware.checkAuthentication, collectionController.create);
    this.router.put('/collections/posts', authMiddleware.checkAuthentication, collectionController.updatePostCollections);
    this.router.delete('/collections/:collectionId', authMiddleware.checkAuthentication, collectionController.deleteCollection);

    return this.router;
  }
}

export const collectionRoutes: CollectionRoutes = new CollectionRoutes();
