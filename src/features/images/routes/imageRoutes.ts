import { authMiddleware } from '@global/helpers/auth-middleware';
import { AddImageController } from '@image/controllers/add-image';
import { DeleteImageController } from '@image/controllers/delete-image';
import { GetImagesController } from '@image/controllers/get-images';

import express, { Router } from 'express';

class ImageRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get(
      '/images/:userId',
      authMiddleware.checkAuthentication,
      GetImagesController.prototype.getImages,
    );
    this.router.post(
      '/images/profile',
      authMiddleware.checkAuthentication,
      AddImageController.prototype.addProfileImage,
    );
    this.router.post(
      '/images/background',
      authMiddleware.checkAuthentication,
      AddImageController.prototype.addBackgroundImage,
    );
    this.router.delete(
      '/images/:imageId',
      authMiddleware.checkAuthentication,
      DeleteImageController.prototype.deleteProfileImage,
    );
    this.router.delete(
      '/images/background/:bgImageId',
      authMiddleware.checkAuthentication,
      DeleteImageController.prototype.deleteBackgroundImage,
    );

    return this.router;
  }
}

export const imageRoutes: ImageRoutes = new ImageRoutes();
