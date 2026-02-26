import { notificationQueue } from '@service/queues/notification.queue';
import { socketIONotificationObject } from '@socket/notification';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';

export class UpdateNotificationController {
  public async markAsReadNotification(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { notificationId } = req.params;
    socketIONotificationObject.emit('update notification', notificationId);
    notificationQueue.addNotificationJob('updateNotification', {
      key: notificationId as string,
    });
    res.status(HTTP_STATUS.OK).json({ message: 'Notification marked as read' });
  }
}
