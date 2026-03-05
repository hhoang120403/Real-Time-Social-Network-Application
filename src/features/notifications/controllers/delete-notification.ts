import { notificationQueue } from '@service/queues/notification.queue';
import { socketIONotificationObject } from '@socket/notification';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';

export class DeleteNotificationController {
  public async deleteNotification(req: Request, res: Response): Promise<void> {
    const { notificationId } = req.params;
    socketIONotificationObject.emit('delete notification', notificationId);
    notificationQueue.addNotificationJob('deleteNotification', {
      key: notificationId as string,
    });
    res
      .status(HTTP_STATUS.OK)
      .json({ message: 'Notification deleted successfully' });
  }
}
