import { model, Model, Schema, Document } from 'mongoose';

export interface IGlobalStatsDocument extends Document {
  type: string; // 'hour', 'day', 'day_hour', 'global'
  dayOfWeek?: number;
  hour?: number;
  avgEngagementScore: number;
  postCount: number;
  updatedAt: Date;
}

const globalStatsSchema: Schema = new Schema({
  type: { type: String, required: true, index: true },
  dayOfWeek: { type: Number },
  hour: { type: Number },
  avgEngagementScore: { type: Number, default: 0 },
  postCount: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

const GlobalStatsModel: Model<IGlobalStatsDocument> =
  model<IGlobalStatsDocument>('GlobalStats', globalStatsSchema, 'GlobalStats');

export { GlobalStatsModel };
