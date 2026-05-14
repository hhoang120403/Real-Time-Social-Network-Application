import { IPostAnalyticsDocument } from '@ai/interfaces/analytics.interface';
import mongoose, { model, Model, Schema } from 'mongoose';

const postAnalyticsSchema: Schema = new Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
  followersCountAtPostTime: { type: Number, default: 0 },
  engagementScore: { type: Number, default: 0 },
  collectedAfterHours: { type: Number, default: 24 },
  collectedAt: { type: Date, default: Date.now },
});

const PostAnalyticsModel: Model<IPostAnalyticsDocument> = model<IPostAnalyticsDocument>(
  'PostAnalytics',
  postAnalyticsSchema,
  'PostAnalytics',
);

export { PostAnalyticsModel };
