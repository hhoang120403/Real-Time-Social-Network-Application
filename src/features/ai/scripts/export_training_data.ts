import { PostAnalyticsModel } from '@ai/models/post_analytics.schema';
import { PostModel } from '@post/models/post.schema';
import { UserModel } from '@user/models/user.schema';
import { AuthModel } from '@auth/models/auth.schema';
import mongoose from 'mongoose';
import * as fs from 'fs';
import { config } from '@root/config';

async function exportTrainingData() {
  try {
    await mongoose.connect(config.DATABASE_URL!, {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
    });
    console.log('Connected to MongoDB for Corrected Export...');

    console.log('Fetching all analytics records...');
    const analytics = await PostAnalyticsModel.find({}).sort({ createdAt: 1 }).lean();
    
    if (analytics.length === 0) {
      console.log('No analytics records found.');
      process.exit(0);
    }

    const postIds = analytics.map(a => a.postId);
    const userIds = Array.from(new Set(analytics.map(a => a.userId)));

    console.log(`Fetching posts, users, and auth records...`);
    const posts = await PostModel.find({ _id: { $in: postIds } }).lean();
    const users = await UserModel.find({ _id: { $in: userIds } }).lean();
    const auths = await AuthModel.find({ _id: { $in: users.map(u => u.authId) } }).lean();

    const postsMap = new Map(posts.map(p => [p._id.toString(), p]));
    const usersMap = new Map(users.map(u => [u._id.toString(), u]));
    const authsMap = new Map(auths.map(a => [a._id.toString(), a]));

    console.log('Pre-calculating global statistics...');
    const hourStats: Record<number, number[]> = {};
    const dayStats: Record<number, number[]> = {};
    const dayHourStats: Record<string, number[]> = {};

    for (const s of analytics) {
      const post = postsMap.get(s.postId.toString());
      if (!post) continue;
      const d = new Date(post.createdAt!);
      const h = d.getHours();
      const dow = d.getDay();
      
      if (!hourStats[h]) hourStats[h] = [];
      hourStats[h].push(s.engagementScore);
      
      if (!dayStats[dow]) dayStats[dow] = [];
      dayStats[dow].push(s.engagementScore);

      const key = `${dow}_${h}`;
      if (!dayHourStats[key]) dayHourStats[key] = [];
      dayHourStats[key].push(s.engagementScore);
    }

    const getAvg = (arr: number[]) => (arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    const csvHeader = [
      'createdAt', 'dayOfWeek', 'hour', 'isWeekend', 'captionLength', 'captionWordCount',
      'hasCaption', 'mediaType_image', 'mediaType_video', 'followerCountAtPostTime',
      'accountAgeDays', 'userPostCountBefore', 'userAvgEngagementBefore',
      'userAvgEngagementLast7Posts', 'userAvgEngagementLast30Days',
      'userBestHourBefore', 'userBestDayOfWeekBefore',
      'globalAvgEngagementByHour', 'globalAvgEngagementByDayOfWeek', 'globalAvgEngagementByDayHour',
      'engagementScore',
    ].join(',');

    const rows = [csvHeader];

    console.log('Processing records in memory...');
    const userAnalyticsMap: Record<string, typeof analytics> = {};
    for (const a of analytics) {
      const uid = a.userId.toString();
      if (!userAnalyticsMap[uid]) userAnalyticsMap[uid] = [];
      userAnalyticsMap[uid].push(a);
    }

    for (const record of analytics) {
      const post = postsMap.get(record.postId.toString());
      const user = usersMap.get(record.userId.toString());
      if (!post || !user) continue;

      const auth = authsMap.get(user.authId.toString());
      const createdAt = new Date(post.createdAt!);
      const dayOfWeek = createdAt.getDay();
      const hour = createdAt.getHours();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;

      const caption = post.post || '';
      const captionLength = caption.length;
      const captionWordCount = caption.trim().split(/\s+/).filter(Boolean).length;
      const hasCaption = captionLength > 0 ? 1 : 0;

      const mediaType_image = (post.imgId && post.imgId !== 'seed_image_id') || post.imgVersion ? 1 : 0;
      const mediaType_video = (post.videoId && post.videoId !== 'seed_video_id') || post.videoVersion ? 1 : 0;

      // Fix accountAgeDays: Use auth.createdAt as the real account creation date
      const accountCreated = auth?.createdAt ? new Date(auth.createdAt) : new Date(createdAt);
      const accountAgeDays = Math.max(0, Math.floor((createdAt.getTime() - accountCreated.getTime()) / (1000 * 60 * 60 * 24)));

      const userHistory = userAnalyticsMap[user._id.toString()].filter(a => 
        new Date(a.collectedAt!) < new Date(record.collectedAt!)
      );

      const userPostCountBefore = userHistory.length;
      const userAvgEngagementBefore = getAvg(userHistory.map(h => h.engagementScore));
      const last7Posts = userHistory.slice(-7);
      const userAvgEngagementLast7Posts = getAvg(last7Posts.map(h => h.engagementScore));

      const thirtyDaysAgo = new Date(createdAt);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const last30DaysPosts = userHistory.filter(h => new Date(h.collectedAt!) > thirtyDaysAgo);
      const userAvgEngagementLast30Days = getAvg(last30DaysPosts.map(h => h.engagementScore));

      const row = [
        `"${createdAt.toISOString()}"`,
        dayOfWeek,
        hour,
        isWeekend,
        captionLength,
        captionWordCount,
        hasCaption,
        mediaType_image,
        mediaType_video,
        record.followersCountAtPostTime || 0,
        accountAgeDays,
        userPostCountBefore,
        userAvgEngagementBefore,
        userAvgEngagementLast7Posts,
        userAvgEngagementLast30Days,
        18,
        0,
        getAvg(hourStats[hour]),
        getAvg(dayStats[dayOfWeek]),
        getAvg(dayHourStats[`${dayOfWeek}_${hour}`]),
        record.engagementScore,
      ].join(',');

      rows.push(row);
    }

    fs.writeFileSync('training_data.csv', rows.join('\n'));
    console.log('--- EXPORT COMPLETED SUCCESSFULLY: training_data.csv ---');
    process.exit(0);
  } catch (error) {
    console.error('Export Error:', error);
    process.exit(1);
  }
}

exportTrainingData();
