import { AuthModel } from '@auth/models/auth.schema';
import { UserModel } from '@user/models/user.schema';
import { FollowerModel } from '@follower/models/follower.schema';
import { faker } from '@faker-js/faker';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { UserCache } from '@service/redis/user.cache';
import { FollowerCache } from '@service/redis/follower.cache';
import { ObjectId } from 'mongodb';
import { Helpers } from '@global/helpers/helpers';
import { IUserDocument } from '@user/interfaces/user.interface';
import { IAuthDocument } from '@auth/interfaces/auth.interface';

dotenv.config({});

const MONGO_URI = process.env.MONGO_URI || '';
const userCache: UserCache = new UserCache();
const followerCache: FollowerCache = new FollowerCache();

async function seedUsers(count: number) {
  try {
    if (!MONGO_URI) {
      console.error('MONGO_URI is not defined in .env file');
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for REAL seeding...');

    // 1. CLEAR existing data if you want a fresh start (Optional)
    // await AuthModel.deleteMany({});
    // await UserModel.deleteMany({});
    // await FollowerModel.deleteMany({});

    const seededUserIds: string[] = [];

    console.log(`Step 1: Creating ${count} users...`);
    for (let i = 0; i < count; i++) {
      const username =
        faker.internet
          .username()
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 10)
          .toLowerCase() + Math.floor(Math.random() * 100);
      const email = faker.internet.email().toLowerCase();
      const uId = `${Helpers.generateRandomIntegers(12)}`;
      const avatarColor = faker.color.rgb();
      const authObjectId = new ObjectId();
      const userObjectId = new ObjectId();

      const authData: IAuthDocument = {
        _id: authObjectId,
        uId,
        username: Helpers.firstLetterUppercase(username),
        email,
        password: '123456',
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
        profilePicture: `https://robohash.org/${username}?set=set4`,
        blocked: [],
        blockedBy: [],
        work: faker.person.jobTitle(),
        location: faker.location.city(),
        school: faker.company.name(),
        quote: faker.lorem.sentence(),
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

      await AuthModel.create(authData);
      await UserModel.create(userData);
      await userCache.saveUserToCache(`${userObjectId}`, uId, userData);

      seededUserIds.push(userObjectId.toString());
      if (i % 10 === 0) console.log(`Created ${i}/${count} users...`);
    }

    console.log('Step 2: Creating REAL follow relationships...');
    if (!followerCache.client.isOpen) await followerCache.client.connect();

    for (const userId of seededUserIds) {
      // Pick 5-20 random users to follow this user
      const otherUserIds = seededUserIds.filter((id) => id !== userId);
      const shuffled = otherUserIds.sort(() => 0.5 - Math.random());
      const followersToCreate = shuffled.slice(
        0,
        faker.number.int({ min: 5, max: 25 }),
      );

      for (const followerId of followersToCreate) {
        // 1. MongoDB
        await FollowerModel.create({
          followerId: new mongoose.Types.ObjectId(followerId),
          followeeId: new mongoose.Types.ObjectId(userId),
          createdAt: new Date(),
        });

        // 2. Redis
        await followerCache.saveFollowerToCache(
          `followers:${userId}`,
          followerId,
        );
        await followerCache.saveFollowerToCache(
          `following:${followerId}`,
          userId,
        );
        await followerCache.updateFollowersCountInCache(
          userId,
          'followersCount',
          1,
        );
        await followerCache.updateFollowersCountInCache(
          followerId,
          'followingCount',
          1,
        );

        // 3. Update MongoDB User counts
        await UserModel.updateOne(
          { _id: userId },
          { $inc: { followersCount: 1 } },
        );
        await UserModel.updateOne(
          { _id: followerId },
          { $inc: { followingCount: 1 } },
        );
      }
      console.log(`Processed followers for user ${userId.substring(0, 5)}...`);
    }

    console.log('--- REAL SEEDING & FOLLOW SYNC COMPLETED SUCCESSFULLY! ---');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seedUsers(80);
