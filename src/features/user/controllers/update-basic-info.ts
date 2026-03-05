import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { UserCache } from '@service/redis/user.cache';
import { userQueue } from '@service/queues/user.queue';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { basicInfoSchema, socialLinksSchema } from '@user/schemas/info';

const userCache: UserCache = new UserCache();

export class UpdateBasicInfoController {
  @joiValidation(basicInfoSchema)
  public async updateBasicInfo(req: Request, res: Response): Promise<void> {
    for (const [key, value] of Object.entries(req.body)) {
      await userCache.updateSingleUserItemInCache(
        `${req.currentUser!.userId}`,
        key,
        `${value}`,
      );
    }

    userQueue.addUserJob('updateUserInfoInDB', {
      key: `${req.currentUser!.userId}`,
      value: req.body,
    });

    res
      .status(HTTP_STATUS.OK)
      .json({ message: 'Updated user info successfully' });
  }

  @joiValidation(socialLinksSchema)
  public async updateSocialLinks(req: Request, res: Response): Promise<void> {
    await userCache.updateSingleUserItemInCache(
      `${req.currentUser!.userId}`,
      'social',
      req.body,
    );

    userQueue.addUserJob('updateSocialLinksInDB', {
      key: `${req.currentUser!.userId}`,
      value: req.body,
    });

    res
      .status(HTTP_STATUS.OK)
      .json({ message: 'Updated user social links successfully' });
  }
}
