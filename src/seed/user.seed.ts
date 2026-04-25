import { AuthModel } from '@auth/models/auth.schema';
import { UserModel } from '@user/models/user.schema';
import { faker } from '@faker-js/faker';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { hash } from 'bcryptjs';
import { UserCache } from '@service/redis/user.cache';
import { ObjectId } from 'mongodb';
import { Helpers } from '@global/helpers/helpers';
import { IUserDocument } from '@user/interfaces/user.interface';
import { IAuthDocument } from '@auth/interfaces/auth.interface';

dotenv.config({});

const MONGO_URI = process.env.MONGO_URI || '';
const userCache: UserCache = new UserCache();

async function seedUsers(count: number) {
  try {
    if (!MONGO_URI) {
      console.error('MONGO_URI is not defined in .env file');
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    for (let i = 0; i < count; i++) {
      const username =
        faker.internet
          .username()
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 10)
          .toLowerCase() + Math.floor(Math.random() * 100);
      const email = faker.internet.email().toLowerCase();
      const uId = `${Helpers.generateRandomIntegers(12)}`;
      const avatarColor = '#f44336';
      const authObjectId = new ObjectId();
      const userObjectId = new ObjectId();

      const authData: IAuthDocument = {
        _id: authObjectId,
        uId,
        username: Helpers.firstLetterUppercase(username),
        email,
        password: '123456', // Pass plain text, Mongoose pre-save hook will hash it ONCE.
        avatarColor,
        emailVerified: true,
        createdAt: new Date(),
      } as IAuthDocument;

      const userData: IUserDocument = {
        _id: userObjectId,
        authId: authObjectId,
        uId,
        username: Helpers.firstLetterUppercase(username),
        email,
        password: '123456',
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

      // 1. Save to MongoDB
      await AuthModel.create(authData);
      await UserModel.create(userData);

      // 2. Save to Redis Cache (Mirroring real signup)
      await userCache.saveUserToCache(`${userObjectId}`, uId, userData);

      console.log(`User ${i + 1}/${count} synced to DB & Redis: ${authData.username} (${email})`);
    }

    console.log('--- SEEDING & CACHE SYNC COMPLETED SUCCESSFULLY! ---');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seedUsers(20);
