/* eslint-disable @typescript-eslint/no-explicit-any */
import { PostModel } from '@post/models/post.schema';
import { CollectionModel } from '@collections/models/collection.schema';
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
    console.log('Connected to MongoDB for Data Export...');

    // 1. Fetch all posts
    const posts = await PostModel.find({});
    console.log(`Found ${posts.length} posts. Processing...`);

    // 2. Fetch all collections to count saves for each post
    const collections = await CollectionModel.find({});
    const postSavesMap: Record<string, number> = {};

    collections.forEach((col) => {
      col.posts.forEach((postId: any) => {
        const idStr = postId.toString();
        postSavesMap[idStr] = (postSavesMap[idStr] || 0) + 1;
      });
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
      'engagement_score', // The Target Variable
    ];

    let csvContent = headers.join(',') + '\n';

    // 4. Process each post into a row
    for (const post of posts) {
      const createdAt = new Date(post.createdAt!);
      const dayOfWeek = createdAt.getDay();
      const hourOfDay = createdAt.getHours();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;

      const contentLength = post.post ? post.post.length : 0;
      const hasImage = post.imgId || post.gifUrl ? 1 : 0;
      const hasVideo = post.videoId ? 1 : 0;

      const reactionsCount = post.reactions
        ? post.reactions.like +
          post.reactions.love +
          post.reactions.happy +
          post.reactions.wow +
          post.reactions.sad +
          post.reactions.angry
        : 0;
      const commentsCount = post.commentsCount || 0;
      const savesCount = postSavesMap[post._id.toString()] || 0;

      // ENGAGEMENT SCORE FORMULA:
      // We weight different interactions based on their value
      const engagementScore =
        reactionsCount * 1 + commentsCount * 2 + savesCount * 4;

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
        engagementScore,
      ];

      csvContent += row.join(',') + '\n';
    }

    // 5. Write to File
    const outputPath = path.join(process.cwd(), 'training_data.csv');
    fs.writeFileSync(outputPath, csvContent);

    console.log(`--- EXPORT COMPLETED ---`);
    console.log(`File saved at: ${outputPath}`);
    console.log(`Total records: ${posts.length}`);

    process.exit(0);
  } catch (error) {
    console.error('Error exporting data:', error);
    process.exit(1);
  }
}

exportData();
