import { ObjectId } from 'mongodb';
import { Document } from 'mongoose';

export interface IPostAnalyticsDocument extends Document {
  _id: ObjectId;
  postId: ObjectId | string;
  userId: ObjectId | string;
  likes: number;
  comments: number;
  saves: number;
  followersCountAtPostTime: number;
  engagementScore: number;
  collectedAfterHours: number;
  collectedAt: Date;
}
