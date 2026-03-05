import { UserCache } from '@service/redis/user.cache';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { IUserDocument } from '@user/interfaces/user.interface';
import { socketIOImageObject } from '@socket/image';
import { imageQueue } from '@service/queues/image.queue';
import { IFileImageDocument } from '@image/interfaces/image.interface';
import { imageService } from '@service/db/image.service';

const userCache: UserCache = new UserCache();

export class DeleteImageController {
  public async deleteProfileImage(req: Request, res: Response): Promise<void> {
    const { imageId } = req.params;
    socketIOImageObject.emit('delete image', imageId);

    imageQueue.addImageJob('removeImageFromDB', {
      imageId: imageId as string,
    });

    res.status(HTTP_STATUS.OK).json({
      message: 'Profile image deleted successfully',
    });
  }

  public async deleteBackgroundImage(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { imageId } = req.params;
    const image: IFileImageDocument = await imageService.getImageByBackgroundId(
      imageId as string,
    );
    socketIOImageObject.emit('delete image', image?._id?.toString());

    const bgImageId: Promise<IUserDocument> =
      userCache.updateSingleUserItemInCache(
        `${req.currentUser!.userId}`,
        'bgImageId',
        '',
      ) as Promise<IUserDocument>;

    const bgImageVersion: Promise<IUserDocument> =
      userCache.updateSingleUserItemInCache(
        `${req.currentUser!.userId}`,
        'bgImageVersion',
        '',
      ) as Promise<IUserDocument>;

    await Promise.all([bgImageId, bgImageVersion]);

    imageQueue.addImageJob('removeImageFromDB', {
      imageId: image?._id?.toString(),
    });
    imageQueue.addImageJob('updateBackgroundImage', {
      key: `${req.currentUser!.userId}`,
      imgId: '',
      imgVersion: '',
    });

    res.status(HTTP_STATUS.OK).json({
      message: 'Background image deleted successfully',
    });
  }
}
