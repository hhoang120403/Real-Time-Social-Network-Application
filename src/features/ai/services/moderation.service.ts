import axios from 'axios';
import { config } from '@root/config';

export interface IModerationResult {
  backend: string;
  text: string;
  normalized_text: string;
  scores: {
    clean: number;
    hate: number;
    sexual: number;
    spam: number;
    toxic: number;
  };
  threshold: number;
  inappropriate_threshold: number;
  clean_margin: number;
  labels: string[];
  top_label: string;
  top_score: number;
  requires_review: boolean;
  is_inappropriate: boolean;
}

class ModerationService {
  public async checkContent(text: string): Promise<IModerationResult> {
    try {
      const response = await axios.post(`${config.AI_PYTHON_URL}/moderation/predict`, {
        text
      });
      return response.data;
    } catch (error) {
      console.error('Moderation Service Error:', error);
      throw new Error('Error connecting to AI Moderation Service');
    }
  }

  public async predictBestTime(data: { post_length: number; media_count: number; day_of_week: number }): Promise<any> {
    try {
      const response = await axios.post(`${config.AI_PYTHON_URL}/best-time/predict`, data);
      return response.data;
    } catch (error) {
      console.error('BestTime Service Error:', error);
      throw new Error('Error connecting to AI BestTime Service');
    }
  }
}

export const moderationService: ModerationService = new ModerationService();
