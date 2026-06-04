import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { PostCache } from '@service/redis/post.cache';
import { socketIOPostObject } from '@socket/post';
import { postQueue } from '@service/queues/post.queue';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import {
  postSchema,
  postWithImageSchema,
  postWithVideoSchema,
} from '@post/schemas/post.schemas';
import { IPostDocument } from '@post/interfaces/post.interface';
import { UploadApiResponse } from 'cloudinary';
import { uploadVideo, uploads } from '@global/helpers/cloudinary-upload';
import { BadRequestError } from '@global/helpers/error-handler';
import { imageQueue } from '@service/queues/image.queue';
import { moderationService } from '@ai/services/moderation.service';

const postCache: PostCache = new PostCache();

export class UpdatePostController {
  @joiValidation(postSchema)
  public async update(req: Request, res: Response): Promise<void> {
    const postUpdated = await UpdatePostController.prototype.handleUpdatePost(req);

    res.status(HTTP_STATUS.OK).json({ message: 'Post updated successfully', post: postUpdated });
  }

  @joiValidation(postWithImageSchema)
  public async updatePostWithImage(req: Request, res: Response): Promise<void> {
    const { imgId, imgVersion } = req.body;
    let postUpdated: IPostDocument;
    if (imgId && imgVersion) {
      postUpdated = await UpdatePostController.prototype.handleUpdatePost(req);
    } else {
      postUpdated = await UpdatePostController.prototype.addFileToExistingPost(req);
    }

    res
      .status(HTTP_STATUS.OK)
      .json({ message: 'Post with image updated successfully', post: postUpdated });
  }

  @joiValidation(postWithVideoSchema)
  public async updatePostWithVideo(req: Request, res: Response): Promise<void> {
    const { videoId, videoVersion } = req.body;
    let postUpdated: IPostDocument;
    if (videoId && videoVersion) {
      postUpdated = await UpdatePostController.prototype.handleUpdatePost(req);
    } else {
      postUpdated = await UpdatePostController.prototype.addFileToExistingPost(req);
    }

    res
      .status(HTTP_STATUS.OK)
      .json({ message: 'Post with video updated successfully', post: postUpdated });
  }

  private async handleUpdatePost(req: Request): Promise<IPostDocument> {
    const {
      post,
      bgColor,
      feelings,
      privacy,
      gifUrl,
      imgVersion,
      imgId,
      videoId,
      videoVersion,
      profilePicture,
    } = req.body;
    const { postId } = req.params;
    const updatedPost: IPostDocument = {
      post,
      bgColor,
      feelings,
      privacy,
      gifUrl,
      imgVersion: imgVersion ? imgVersion : '',
      imgId: imgId ? imgId : '',
      videoId: videoId ? videoId : '',
      videoVersion: videoVersion ? videoVersion : '',
      profilePicture,
    } as IPostDocument;

    const postUpdated: IPostDocument = await postCache.updatePostInCache(
      postId as string,
      updatedPost,
    );

    if (post) {
      const moderationResult = await moderationService.checkContent(post);
      if (moderationResult?.is_inappropriate) {
        throw new BadRequestError(
          'Post content is inappropriate. Please check again.',
        );
      }
    }

    socketIOPostObject.emit('update post', postUpdated, 'posts');

    postQueue.addPostJob('updatePostInDB', {
      key: postId as string,
      value: postUpdated,
    });

    return postUpdated;
  }

  private async addFileToExistingPost(
    req: Request,
  ): Promise<IPostDocument> {
    const {
      post,
      bgColor,
      feelings,
      privacy,
      gifUrl,
      image,
      video,
      profilePicture,
    } = req.body;
    const { postId } = req.params;
    const result: UploadApiResponse = image
      ? ((await uploads(image)) as UploadApiResponse)
      : ((await uploadVideo(video)) as UploadApiResponse);

    if (!result?.public_id) {
      throw new BadRequestError(result.message);
    }

    const updatedPost: IPostDocument = {
      post,
      bgColor,
      feelings,
      privacy,
      gifUrl,
      imgId: image ? result.public_id : '',
      imgVersion: image ? result.version.toString() : '',
      videoId: video ? result.public_id : '',
      videoVersion: video ? result.version.toString() : '',
      profilePicture,
    } as IPostDocument;

    const postUpdated: IPostDocument = await postCache.updatePostInCache(
      postId as string,
      updatedPost,
    );

    socketIOPostObject.emit('update post', postUpdated, 'posts');

    postQueue.addPostJob('updatePostInDB', {
      key: postId as string,
      value: postUpdated,
    });

    if (image) {
      // Call image queue to add image to mongodb database
      imageQueue.addImageJob('addImageToDB', {
        key: `${req.currentUser!.userId}`,
        imgId: result.public_id,
        imgVersion: result.version.toString(),
      });
    }

    return postUpdated;
  }
}
