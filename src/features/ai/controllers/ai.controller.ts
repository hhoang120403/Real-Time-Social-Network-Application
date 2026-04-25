/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { geminiService } from '@ai/services/gemini.service';
import { moderationService } from '@ai/services/moderation.service';
import { IAIGenerationRequest } from '@ai/interfaces/ai.interface';
import { config } from '@root/config';

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
    const { post_length, media_count, day_of_week, options } = req.body;
    try {
      // Map JS day (0=Sun, 1=Mon) to Python day (0=Mon, 6=Sun)
      const pythonDayOfWeek = (day_of_week + 6) % 7;

      const result = await moderationService.predictBestTime({
        post_length,
        media_count,
        day_of_week: pythonDayOfWeek,
      });

      const normalizedHour = ((result.recommended_hour % 24) + 24) % 24;
      const language = options?.language || 'Vietnamese';
      const prompt = `
        Our AI prediction says the best time to post this content is at ${normalizedHour}:00.
        Day of week: ${pythonDayOfWeek} (0=Monday, 1=Tuesday, ..., 6=Sunday)
        Post length: ${post_length} characters
        Media: ${media_count} items

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
          ...result,
          recommended_hour: normalizedHour,
          advice,
        },
      });
    } catch (error: any) {
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: error.message || 'Error predicting best time' });
    }
  }
}
