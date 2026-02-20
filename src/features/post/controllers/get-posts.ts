import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { IPostDocument } from '@post/interfaces/post.interface';
import { postService } from '@service/db/post.service';
import { PostCache } from '@service/redis/post.cache';

const postCache: PostCache = new PostCache();
const PAGE_SIZE = 10;

export class GetPostsController {
  public async posts(req: Request, res: Response): Promise<void> {
    const { page } = req.params;
    const skip: number = (Number(page) - 1) * PAGE_SIZE;
    const limit: number = PAGE_SIZE * parseInt(page as string);
    const start: number = skip === 0 ? skip : skip + 1;
    let posts: IPostDocument[] = [];
    let totalPosts = 0;
    const cachedPosts: IPostDocument[] = await postCache.getPostsFromCache(
      'post',
      start,
      limit,
    );
    if (cachedPosts.length) {
      posts = cachedPosts;
      totalPosts = await postCache.getTotalPostsFromCache();
    } else {
      posts = await postService.getPosts({}, start, limit, {
        createdAt: -1,
      });
      totalPosts = await postService.postsCount();
    }

    res
      .status(HTTP_STATUS.OK)
      .json({ message: 'Posts retrieved successfully', posts, totalPosts });
  }

  public async postsWithImages(req: Request, res: Response): Promise<void> {
    const { page } = req.params;
    const skip: number = (Number(page) - 1) * PAGE_SIZE;
    const limit: number = PAGE_SIZE * parseInt(page as string);
    const start: number = skip === 0 ? skip : skip + 1;
    let posts: IPostDocument[] = [];
    const cachedPosts: IPostDocument[] =
      await postCache.getPostsWithImagesFromCache('post', start, limit);

    posts = cachedPosts.length
      ? cachedPosts
      : await postService.getPosts(
          { imgId: '$ne', gifUrl: '$ne' },
          start,
          limit,
          {
            createdAt: -1,
          },
        );

    res.status(HTTP_STATUS.OK).json({
      message: 'Posts with images retrieved successfully',
      posts,
    });
  }
}
