import { Request, Response } from 'express';
import { config } from '@root/config';
import HTTP_STATUS from 'http-status-codes';
import { authService } from '@service/db/auth.service';
import { BadRequestError } from '@global/helpers/error-handler';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { emailSchema, passwordSchema } from '@auth/schemas/password';
import crypto from 'crypto';
import { forgotPasswordTemplate } from '@service/emails/templates/forgot-password/forgot-password-template';
import { emailQueue } from '@service/queues/email.queue';
import moment from 'moment';
import publicIP from 'ip';
import { IResetPasswordParams } from '@user/interfaces/user.interface';
import { resetPasswordTemplate } from '@service/emails/templates/reset-password/reset-password-template';

export class Password {
  @joiValidation(emailSchema)
  public async create(req: Request, res: Response) {
    const { email } = req.body;
    const user = await authService.getAuthUserByEmail(email);
    if (!user) {
      throw new BadRequestError('Invalid credentials');
    }

    const resetToken = await Promise.resolve(
      crypto.randomBytes(20).toString('hex'),
    );
    await authService.updatePasswordToken(
      user._id!.toString(),
      resetToken,
      Date.now() + 3600000,
    );

    const resetPasswordUrl = `${config.CLIENT_URL}/reset-password?token=${resetToken}`;
    const template: string = forgotPasswordTemplate.passwordResetTemplate(
      user.username!,
      resetPasswordUrl,
    );
    emailQueue.addEmailJob('forgotPasswordEmail', {
      receiverEmail: email,
      subject: 'Reset Password',
      template,
    });

    res.status(HTTP_STATUS.OK).json({ message: 'Password reset email sent' });
  }

  @joiValidation(passwordSchema)
  public async update(req: Request, res: Response) {
    const { password, confirmPassword } = req.body;
    const { token } = req.params;

    if (password !== confirmPassword) {
      throw new BadRequestError('Passwords do not match');
    }

    const user = await authService.getAuthUserByPasswordToken(token as string);
    if (!user) {
      throw new BadRequestError('Reset token is invalid or has expired');
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    const templateParams: IResetPasswordParams = {
      username: user.username!,
      email: user.email!,
      ipaddress: publicIP.address(),
      date: moment().format('DD/MMMM/YYYY HH:mm'),
    };
    const template: string =
      resetPasswordTemplate.passwordResetConfirmationTemplate(templateParams);
    emailQueue.addEmailJob('forgotPasswordEmail', {
      receiverEmail: user.email!,
      subject: 'Password Reset Confirmation',
      template,
    });

    res.status(HTTP_STATUS.OK).json({ message: 'Password reset successfully' });
  }
}
