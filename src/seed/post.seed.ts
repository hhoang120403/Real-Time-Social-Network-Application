/* eslint-disable @typescript-eslint/no-explicit-any */
import { PostModel } from '@post/models/post.schema';
import { UserModel } from '@user/models/user.schema';
import { AuthModel } from '@auth/models/auth.schema';
import { CollectionModel } from '@collections/models/collection.schema';
import { ReactionModel } from '@reaction/models/reaction.schema';
import { CommentsModel } from '@comment/models/comment.schema';
import { faker } from '@faker-js/faker';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { PostCache } from '@service/redis/post.cache';
import { ReactionCache } from '@service/redis/reaction.cache';
import { CommentCache } from '@service/redis/comment.cache';
import { IPostDocument } from '@post/interfaces/post.interface';

dotenv.config({});

const MONGO_URI = process.env.MONGO_URI || '';
const postCache: PostCache = new PostCache();
const reactionCache: ReactionCache = new ReactionCache();
const commentCache: CommentCache = new CommentCache();

async function seedPosts(postCount: number) {
  try {
    if (!MONGO_URI) {
      console.error('MONGO_URI is not defined in .env file');
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for Post Seeding...');

    const auths = await AuthModel.find({});
    const users = await UserModel.find({});

    if (auths.length === 0 || users.length === 0) {
      console.error('Incomplete user data. Please seed users first!');
      process.exit(1);
    }

    console.log(
      `Starting to seed ${postCount} posts with REAL interactions simulated...`,
    );

    const createdPostIds: mongoose.Types.ObjectId[] = [];

    for (let i = 0; i < postCount; i++) {
      const randomAuth = auths[Math.floor(Math.random() * auths.length)];
      const currentUser = users.find(
        (u) => u.authId.toString() === randomAuth._id.toString(),
      );
      if (!currentUser) continue;

      const date = faker.date.recent({ days: 60 });
      const hour = date.getHours();
      const profilePicture = `https://robohash.org/${randomAuth.username}?set=set4`;

      let engagementMultiplier = 1;
      if (hour >= 18 && hour <= 22)
        engagementMultiplier = Math.floor(Math.random() * 5) + 3;
      else if (hour >= 0 && hour <= 5) engagementMultiplier = 0.2;

      // Define interaction counts
      const reactionsCount = Math.floor(
        Math.random() * 10 * engagementMultiplier,
      );
      const commentsCount = Math.floor(
        Math.random() * 5 * engagementMultiplier,
      );
      const savesCount = Math.floor(Math.random() * 3 * engagementMultiplier);
      const sharesCount = Math.floor(Math.random() * 2 * engagementMultiplier);

      const postId = new mongoose.Types.ObjectId();
      const reactionsData = {
        like: reactionsCount,
        love: 0,
        happy: 0,
        wow: 0,
        sad: 0,
        angry: 0,
      };

      const createdPost: IPostDocument = {
        _id: postId,
        userId: currentUser._id,
        username: randomAuth.username,
        email: randomAuth.email,
        avatarColor: randomAuth.avatarColor,
        profilePicture: profilePicture,
        post: faker.lorem.sentences(Math.floor(Math.random() * 3) + 1),
        bgColor: '#ffffff',
        commentsCount,
        reactions: reactionsData,
        sharesCount,
        savesCount,
        createdAt: date,
        privacy: 'Public',
      } as any;

      await PostModel.create(createdPost);
      await postCache.savePostToCache({
        key: `${postId}`,
        currentUserId: `${currentUser._id}`,
        uId: randomAuth.uId!,
        createdPost: createdPost,
      });

      await UserModel.updateOne(
        { _id: currentUser._id },
        { $inc: { postsCount: 1 } },
      );
      createdPostIds.push(postId);

      // Seed Reactions
      for (let r = 0; r < reactionsCount; r++) {
        const reactorAuth = auths[Math.floor(Math.random() * auths.length)];
        const reactionData = {
          _id: new mongoose.Types.ObjectId(),
          postId,
          type: 'like',
          username: reactorAuth.username,
          avatarColor: reactorAuth.avatarColor,
          profilePicture: `https://robohash.org/${reactorAuth.username}?set=set4`,
          createdAt: date,
        };
        await ReactionModel.create(reactionData as any);
        await reactionCache.savePostReactionsToCache(
          `${postId}`,
          reactionData as any,
          reactionsData,
          'like',
          '',
        );
      }

      // Seed Comments
      for (let c = 0; c < commentsCount; c++) {
        const commenterAuth = auths[Math.floor(Math.random() * auths.length)];
        const commentData = {
          _id: new mongoose.Types.ObjectId(),
          postId,
          username: commenterAuth.username,
          avatarColor: commenterAuth.avatarColor,
          profilePicture: `https://robohash.org/${commenterAuth.username}?set=set4`,
          comment: faker.lorem.sentence(),
          createdAt: date,
        };
        await CommentsModel.create(commentData as any);
        await commentCache.savePostCommentToCache(
          `${postId}`,
          JSON.stringify(commentData),
        );
      }

      // Seed Saves
      for (let s = 0; s < savesCount; s++) {
        const saver = users[Math.floor(Math.random() * users.length)];
        await CollectionModel.findOneAndUpdate(
          { userId: saver._id, name: 'My Saves' },
          { $addToSet: { posts: postId } },
          { upsert: true },
        );
      }

      // Seed Shares (Simulated by creating NEW posts that reference this one)
      for (let sh = 0; sh < sharesCount; sh++) {
        const sharerAuth = auths[Math.floor(Math.random() * auths.length)];
        const sharerUser = users.find(
          (u) => u.authId.toString() === sharerAuth._id.toString(),
        );
        if (
          !sharerUser ||
          sharerUser._id.toString() === currentUser._id.toString()
        )
          continue;

        const sharedPostId = new mongoose.Types.ObjectId();
        const sharedPost: IPostDocument = {
          _id: sharedPostId,
          userId: sharerUser._id,
          username: sharerAuth.username,
          email: sharerAuth.email,
          avatarColor: sharerAuth.avatarColor,
          profilePicture: `https://robohash.org/${sharerAuth.username}?set=set4`,
          post: `Check this out! ${faker.lorem.sentence()}`,
          bgColor: '#ffffff',
          commentsCount: 0,
          reactions: { like: 0, love: 0, happy: 0, wow: 0, sad: 0, angry: 0 },
          sharesCount: 0,
          savesCount: 0,
          createdAt: faker.date.between({ from: date, to: new Date() }),
          sharedPost: {
            _id: postId,
            userId: currentUser._id as any,
            username: randomAuth.username,
            post: createdPost.post,
            imgId: '',
            imgVersion: '',
            createdAt: date,
          },
        } as any;

        await PostModel.create(sharedPost);
        await postCache.savePostToCache({
          key: `${sharedPostId}`,
          currentUserId: `${sharerUser._id}`,
          uId: sharerAuth.uId!,
          createdPost: sharedPost,
        });
      }

      if (i % 50 === 0)
        console.log(`Progress: ${i}/${postCount} posts seeded...`);
    }

    console.log('--- SEEDING COMPLETED ---');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding posts:', error);
    process.exit(1);
  }
}

seedPosts(200);
