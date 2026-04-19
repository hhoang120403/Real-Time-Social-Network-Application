import { IFileImageDocument } from '@image/interfaces/image.interface';
import { ImageModel } from '@image/models/image.schema';
import { UserModel } from '@user/models/user.schema';
import { PostModel } from '@post/models/post.schema';
import mongoose from 'mongoose';

class ImageService {
  public async updateUserProfileImageToDB(
    userId: string,
    url: string,
    imgId: string,
    imgVersion: string,
  ): Promise<void> {
    await Promise.all([
      UserModel.updateOne(
        { _id: userId },
        { $set: { profilePicture: url } },
      ).exec(),
      PostModel.updateMany(
        { userId: userId },
        { $set: { profilePicture: url } },
      ).exec(),
    ]);
    await this.addImage(userId, imgId, imgVersion, 'profile');
  }

  public async updateBackgroundImageToDB(
    userId: string,
    imgId: string,
    imgVersion: string,
  ): Promise<void> {
    await UserModel.updateOne(
      { _id: userId },
      { $set: { bgImageId: imgId, bgImageVersion: imgVersion } },
    ).exec();
    if (imgId && imgVersion) {
      await this.addImage(userId, imgId, imgVersion, 'background');
    }
  }

  public async addImage(
    userId: string,
    imgId: string,
    imgVersion: string,
    type: string,
  ): Promise<void> {
    await ImageModel.create({
      userId,
      bgImageVersion: type === 'background' ? imgVersion : '',
      bgImageId: type === 'background' ? imgId : '',
      imgVersion,
      imgId,
    });
  }

  public async removeImageFromDB(imageId: string): Promise<void> {
    await ImageModel.deleteOne({ _id: imageId }).exec();
  }

  public async getImageByBackgroundId(
    bgImageId: string,
  ): Promise<IFileImageDocument> {
    const image: IFileImageDocument = (await ImageModel.findOne({
      bgImageId,
    }).exec()) as IFileImageDocument;
    return image;
  }

  public async getImages(userId: string): Promise<IFileImageDocument[]> {
    const images: IFileImageDocument[] = (await ImageModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
        },
      },
    ]).exec()) as IFileImageDocument[];
    return images;
  }
}

export const imageService: ImageService = new ImageService();
