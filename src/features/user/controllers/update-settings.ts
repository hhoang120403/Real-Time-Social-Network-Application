import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { UserCache } from '@service/redis/user.cache';
import { userQueue } from '@service/queues/user.queue';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { notificationSettingsSchema } from '@user/schemas/info';

const userCache: UserCache = new UserCache();

export class UpdateSettingsController {
  @joiValidation(notificationSettingsSchema)
  public async updateNotification(req: Request, res: Response): Promise<void> {
    await userCache.updateSingleUserItemInCache(
      `${req.currentUser!.userId}`,
      'notifications',
      req.body,
    );

    userQueue.addUserJob('updateNotificationSettingsInDB', {
      key: `${req.currentUser!.userId}`,
      value: req.body,
    });

    res.status(HTTP_STATUS.OK).json({
      message: 'Updated user notification settings successfully',
      settings: req.body,
    });
  }
}
