import { ObjectId } from 'mongoose';

export interface IAIOptions {
  language?: string;
  tone?: string;
  useEmoji?: boolean;
}

export interface IAIGenerationRequest {
  type:
    | 'caption'
    | 'image'
    | 'video_script'
    | 'generate'
    | 'alternatives'
    | 'improve'
    | 'check'
    | 'advice';
  context: string;
  image?: string;
  options?: IAIOptions;
}

export interface IAnalyticsJob {
  postId: string | ObjectId;
  userId: string | ObjectId;
}

export interface IAIJob {
  type: 'train_model' | 'export_data';
}
