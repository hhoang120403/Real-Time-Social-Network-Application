import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { changePasswordSchema } from '@user/schemas/info';
import { BadRequestError } from '@global/helpers/error-handler';
import { authService } from '@service/db/auth.service';
import { IAuthDocument } from '@auth/interfaces/auth.interface';
import { IResetPasswordParams } from '@user/interfaces/user.interface';
import { resetPasswordTemplate } from '@service/emails/templates/reset-password/reset-password-template';
import { emailQueue } from '@service/queues/email.queue';
import moment from 'moment';
import publicIP from 'ip';
import { userService } from '@service/db/user.service';

export class ChangePasswordController {
  @joiValidation(changePasswordSchema)
  public async changePassword(req: Request, res: Response): Promise<void> {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      throw new BadRequestError('Passwords do not match');
    }

    const existingUser: IAuthDocument = await authService.getAuthUserByUsername(
      req.currentUser!.username,
    );

    const passwordsMatch: boolean =
      await existingUser.comparePassword(currentPassword);

    if (!passwordsMatch) {
      throw new BadRequestError('Invalid credentials');
    }

    const hashedPassword = await existingUser.hashPassword(newPassword);
    await userService.updatePassword(
      `${req.currentUser!.username}`,
      hashedPassword,
    );

    const templateParams: IResetPasswordParams = {
      username: existingUser.username!,
      email: existingUser.email!,
      ipaddress: publicIP.address(),
      date: moment().format('DD/MMMM/YYYY HH:mm'),
    };
    const template: string =
      resetPasswordTemplate.passwordResetConfirmationTemplate(templateParams);

    emailQueue.addEmailJob('changePassword', {
      receiverEmail: existingUser.email!,
      subject: 'Password update confirmation',
      template,
    });

    res.status(HTTP_STATUS.OK).json({
      message:
        'Password changed successfully. You will be redirected shortly to the login page.',
    });
  }
}
