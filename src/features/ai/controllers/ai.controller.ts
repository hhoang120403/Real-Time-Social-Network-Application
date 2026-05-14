/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { geminiService } from '@ai/services/gemini.service';
import { moderationService } from '@ai/services/moderation.service';
import { IAIGenerationRequest } from '@ai/interfaces/ai.interface';
import { config } from '@root/config';
import { UserCache } from '@service/redis/user.cache';
import { bestTimeFeatureService } from '@ai/services/best_time_feature.service';

const userCache: UserCache = new UserCache();

export class AIController {
  public async generateCaption(req: Request, res: Response): Promise<void> {
    const { type, context, image, options } = req.body as IAIGenerationRequest;

    try {
      const result = await geminiService.generateCaption({
        type,
        context,
        image,
        options,
      });
      res
        .status(HTTP_STATUS.OK)
        .json({ message: 'Caption generated successfully', result });
    } catch (error: any) {
      console.error('AI Controller Error:', error);
      const statusCode = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
      res.status(statusCode).json({
        message: error.message || 'Error generating AI content',
        stack:
          config.NODE_ENV === 'development' && statusCode >= 500
            ? error.stack
            : undefined,
      });
    }
  }

  public async checkContent(req: Request, res: Response): Promise<void> {
    const { text } = req.body;
    try {
      const result = await moderationService.checkContent(text);
      res
        .status(HTTP_STATUS.OK)
        .json({ message: 'Content checked successfully', result });
    } catch (error: any) {
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: error.message || 'Error checking content' });
    }
  }

  public async getModerationAdvice(req: Request, res: Response): Promise<void> {
    const { result, text, options } = req.body;
    try {
      const language = options?.language || 'Vietnamese';
      const prompt = `
        The user wrote this text: "${text}"
        Our AI moderation system detected the following issues: ${JSON.stringify(result.scores)}
        Is Inappropriate: ${result.is_inappropriate}
        Top Label: ${result.top_label}

        Please provide a short, friendly, and constructive advice to the user.
        The advice MUST BE in ${language}.
        If the content is inappropriate, explain why politely and suggest how to make it better.
        If it's safe, give a quick encouragement.
        Keep it under 3 sentences.
      `;
      const advice = await geminiService.generateCaption({
        type: 'custom' as any,
        context: prompt,
        options: {
          language,
          tone: options?.tone || 'Friendly',
          useEmoji: options?.useEmoji ?? true,
        },
      });
      res
        .status(HTTP_STATUS.OK)
        .json({ message: 'Advice generated successfully', advice });
    } catch (error: any) {
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: 'Error generating advice' });
    }
  }

  public async getBestTime(req: Request, res: Response): Promise<void> {
    const { options, media_type } = req.body;
    try {
      const userId = req.currentUser!.userId;
      const user = await userCache.getUserFromCache(userId);
      if (!user) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'User not found' });
        return;
      }

      const mediaType = media_type || 'image';
      const candidates = await bestTimeFeatureService.buildCandidates(
        user,
        mediaType,
      );

      const response =
        await moderationService.predictBestTimeScores(candidates);
      const predictions = response.predictions;

      // Implement Hybrid Logic
      const postCount = user.postsCount || 0;
      let mode = 'personal_ai';
      let confidence = 'high';

      if (postCount === 0) {
        mode = 'global_fallback';
        confidence = 'low';
      } else if (postCount < 10) {
        mode = 'hybrid_global_ai';
        confidence = 'medium';
      }

      // Add final score and sort
      const finalPredictions = predictions.map((p: any) => {
        const finalScore = p.predictedEngagementScore;
        if (postCount === 0) {
          // Just use global score (which is what AI should predict anyway if trained well)
        } else if (postCount < 10) {
          // Mix AI and global (assuming we have global stats in the candidate data if needed)
          // For now we keep it simple as AI model should handle the features
        }
        return { ...p, finalScore };
      });

      const top5 = finalPredictions
        .sort((a: any, b: any) => b.finalScore - a.finalScore)
        .slice(0, 5);
      const recommended = top5[0];

      const language = options?.language || 'Vietnamese';
      const prompt = `
        Our AI prediction says the best time to post this content is at ${recommended.hour}:00 on day ${recommended.dayOfWeek} (0=Sun, 1=Mon...).
        Mode: ${mode}
        Confidence: ${confidence}

        Please explain to the user why this is a good time in a friendly way (in ${language}).
        Mention things like user activity patterns or peak engagement hours.
        Keep it under 3 sentences.
      `;

      const advice = await geminiService.generateCaption({
        type: 'custom' as any,
        context: prompt,
        options: {
          language,
          tone: options?.tone || 'Friendly',
          useEmoji: options?.useEmoji ?? true,
        },
      });

      res.status(HTTP_STATUS.OK).json({
        message: 'Best time predicted successfully',
        result: {
          recommended_hour: recommended.hour,
          recommended_day: recommended.dayOfWeek,
          mode,
          confidence,
          top5,
          advice,
        },
      });
    } catch (error: any) {
      console.error('BestTime Error:', error);
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: error.message || 'Error predicting best time' });
    }
  }
}
