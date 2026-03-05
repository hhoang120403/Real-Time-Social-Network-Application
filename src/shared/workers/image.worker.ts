import { DoneCallback, Job } from 'bull';
import Logger from 'bunyan';
import { config } from '@root/config';
import { imageService } from '@service/db/image.service';

const log: Logger = config.createLogger('image-worker');

class ImageWorker {
  async updateUserProfileImageToDB(
    job: Job,
    done: DoneCallback,
  ): Promise<void> {
    try {
      const { key, value, imgId, imgVersion } = job.data;
      await imageService.updateUserProfileImageToDB(
        key,
        value,
        imgId,
        imgVersion,
      );
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }

  async updateBackgroundImageInDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key, imgId, imgVersion } = job.data;
      await imageService.updateBackgroundImageToDB(key, imgId, imgVersion);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }

  async addImageToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key, imgId, imgVersion } = job.data;
      await imageService.addImage(key, imgId, imgVersion, '');
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }

  async removeImageFromDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { imageId } = job.data;
      await imageService.removeImageFromDB(imageId);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }
}

export const imageWorker: ImageWorker = new ImageWorker();
