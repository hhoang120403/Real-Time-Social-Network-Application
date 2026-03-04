import { authMiddleware } from '@global/helpers/auth-middleware';
import { CreatePostController } from '@post/controllers/create-post';
import { DeletePostController } from '@post/controllers/delete-post';
import { GetPostsController } from '@post/controllers/get-posts';
import { UpdatePostController } from '@post/controllers/update-post';
import express, { Router } from 'express';

class PostRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get(
      '/post/all/:page',
      authMiddleware.checkAuthentication,
      GetPostsController.prototype.posts,
    );
    this.router.get(
      '/post/images/:page',
      authMiddleware.checkAuthentication,
      GetPostsController.prototype.postsWithImages,
    );
    this.router.get(
      '/post/videos/:page',
      authMiddleware.checkAuthentication,
      GetPostsController.prototype.postsWithVideos,
    );

    this.router.post(
      '/post',
      authMiddleware.checkAuthentication,
      CreatePostController.prototype.post,
    );

    this.router.post(
      '/post/image/post',
      authMiddleware.checkAuthentication,
      CreatePostController.prototype.postWithImage,
    );

    this.router.post(
      '/post/video/post',
      authMiddleware.checkAuthentication,
      CreatePostController.prototype.postWithVideo,
    );

    this.router.put(
      '/post/:postId',
      authMiddleware.checkAuthentication,
      UpdatePostController.prototype.update,
    );

    this.router.put(
      '/post/image/:postId',
      authMiddleware.checkAuthentication,
      UpdatePostController.prototype.updatePostWithImage,
    );

    this.router.put(
      '/post/video/:postId',
      authMiddleware.checkAuthentication,
      UpdatePostController.prototype.updatePostWithVideo,
    );

    this.router.delete(
      '/post/:postId',
      authMiddleware.checkAuthentication,
      DeletePostController.prototype.delete,
    );

    return this.router;
  }
}

export const postRoutes: PostRoutes = new PostRoutes();
