import { Job, DoneCallback } from 'bull';
import Logger from 'bunyan';
import { analyticsService } from '@ai/services/analytics.service';

const log: Logger = Logger.createLogger({ name: 'analyticsWorker' });

class AnalyticsWorker {
  async processPostAnalytics(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { postId } = job.data;
      await analyticsService.analyzeSinglePost(postId);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }
}

export const analyticsWorker: AnalyticsWorker = new AnalyticsWorker();
