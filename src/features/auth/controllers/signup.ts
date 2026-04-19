import { IAuthDocument, ISignUpData } from '@auth/interfaces/auth.interface';
import { signupSchema } from '@auth/schemas/signup';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { uploads } from '@global/helpers/cloudinary-upload';
import { BadRequestError } from '@global/helpers/error-handler';
import { Helpers } from '@global/helpers/helpers';
import { authService } from '@service/db/auth.service';
import { UploadApiResponse } from 'cloudinary';
import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import HTTP_STATUS from 'http-status-codes';
import { IUserDocument } from '@user/interfaces/user.interface';
import { UserCache } from '@service/redis/user.cache';
import { config } from '@root/config';
// import { omit } from 'lodash';
import { authQueue } from '@service/queues/auth.queue';
import { userQueue } from '@service/queues/user.queue';
import { emailQueue } from '@service/queues/email.queue';
import { emailVerificationTemplate } from '@service/emails/templates/notifications/email-verification-template';
import JWT from 'jsonwebtoken';
import crypto from 'crypto';

const userCache: UserCache = new UserCache();

export class SignUp {
  @joiValidation(signupSchema)
  public async create(req: Request, res: Response): Promise<void> {
    const { username, email, password, avatarColor, avatarImage } = req.body;

    // Check if user exists
    const checkIfUserExists = await authService.getUserByUsernameOrEmail(
      username,
      email,
    );

    if (checkIfUserExists) {
      throw new BadRequestError('Invalid credentials');
    }

    const authObjectId = new ObjectId();
    const userObjectId = new ObjectId();
    const uId = `${Helpers.generateRandomIntegers(12)}`;
    const authData: IAuthDocument = SignUp.prototype.signupData({
      _id: authObjectId,
      uId,
      username: Helpers.firstLetterUppercase(username),
      email,
      password,
      avatarColor,
    });

    // Upload avatar image to cloudinary
    const result: UploadApiResponse = (await uploads(
      avatarImage,
      `${userObjectId}`,
      true,
      true,
    )) as UploadApiResponse;

    if (!result?.public_id) {
      throw new BadRequestError('Failed to upload avatar image');
    }

    // Add to redis cache
    const userDataForCache: IUserDocument = SignUp.prototype.userData(
      authData,
      userObjectId,
    );
    userDataForCache.profilePicture = `https://res.cloudinary.com/${config.CLOUD_NAME}/image/upload/v${result.version}/${userObjectId}`;
    await userCache.saveUserToCache(`${userObjectId}`, uId, userDataForCache);

    // Add to database
    // omit(userDataForCache, [
    //   '_uId',
    //   'username',
    //   'email',
    //   'avatarColor',
    //   'password',
    // ]);
    authQueue.addAuthUserJob('addAuthUserToDB', { value: authData });
    userQueue.addUserJob('addUserToDB', { value: userDataForCache });

    // Send verification email
    const verificationLink = `${config.CLIENT_URL}/verify-email?token=${authData.emailVerificationToken}`;
    const template: string = emailVerificationTemplate.emailVerificationTemplate(
      authData.username,
      verificationLink,
    );
    emailQueue.addEmailJob('emailVerification', {
      receiverEmail: authData.email,
      subject: 'Please verify your email',
      template,
    });

    res.status(HTTP_STATUS.CREATED).json({
      message: 'Registration successful! Please check your email to verify your account before logging in.',
      user: userDataForCache
    });
  }

  // Generate JWT token
  private signupToken(data: IAuthDocument, userObjectId: ObjectId): string {
    return JWT.sign(
      {
        userId: userObjectId,
        uId: data.uId,
        email: data.email,
        username: data.username,
        avatarColor: data.avatarColor,
      },
      config.JWT_TOKEN!,
    );
  }

  private signupData(data: ISignUpData): IAuthDocument {
    const { _id, username, email, password, avatarColor, uId } = data;
    return {
      _id,
      uId,
      username,
      email,
      password,
      avatarColor,
      createdAt: new Date(),
      emailVerificationToken: crypto.randomBytes(20).toString('hex'),
      emailVerified: false,
    } as IAuthDocument;
  }

  private userData(data: IAuthDocument, userObjectId: ObjectId): IUserDocument {
    const { _id, uId, username, email, password, avatarColor } = data;
    return {
      _id: userObjectId,
      authId: _id,
      uId,
      username: Helpers.firstLetterUppercase(username),
      email,
      password,
      avatarColor,
      profilePicture: '',
      blocked: [],
      blockedBy: [],
      work: '',
      location: '',
      school: '',
      quote: '',
      bgImageVersion: '',
      bgImageId: '',
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      notifications: {
        messages: true,
        reactions: true,
        comments: true,
        follows: true,
      },
      social: {
        facebook: '',
        twitter: '',
        instagram: '',
        youtube: '',
      },
    } as unknown as IUserDocument;
  }
}
