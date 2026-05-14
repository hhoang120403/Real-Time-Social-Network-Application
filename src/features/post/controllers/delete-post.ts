import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { PostCache } from '@service/redis/post.cache';
import { socketIOPostObject } from '@socket/post';
import { postQueue } from '@service/queues/post.queue';

const postCache: PostCache = new PostCache();

export class DeletePostController {
  public async delete(req: Request, res: Response): Promise<void> {
    const deleteResult = await postCache.deletePostFromCache(
      req.params.postId as string,
      `${req.currentUser?.userId}`,
    );
    socketIOPostObject.emit('delete post', deleteResult.deletedPostIds);

    if (deleteResult.updatedOriginalPost) {
      socketIOPostObject.emit('update post', deleteResult.updatedOriginalPost);
    }

    postQueue.addPostJob('deletePostFromDB', {
      keyOne: req.params.postId as string,
      keyTwo: `${req.currentUser?.userId}`,
    });

    res.status(HTTP_STATUS.OK).json({ message: 'Post deleted successfully' });
  }
}
