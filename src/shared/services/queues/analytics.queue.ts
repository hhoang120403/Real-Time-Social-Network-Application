/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseQueue } from '@service/queues/base.queue';
import { IAnalyticsJob, IAIJob } from '@ai/interfaces/ai.interface';

import { analyticsWorker } from '@worker/analytics.worker';
import { aiWorker } from '@worker/ai.worker';

class AnalyticsQueue extends BaseQueue {
  constructor() {
    super('analytics');
    this.processJob(
      'calculate-post-engagement',
      5,
      analyticsWorker.processPostAnalytics,
    );
  }

  public addAnalyticsJob(
    name: string,
    data: IAnalyticsJob,
    options?: any,
  ): void {
    this.addJob(name, data, options);
  }
}

class AIQueue extends BaseQueue {
  constructor() {
    super('ai');
    this.processJob('train-model', 1, aiWorker.processAIJob);

    // Add nightly training job at 2 AM
    this.addAIJob(
      'train-model',
      { type: 'train_model' },
      {
        repeat: { cron: '0 2 * * *' },
      },
    );
  }

  public addAIJob(name: string, data: IAIJob, options?: any): void {
    this.addJob(name, data, options);
  }
}

export const analyticsQueue: AnalyticsQueue = new AnalyticsQueue();
export const aiQueue: AIQueue = new AIQueue();
