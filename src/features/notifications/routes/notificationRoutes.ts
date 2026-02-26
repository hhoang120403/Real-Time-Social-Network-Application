import { authMiddleware } from '@global/helpers/auth-middleware';
import { DeleteNotificationController } from '@notification/controllers/delete-notification';
import { GetNotificationController } from '@notification/controllers/get-notifications';
import { UpdateNotificationController } from '@notification/controllers/update-notification';

import express, { Router } from 'express';

class NotificationRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get(
      '/notifications',
      authMiddleware.checkAuthentication,
      GetNotificationController.prototype.getNotifications,
    );
    this.router.put(
      '/notification/:notificationId',
      authMiddleware.checkAuthentication,
      UpdateNotificationController.prototype.markAsReadNotification,
    );
    this.router.delete(
      '/notification/:notificationId',
      authMiddleware.checkAuthentication,
      DeleteNotificationController.prototype.deleteNotification,
    );

    return this.router;
  }
}

export const notificationRoutes: NotificationRoutes = new NotificationRoutes();
