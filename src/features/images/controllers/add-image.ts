import { UserCache } from '@service/redis/user.cache';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { addImageSchema } from '@image/schemas/images';
import { UploadApiResponse } from 'cloudinary';
import { uploads } from '@global/helpers/cloudinary-upload';
import { BadRequestError } from '@global/helpers/error-handler';
import { config } from '@root/config';
import { IUserDocument } from '@user/interfaces/user.interface';
import { socketIOImageObject } from '@socket/image';
import { imageQueue } from '@service/queues/image.queue';
import { IBgUploadResponse } from '@image/interfaces/image.interface';
import { Helpers } from '@global/helpers/helpers';

const userCache: UserCache = new UserCache();

export class AddImageController {
  @joiValidation(addImageSchema)
  public async addProfileImage(req: Request, res: Response): Promise<void> {
    const { image } = req.body;
    const result: UploadApiResponse = (await uploads(
      image,
      `${req.currentUser!.userId}`,
      true,
      true,
    )) as UploadApiResponse;

    if (!result?.public_id) {
      throw new BadRequestError('Failed to upload avatar image');
    }

    const url = `https://res.cloudinary.com/${config.CLOUD_NAME}/image/upload/v${result.version}/${result.public_id}`;

    const cachedUser: IUserDocument | null =
      (await userCache.updateSingleUserItemInCache(
        `${req.currentUser!.userId}`,
        'profilePicture',
        url,
      )) as IUserDocument;

    socketIOImageObject.emit('update user', cachedUser);

    imageQueue.addImageJob('updateUserProfileImage', {
      key: `${req.currentUser!.userId}`,
      value: url,
      imgId: result.public_id,
      imgVersion: result.version.toString(),
    });

    res.status(HTTP_STATUS.OK).json({
      message: 'Profile image updated successfully',
    });
  }

  @joiValidation(addImageSchema)
  public async addBackgroundImage(req: Request, res: Response): Promise<void> {
    const { version, publicId }: IBgUploadResponse =
      await AddImageController.prototype.backgroundUpload(req.body.image);

    const bgImageId: Promise<IUserDocument> =
      userCache.updateSingleUserItemInCache(
        `${req.currentUser!.userId}`,
        'bgImageId',
        publicId,
      ) as Promise<IUserDocument>;

    const bgImageVersion: Promise<IUserDocument> =
      userCache.updateSingleUserItemInCache(
        `${req.currentUser!.userId}`,
        'bgImageVersion',
        version,
      ) as Promise<IUserDocument>;

    const response: [IUserDocument, IUserDocument] = await Promise.all([
      bgImageId,
      bgImageVersion,
    ]);

    socketIOImageObject.emit('update user', {
      bgImageId: publicId,
      bgImageVersion: version,
      userId: response[0],
    });

    imageQueue.addImageJob('updateBackgroundImage', {
      key: `${req.currentUser!.userId}`,
      imgId: publicId,
      imgVersion: version,
    });

    res.status(HTTP_STATUS.OK).json({
      message: 'Background image updated successfully',
    });
  }

  private async backgroundUpload(image: string): Promise<IBgUploadResponse> {
    const isDataUrl = Helpers.isDataUrl(image);
    let version = '';
    let publicId = '';

    if (isDataUrl) {
      const result: UploadApiResponse = (await uploads(
        image,
      )) as UploadApiResponse;

      if (!result?.public_id) {
        throw new BadRequestError(result.message);
      } else {
        version = result.version.toString();
        publicId = result.public_id;
      }
    } else {
      const value = image.split('/');
      publicId = value[value.length - 1];
      version = value[value.length - 2];
    }

    return {
      version: version.replace(/v/g, ''),
      publicId,
    };
  }
}
