import { BaseQueue } from './base.queue';
import { IFileImageJobData } from '@image/interfaces/image.interface';
import { imageWorker } from '@worker/image.worker';

class ImageQueue extends BaseQueue {
  constructor() {
    super('images');
    this.processJob(
      'updateUserProfileImage',
      5,
      imageWorker.updateUserProfileImageToDB,
    );
    this.processJob(
      'updateBackgroundImage',
      5,
      imageWorker.updateBackgroundImageInDB,
    );
    this.processJob('addImageToDB', 5, imageWorker.addImageToDB);
    this.processJob('removeImageFromDB', 5, imageWorker.removeImageFromDB);
  }

  public addImageJob(name: string, data: IFileImageJobData): void {
    this.addJob(name, data);
  }
}

export const imageQueue: ImageQueue = new ImageQueue();
