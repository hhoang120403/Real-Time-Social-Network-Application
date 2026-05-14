import { PostAnalyticsModel } from '@ai/models/post_analytics.schema';
import { CollectionModel } from '@collections/models/collection.schema';
import { PostModel } from '@post/models/post.schema';
import { IPostDocument } from '@post/interfaces/post.interface';

class AnalyticsService {
  public async collectPostAnalytics(hours: number = 24): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    const posts: IPostDocument[] = await PostModel.find({
      createdAt: { $lte: cutoffDate },
    });

    for (const post of posts) {
      await this.analyzeSinglePost(post._id.toString(), hours);
    }
  }

  public async analyzeSinglePost(postId: string, hours: number = 24): Promise<void> {
    const post: IPostDocument | null = await PostModel.findById(postId);
    if (!post) return;

    const alreadyAnalyzed = await PostAnalyticsModel.findOne({
      postId: post._id,
      collectedAfterHours: hours,
    });
    if (alreadyAnalyzed) return;

    const likes = post.reactions?.like || 0;
    const comments = post.commentsCount || 0;
    const saves = await CollectionModel.countDocuments({ posts: post._id });
    const followers = post.followerCountAtPostTime || 1;

    const engagementScore =
      (likes * 1 + comments * 3 + saves * 4) / Math.max(followers, 1);

    await PostAnalyticsModel.create({
      postId: post._id,
      userId: post.userId,
      likes,
      comments,
      saves,
      followersCountAtPostTime: followers,
      engagementScore,
      collectedAfterHours: hours,
      collectedAt: new Date(),
    });
  }

  public async calculateGlobalStats(): Promise<void> {
    // Aggregate data from PostAnalytics
    const stats = await PostAnalyticsModel.aggregate([
      {
        $lookup: {
          from: 'Post',
          localField: 'postId',
          foreignField: '_id',
          as: 'post',
        },
      },
      { $unwind: '$post' },
      {
        $group: {
          _id: {
            dayOfWeek: { $dayOfWeek: '$post.createdAt' },
            hour: { $hour: '$post.createdAt' },
          },
          avgEngagementScore: { $avg: '$engagementScore' },
          postCount: { $sum: 1 },
        },
      },
    ]);

    const GlobalStatsModel = (await import('@ai/models/global_stats.schema'))
      .GlobalStatsModel;

    for (const stat of stats) {
      // Map MongoDB dayOfWeek (1-7, Sun=1) to JS/Standard (0-6, Sun=0)
      const dayOfWeek = stat._id.dayOfWeek - 1;
      const hour = stat._id.hour;

      await GlobalStatsModel.findOneAndUpdate(
        { type: 'day_hour', dayOfWeek, hour },
        {
          avgEngagementScore: stat.avgEngagementScore,
          postCount: stat.postCount,
          updatedAt: new Date(),
        },
        { upsert: true },
      );
    }

    // Also calculate global average
    const globalAvg = await PostAnalyticsModel.aggregate([
      {
        $group: {
          _id: null,
          avgEngagementScore: { $avg: '$engagementScore' },
          postCount: { $sum: 1 },
        },
      },
    ]);

    if (globalAvg.length > 0) {
      await GlobalStatsModel.findOneAndUpdate(
        { type: 'global' },
        {
          avgEngagementScore: globalAvg[0].avgEngagementScore,
          postCount: globalAvg[0].postCount,
          updatedAt: new Date(),
        },
        { upsert: true },
      );
    }
  }
}

export const analyticsService: AnalyticsService = new AnalyticsService();
