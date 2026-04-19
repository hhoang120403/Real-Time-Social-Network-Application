import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { BadRequestError } from '@global/helpers/error-handler';
import { AuthModel } from '@auth/models/auth.schema';

export class VerifyEmail {
  public async update(req: Request, res: Response): Promise<void> {
    const { token } = req.body;

    // Find user with this token
    const user = await AuthModel.findOne({ emailVerificationToken: token });

    if (!user) {
      throw new BadRequestError('Invalid or expired verification token.');
    }

    if (user.emailVerified) {
      res.status(HTTP_STATUS.OK).json({ message: 'Email already verified.' });
      return;
    }

    user.emailVerified = true;
    user.emailVerificationToken = '';
    await user.save();

    res
      .status(HTTP_STATUS.OK)
      .json({ message: 'Email verified successfully. You can now log in.' });
  }
}
