import { Request, Response } from 'express';
import { config } from '@root/config';
import JWT from 'jsonwebtoken';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import HTTP_STATUS from 'http-status-codes';
import { authService } from '@service/db/auth.service';
import { BadRequestError } from '@global/helpers/error-handler';
import { loginSchema } from '@auth/schemas/signin';
import {
  IResetPasswordParams,
  IUserDocument,
} from '@user/interfaces/user.interface';
import { userService } from '@service/db/user.service';
import { emailQueue } from '@service/queues/email.queue';
import publicIP from 'ip';
import moment from 'moment';
import { resetPasswordTemplate } from '@service/emails/templates/reset-password/reset-password-template';

export class SignIn {
  @joiValidation(loginSchema)
  public async read(req: Request, res: Response): Promise<void> {
    const { username, password } = req.body;

    const checkIfUserExists = await authService.getAuthUserByUsername(username);
    if (!checkIfUserExists) {
      throw new BadRequestError('Invalid credentials');
    }

    if (!checkIfUserExists.emailVerified) {
      throw new BadRequestError('Please verify your email to log in.');
    }

    const passwordsMatch = await checkIfUserExists.comparePassword(password);
    if (!passwordsMatch) {
      throw new BadRequestError('Invalid credentials');
    }

    const user: IUserDocument = await userService.getUserByAuthId(
      checkIfUserExists._id.toString(),
    );

    const userJwt: string = JWT.sign(
      {
        userId: user._id,
        uId: checkIfUserExists.uId,
        email: checkIfUserExists.email,
        username: checkIfUserExists.username,
        avatarColor: checkIfUserExists.avatarColor,
      },
      config.JWT_TOKEN!,
    );

    const templateParams: IResetPasswordParams = {
      username: user.username!,
      email: user.email!,
      ipaddress: publicIP.address(),
      date: moment().format('DD-MMM-YYYY HH:mm'),
    };
    const template: string =
      resetPasswordTemplate.passwordResetConfirmationTemplate(templateParams);
    emailQueue.addEmailJob('forgotPasswordEmail', {
      receiverEmail: 'leatha.gottlieb28@ethereal.email',
      subject: 'Password reset confirmation',
      template,
    });

    req.session = { jwt: userJwt };

    const userDocument: IUserDocument = {
      ...user,
      authId: checkIfUserExists._id,
      username: checkIfUserExists.username,
      email: checkIfUserExists.email,
      avatarColor: checkIfUserExists.avatarColor,
      uId: checkIfUserExists.uId,
      createdAt: checkIfUserExists.createdAt,
    } as IUserDocument;

    res.status(HTTP_STATUS.OK).json({
      message: 'User signed in successfully',
      user: userDocument,
      token: userJwt,
    });
  }
}
