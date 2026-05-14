/* eslint-disable @typescript-eslint/no-explicit-any */
import { PostModel } from '@post/models/post.schema';
import { CollectionModel } from '@collections/models/collection.schema';
import { ReactionModel } from '@reaction/models/reaction.schema';
import { CommentsModel } from '@comment/models/comment.schema';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({});

const MONGO_URI = process.env.MONGO_URI || '';

async function exportData() {
  try {
    if (!MONGO_URI) {
      console.error('MONGO_URI is not defined in .env file');
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for REAL Data Export...');

    // 1. Fetch all posts
    const allPosts = await PostModel.find({}).lean();
    console.log(`Processing ${allPosts.length} posts...`);

    // 2. Pre-fetch counts from other collections for performance
    // Calculating REAL counts from the collections instead of relying on post fields
    const reactions = await ReactionModel.find({}).lean();
    const comments = await CommentsModel.find({}).lean();
    const collections = await CollectionModel.find({}).lean();

    const postReactionsMap: Record<string, number> = {};
    const postCommentsMap: Record<string, number> = {};
    const postSavesMap: Record<string, number> = {};
    const postSharesMap: Record<string, number> = {};

    reactions.forEach((r) => {
      const id = r.postId.toString();
      postReactionsMap[id] = (postReactionsMap[id] || 0) + 1;
    });

    comments.forEach((c) => {
      const id = c.postId.toString();
      postCommentsMap[id] = (postCommentsMap[id] || 0) + 1;
    });

    collections.forEach((col) => {
      col.posts.forEach((postId: any) => {
        const id = postId.toString();
        postSavesMap[id] = (postSavesMap[id] || 0) + 1;
      });
    });

    // Count shares by checking how many posts point to a sharedPost._id
    allPosts.forEach((p) => {
      if (p.sharedPost && p.sharedPost._id) {
        const originalId = p.sharedPost._id.toString();
        postSharesMap[originalId] = (postSharesMap[originalId] || 0) + 1;
      }
    });

    // 3. Prepare CSV Header
    const headers = [
      'post_id',
      'day_of_week',
      'hour_of_day',
      'is_weekend',
      'content_length',
      'has_image',
      'has_video',
      'reactions_count',
      'comments_count',
      'saves_count',
      'shares_count',
      'engagement_score',
    ];

    let csvContent = headers.join(',') + '\n';

    // 4. Process each post (Only original posts or posts with content)
    for (const post of allPosts) {
      const createdAt = new Date(post.createdAt!);
      const dayOfWeek = createdAt.getDay();
      const hourOfDay = createdAt.getHours();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;

      const contentLength = post.post ? post.post.length : 0;
      const hasImage = post.imgId || post.gifUrl ? 1 : 0;
      const hasVideo = post.videoId ? 1 : 0;

      // GET REAL COUNTS
      const reactionsCount = postReactionsMap[post._id.toString()] || 0;
      const commentsCount = postCommentsMap[post._id.toString()] || 0;
      const savesCount = postSavesMap[post._id.toString()] || 0;
      const sharesCount = postSharesMap[post._id.toString()] || 0;

      // ENGAGEMENT SCORE FORMULA (Weighted for REAL impact)
      // Shares are the most valuable interaction (weight: 5)
      // Saves indicate high interest (weight: 4)
      // Comments indicate deep engagement (weight: 2)
      // Reactions indicate general interest (weight: 1)
      const engagementScore =
        reactionsCount * 1 + 
        commentsCount * 2 + 
        savesCount * 4 + 
        sharesCount * 5;

      const row = [
        post._id,
        dayOfWeek,
        hourOfDay,
        isWeekend,
        contentLength,
        hasImage,
        hasVideo,
        reactionsCount,
        commentsCount,
        savesCount,
        sharesCount,
        engagementScore,
      ];

      csvContent += row.join(',') + '\n';
    }

    const outputPath = path.join(process.cwd(), 'training_data.csv');
    fs.writeFileSync(outputPath, csvContent);

    console.log(`--- EXPORT COMPLETED ---`);
    console.log(`Total records processed: ${allPosts.length}`);
    console.log(`File: ${outputPath}`);

    process.exit(0);
  } catch (error) {
    console.error('Error exporting data:', error);
    process.exit(1);
  }
}

exportData();
