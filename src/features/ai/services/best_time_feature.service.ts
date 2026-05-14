/* eslint-disable @typescript-eslint/no-explicit-any */
import { PostAnalyticsModel } from '@ai/models/post_analytics.schema';
import { IUserDocument } from '@user/interfaces/user.interface';
import { PostModel } from '@post/models/post.schema';
import { AuthModel } from '@auth/models/auth.schema';

export interface IBestTimeCandidate {
  dayOfWeek: number;
  hour: number;
  isWeekend: number;
  captionLength: number;
  captionWordCount: number;
  hasCaption: number;
  mediaType_image: number;
  mediaType_video: number;
  followerCountAtPostTime: number;
  accountAgeDays: number;
  userPostCountBefore: number;
  userAvgEngagementBefore: number;
  userAvgEngagementLast7Posts: number;
  userAvgEngagementLast30Days: number;
  userBestHourBefore: number;
  userBestDayOfWeekBefore: number;
  globalAvgEngagementByHour: number;
  globalAvgEngagementByDayOfWeek: number;
  globalAvgEngagementByDayHour: number;
}

class BestTimeFeatureService {
  /**
   * Creates candidate slots for 24 hours of today
   */
  public createTodayTimeSlots() {
    const slots = [];
    const today = new Date();
    const dayOfWeek = today.getDay();
    for (let hour = 0; hour <= 23; hour++) {
      slots.push({
        dayOfWeek,
        hour,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0,
      });
    }
    return slots;
  }

  public async getUserBestTimeStats(userId: string) {
    const analytics = await PostAnalyticsModel.find({ userId }).sort({ collectedAt: 1 });
    if (analytics.length === 0) return null;

    const totalEngagement = analytics.reduce((acc, curr) => acc + curr.engagementScore, 0);
    const avgEngagement = totalEngagement / analytics.length;

    const last7 = analytics.slice(-7);
    const avgLast7 = last7.reduce((acc, curr) => acc + curr.engagementScore, 0) / last7.length;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const last30DaysPosts = analytics.filter(h => new Date(h.collectedAt!) > thirtyDaysAgo);
    const avgLast30 = last30DaysPosts.length 
      ? last30DaysPosts.reduce((acc, curr) => acc + curr.engagementScore, 0) / last30DaysPosts.length
      : avgEngagement;

    // Find best historical hour
    const bestPost = [...analytics].sort((a, b) => b.engagementScore - a.engagementScore)[0];
    const post = await PostModel.findById(bestPost.postId);

    return {
      avgEngagement,
      avgEngagementLast7Posts: avgLast7,
      avgEngagementLast30Days: avgLast30,
      bestHour: post ? new Date(post.createdAt!).getHours() : 18,
      bestDayOfWeek: post ? new Date(post.createdAt!).getDay() : 5,
    };
  }

  /**
   * Calculates Global Averages directly from PostAnalyticsModel
   */
  public async getRealGlobalStats() {
    // In a real high-traffic app, this should be cached in Redis or a GlobalStats collection
    // For now, we calculate it to ensure accuracy
    const allAnalytics = await PostAnalyticsModel.find({}).lean();
    
    const hourStats: Record<number, number[]> = {};
    const dayStats: Record<number, number[]> = {};
    const dayHourStats: Record<string, number[]> = {};
    let totalScore = 0;

    for (const s of allAnalytics) {
      totalScore += s.engagementScore;
      // Note: We'd need to link with PostModel to get hour/day if not stored in Analytics
      // But let's assume we can approximate from collectedAt - 24h
      const d = new Date(s.collectedAt!);
      d.setHours(d.getHours() - 24); 
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
    const globalAvg = allAnalytics.length ? totalScore / allAnalytics.length : 0.05;

    return {
      globalAvg,
      hourStats,
      dayStats,
      dayHourStats,
      getAvg
    };
  }

  public async buildCandidates(
    user: IUserDocument,
    mediaType: 'image' | 'video',
  ): Promise<IBestTimeCandidate[]> {
    const slots = this.createTodayTimeSlots();
    const personalStats = await this.getUserBestTimeStats(`${user._id}`);
    const global = await this.getRealGlobalStats();

    // Fetch Auth to get createdAt
    const auth = await AuthModel.findById(user.authId).lean();
    const accountCreated = auth?.createdAt ? new Date(auth.createdAt) : new Date();
    const accountAgeDays = Math.floor((Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24));

    return slots.map((slot) => {
      return {
        dayOfWeek: slot.dayOfWeek,
        hour: slot.hour,
        isWeekend: slot.isWeekend,
        captionLength: 0, // Placeholder as we don't know the future caption yet
        captionWordCount: 0,
        hasCaption: 1,
        mediaType_image: mediaType === 'image' ? 1 : 0,
        mediaType_video: mediaType === 'video' ? 1 : 0,
        followerCountAtPostTime: user.followersCount,
        accountAgeDays: Math.max(0, accountAgeDays),
        userPostCountBefore: user.postsCount,
        userAvgEngagementBefore: personalStats?.avgEngagement ?? global.globalAvg,
        userAvgEngagementLast7Posts: personalStats?.avgEngagementLast7Posts ?? global.globalAvg,
        userAvgEngagementLast30Days: personalStats?.avgEngagementLast30Days ?? global.globalAvg,
        userBestHourBefore: personalStats?.bestHour ?? 18,
        userBestDayOfWeekBefore: personalStats?.bestDayOfWeek ?? 5,
        globalAvgEngagementByHour: global.getAvg(global.hourStats[slot.hour]) || global.globalAvg,
        globalAvgEngagementByDayOfWeek: global.getAvg(global.dayStats[slot.dayOfWeek]) || global.globalAvg,
        globalAvgEngagementByDayHour: global.getAvg(global.dayHourStats[`${slot.dayOfWeek}_${slot.hour}`]) || global.globalAvg,
      };
    });
  }
}

export const bestTimeFeatureService: BestTimeFeatureService = new BestTimeFeatureService();
