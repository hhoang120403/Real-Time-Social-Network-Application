import { Job, DoneCallback } from 'bull';
import Logger from 'bunyan';
import { analyticsService } from '@ai/services/analytics.service';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
const log: Logger = Logger.createLogger({ name: 'aiWorker' });

class AIWorker {
  async processAIJob(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { type } = job.data;
      
      if (type === 'train_model') {
        log.info('Starting nightly AI training process...');
        
        // 1. Calculate global stats first
        await analyticsService.calculateGlobalStats();
        
        // 2. Export fresh training data
        // Using absolute path or relative to project root
        await execPromise('npm run ai:export');
        log.info('Data exported successfully.');
        
        // 3. (Optional) Trigger Python Training if a script exists
        // await execPromise('python Model_AI_Backend/train.py');
        
        log.info('AI Training process completed.');
      }
      
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }
}

export const aiWorker: AIWorker = new AIWorker();
