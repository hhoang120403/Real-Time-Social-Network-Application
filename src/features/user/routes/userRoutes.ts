import { authMiddleware } from '@global/helpers/auth-middleware';
import { ChangePasswordController } from '@user/controllers/change-password';
import { GetProfileController } from '@user/controllers/get-profile';
import { SearchUserController } from '@user/controllers/search-user';
import { UpdateBasicInfoController } from '@user/controllers/update-basic-info';
import { UpdateSettingsController } from '@user/controllers/update-settings';
import express, { Router } from 'express';

class UserRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get(
      '/user/all/:page',
      authMiddleware.checkAuthentication,
      GetProfileController.prototype.getAllUsers,
    );

    this.router.get(
      '/user/profile',
      authMiddleware.checkAuthentication,
      GetProfileController.prototype.getUserProfile,
    );

    this.router.get(
      '/user/profile/:userId',
      authMiddleware.checkAuthentication,
      GetProfileController.prototype.getUserProfileById,
    );

    this.router.get(
      '/user/profile/posts/:username/:userId/:uId',
      authMiddleware.checkAuthentication,
      GetProfileController.prototype.getUserProfileAndPosts,
    );

    this.router.get(
      '/user/profile/user/suggestions',
      authMiddleware.checkAuthentication,
      GetProfileController.prototype.randomUserSuggestions,
    );

    this.router.get(
      '/user/profile/search/:query',
      authMiddleware.checkAuthentication,
      SearchUserController.prototype.searchUsers,
    );

    this.router.put(
      '/user/profile/change-password',
      authMiddleware.checkAuthentication,
      ChangePasswordController.prototype.changePassword,
    );

    this.router.put(
      '/user/profile/basic-info',
      authMiddleware.checkAuthentication,
      UpdateBasicInfoController.prototype.updateBasicInfo,
    );

    this.router.put(
      '/user/profile/social-links',
      authMiddleware.checkAuthentication,
      UpdateBasicInfoController.prototype.updateSocialLinks,
    );

    this.router.put(
      '/user/profile/settings',
      authMiddleware.checkAuthentication,
      UpdateSettingsController.prototype.updateNotification,
    );

    return this.router;
  }
}

export const userRoutes: UserRoutes = new UserRoutes();
