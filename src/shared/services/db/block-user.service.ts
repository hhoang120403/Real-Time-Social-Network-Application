import { UserModel } from '@user/models/user.schema';
import mongoose from 'mongoose';
import { PushOperator, PullOperator } from 'mongodb';

class BlockUserService {
  public async blockUser(userId: string, followerId: string): Promise<void> {
    UserModel.bulkWrite([
      {
        updateOne: {
          filter: {
            _id: userId,
            blocked: { $ne: new mongoose.Types.ObjectId(followerId) },
          },
          update: {
            $push: {
              blocked: new mongoose.Types.ObjectId(followerId),
            } as PushOperator<Document>,
          },
        },
      },
      {
        updateOne: {
          filter: {
            _id: followerId,
            blockedBy: { $ne: new mongoose.Types.ObjectId(userId) },
          },
          update: {
            $push: {
              blockedBy: new mongoose.Types.ObjectId(userId),
            } as PushOperator<Document>,
          },
        },
      },
    ]);
  }

  public async unblockUser(userId: string, followerId: string): Promise<void> {
    UserModel.bulkWrite([
      {
        updateOne: {
          filter: { _id: userId },
          update: {
            $pull: {
              blocked: new mongoose.Types.ObjectId(followerId),
            } as PullOperator<Document>,
          },
        },
      },
      {
        updateOne: {
          filter: { _id: followerId },
          update: {
            $pull: {
              blockedBy: new mongoose.Types.ObjectId(userId),
            } as PullOperator<Document>,
          },
        },
      },
    ]);
  }
}

export const blockUserService = new BlockUserService();
