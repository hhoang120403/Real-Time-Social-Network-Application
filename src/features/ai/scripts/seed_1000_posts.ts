/* eslint-disable @typescript-eslint/no-explicit-any */
import { PostModel } from '@post/models/post.schema';
import { UserModel } from '@user/models/user.schema';
import { AuthModel } from '@auth/models/auth.schema';
import { CollectionModel } from '@collections/models/collection.schema';
import { PostAnalyticsModel } from '@ai/models/post_analytics.schema';
import { ReactionModel } from '@reaction/models/reaction.schema';
import { CommentsModel } from '@comment/models/comment.schema';
import { PostCache } from '@service/redis/post.cache';
import { ReactionCache } from '@service/redis/reaction.cache';
import { CommentCache } from '@service/redis/comment.cache';
import { IPostDocument } from '@post/interfaces/post.interface';
import { IReactionDocument } from '@reaction/interfaces/reaction.interface';
import { ICommentDocument } from '@comment/interfaces/comment.interface';
import { faker } from '@faker-js/faker';
import mongoose from 'mongoose';
import { config } from '@root/config';

const postCache: PostCache = new PostCache();
const reactionCache: ReactionCache = new ReactionCache();
const commentCache: CommentCache = new CommentCache();

async function seed1000Posts() {
  try {
    await mongoose.connect(config.DATABASE_URL!);
    console.log(
      'Connected to MongoDB for Full-Seeding (Post + Reaction + Comment)...',
    );

    // Ensure Redis clients are connected
    if (!reactionCache.client.isOpen) await reactionCache.client.connect();
    if (!commentCache.client.isOpen) await commentCache.client.connect();

    const auths = await AuthModel.find({});
    const users = await UserModel.find({});

    if (auths.length === 0 || users.length === 0) {
      console.error('No users found. Please seed users first!');
      process.exit(1);
    }

    console.log(
      'Starting to seed 1000 text posts with real reactions and comments...',
    );

    for (let i = 0; i < 1000; i++) {
      const randomAuth = auths[Math.floor(Math.random() * auths.length)];
      const currentUser = users.find(
        (u) => u.authId.toString() === randomAuth._id.toString(),
      );
      if (!currentUser) continue;

      const date = faker.date.recent({ days: 90 });
      const hour = date.getHours();

      // Simulation of Golden Hour: higher engagement between 18:00 and 22:00
      let baseEngagement = faker.number.int({ min: 1, max: 20 });
      if (hour >= 18 && hour <= 22) {
        baseEngagement *= faker.number.int({ min: 3, max: 8 });
      } else if (hour >= 1 && hour <= 6) {
        baseEngagement = Math.floor(baseEngagement * 0.2);
      }

      const likesCount = Math.floor(baseEngagement * 1.5);
      const commentsCount = Math.floor(baseEngagement * 0.5);
      const savesCount = Math.floor(baseEngagement * 0.2);
      const sharesCount = Math.floor(baseEngagement * 0.1);

      const postId = new mongoose.Types.ObjectId();
      const followers = currentUser.followersCount || 0;

      const createdPost: IPostDocument = {
        _id: postId,
        userId: currentUser._id,
        username: randomAuth.username,
        email: randomAuth.email,
        avatarColor: randomAuth.avatarColor,
        profilePicture: `https://robohash.org/${randomAuth.username}?set=set4`,
        post: faker.lorem.sentences(Math.floor(Math.random() * 3) + 1),
        bgColor: '#ffffff',
        feelings: faker.helpers.arrayElement([
          '',
          'happy',
          'excited',
          'blessed',
          'loved',
        ]),
        privacy: 'Public',
        gifUrl: '',
        commentsCount: commentsCount,
        sharesCount: sharesCount,
        savesCount: savesCount,
        reactions: {
          like: likesCount,
          love: 0,
          happy: 0,
          wow: 0,
          sad: 0,
          angry: 0,
        },
        imgVersion: '',
        imgId: '',
        videoVersion: '',
        videoId: '',
        followerCountAtPostTime: followers,
        createdAt: date,
      } as unknown as IPostDocument;

      // 1. Save Post to Redis & MongoDB
      await postCache.savePostToCache({
        key: postId.toString(),
        currentUserId: currentUser._id.toString(),
        uId: randomAuth.uId!,
        createdPost,
      });
      await PostModel.create(createdPost);

      // 2. Create REAL Reactions
      if (likesCount > 0) {
        const shuffledUsers = [...users].sort(() => 0.5 - Math.random());
        const reactors = shuffledUsers.slice(
          0,
          Math.min(likesCount, users.length),
        );
        for (const reactor of reactors) {
          const reactionData: IReactionDocument = {
            postId: postId as any,
            type: 'like',
            username: reactor.username,
            avatarColor: reactor.avatarColor,
            profilePicture: reactor.profilePicture,
            createdAt: date,
          } as IReactionDocument;
          await ReactionModel.create(reactionData);
          await (reactionCache as any).client.LPUSH(
            `reactions:${postId}`,
            JSON.stringify(reactionData),
          );
        }
      }

      // 3. Create REAL Comments
      if (commentsCount > 0) {
        const shuffledCommenters = [...users].sort(() => 0.5 - Math.random());
        const commenters = shuffledCommenters.slice(
          0,
          Math.min(commentsCount, users.length),
        );
        for (const commenter of commenters) {
          const commentData: ICommentDocument = {
            _id: new mongoose.Types.ObjectId(),
            postId: postId as any,
            comment: faker.lorem.sentence(),
            username: commenter.username,
            avatarColor: commenter.avatarColor,
            profilePicture: commenter.profilePicture,
            userTo: currentUser._id,
            userFrom: commenter._id,
            createdAt: date,
          } as unknown as ICommentDocument;
          await CommentsModel.create(commentData);
          await (commentCache as any).client.LPUSH(
            `comments:${postId}`,
            JSON.stringify(commentData),
          );
        }
      }

      // 4. Update User Post Count
      await UserModel.updateOne(
        { _id: currentUser._id },
        { $inc: { postsCount: 1 } },
      );

      // 5. Seed Saves
      if (savesCount > 0) {
        const shuffledSavers = [...users].sort(() => 0.5 - Math.random());
        const savers = shuffledSavers.slice(
          0,
          Math.min(savesCount, users.length),
        );
        for (const saver of savers) {
          await CollectionModel.findOneAndUpdate(
            { userId: saver._id.toString(), name: 'My Saves' },
            { $addToSet: { posts: postId } },
            { upsert: true },
          );
        }
      }

      // 6. Seed Shares
      if (sharesCount > 0) {
        const shuffledSharers = [...users].sort(() => 0.5 - Math.random());
        const sharers = shuffledSharers.slice(
          0,
          Math.min(sharesCount, users.length),
        );
        for (const sharer of sharers) {
          const sharePostId = new mongoose.Types.ObjectId();
          const sharerAuth = auths.find((a) => a._id.toString() === sharer.authId.toString());
          if (!sharerAuth) continue;

          const sharedPostData = {
            _id: sharePostId,
            userId: sharer._id,
            username: sharerAuth.username,
            email: sharerAuth.email,
            avatarColor: sharerAuth.avatarColor,
            profilePicture: `https://robohash.org/${sharerAuth.username}?set=set4`,
            post: faker.lorem.sentence(),
            bgColor: '#ffffff',
            feelings: '',
            privacy: 'Public',
            gifUrl: '',
            commentsCount: 0,
            sharesCount: 0,
            savesCount: 0,
            reactions: { like: 0, love: 0, happy: 0, wow: 0, sad: 0, angry: 0 },
            imgVersion: '',
            imgId: '',
            videoVersion: '',
            videoId: '',
            followerCountAtPostTime: sharer.followersCount || 0,
            createdAt: date,
            sharedPost: {
              _id: createdPost._id,
              userId: createdPost.userId,
              username: createdPost.username,
              email: createdPost.email,
              avatarColor: createdPost.avatarColor,
              profilePicture: createdPost.profilePicture,
              post: createdPost.post,
              bgColor: createdPost.bgColor,
              imgVersion: createdPost.imgVersion,
              imgId: createdPost.imgId,
              videoVersion: createdPost.videoVersion,
              videoId: createdPost.videoId,
              gifUrl: createdPost.gifUrl,
              privacy: createdPost.privacy,
              createdAt: createdPost.createdAt,
            }
          } as unknown as IPostDocument;

          await postCache.savePostToCache({
            key: sharePostId.toString(),
            currentUserId: sharer._id.toString(),
            uId: sharerAuth.uId!,
            createdPost: sharedPostData,
          });
          await PostModel.create(sharedPostData);

          await UserModel.updateOne(
            { _id: sharer._id },
            { $inc: { postsCount: 1 } },
          );
        }
      }

      // 7. Create Analytics entry
      const engagementScore =
        (likesCount * 1 + commentsCount * 3 + savesCount * 4 + sharesCount * 5) /
        Math.max(followers, 1);
      await PostAnalyticsModel.create({
        postId: postId,
        userId: currentUser._id,
        likes: likesCount,
        comments: commentsCount,
        saves: savesCount,
        followersCountAtPostTime: followers,
        engagementScore,
        collectedAfterHours: 24,
        collectedAt: new Date(),
      } as any);

      if (i % 100 === 0)
        console.log(
          `Seeded ${i}/1000 posts with real reactions and comments...`,
        );
    }

    console.log('--- FULL SEEDING COMPLETED SUCCESSFULLY ---');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding 1000 posts:', error);
    process.exit(1);
  }
}

seed1000Posts();
