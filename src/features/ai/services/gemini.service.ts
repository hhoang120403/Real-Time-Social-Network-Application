/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { IAIGenerationRequest } from '@ai/interfaces/ai.interface';
import { config } from '@root/config';

class GeminiServiceError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;

  private getModel(modelName = config.GEMINI_MODEL || 'gemini-2.5-flash') {
    if (!this.genAI) {
      const key = (config.GEMINI_API_KEY || '').trim();
      if (key) {
        console.log(
          `GeminiService: Initializing genAI (starts with ${key.substring(0, 5)}...)`,
        );
      } else {
        console.error(
          'GeminiService: API Key is MISSING during initialization!',
        );
      }
      this.genAI = new GoogleGenerativeAI(key);
    }
    return this.genAI.getGenerativeModel({
      model: modelName,
    });
  }

  private getModelCandidates(): string[] {
    const configuredModels = [
      config.GEMINI_MODEL || 'gemini-2.5-flash',
      ...(config.GEMINI_FALLBACK_MODELS || '')
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean),
    ];

    return Array.from(new Set(configuredModels));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isRetryableGeminiError(error: any): boolean {
    const message = String(error?.message || '').toLowerCase();
    return (
      message.includes('[503 service unavailable]') ||
      message.includes('high demand') ||
      message.includes('overloaded') ||
      message.includes('[429 too many requests]') ||
      message.includes('quota exceeded')
    );
  }

  private async generateWithFallback(
    promptOrParts: any,
    maxAttemptsPerModel = 2,
  ): Promise<any> {
    let lastError: any;

    for (const modelName of this.getModelCandidates()) {
      const model = this.getModel(modelName);

      for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt += 1) {
        try {
          if (attempt > 1) {
            console.warn(
              `GeminiService: retrying model "${modelName}" (attempt ${attempt}/${maxAttemptsPerModel})`,
            );
          }
          return await model.generateContent(promptOrParts);
        } catch (error: any) {
          lastError = error;

          if (!this.isRetryableGeminiError(error)) {
            throw error;
          }

          const retryDelay = this.getRetryDelayInSeconds(
            String(error?.message || ''),
          );
          const delayMs = retryDelay
            ? Math.min(retryDelay * 1000, 5000)
            : attempt * 750;

          if (attempt < maxAttemptsPerModel) {
            await this.sleep(delayMs);
          }
        }
      }

      console.warn(
        `GeminiService: model "${modelName}" failed after ${maxAttemptsPerModel} attempts. Trying fallback model if configured.`,
      );
    }

    throw lastError;
  }

  private async getResultText(result: any): Promise<string> {
    try {
      if (result.response.candidates && result.response.candidates.length > 0) {
        return result.response.text().trim();
      }
      return 'AI was unable to generate a response for this content due to safety filters.';
    } catch (error: any) {
      console.error('Gemini Service Response Error:', error);
      throw new Error(`Gemini Error: ${error.message}`);
    }
  }

  private getRetryDelayInSeconds(errorMessage: string): number | undefined {
    const retryMatch =
      errorMessage.match(/retryDelay":"(\d+)s"/i) ||
      errorMessage.match(/retry in ([\d.]+)s/i);
    if (!retryMatch?.[1]) return undefined;
    return Math.ceil(Number(retryMatch[1]));
  }

  private handleGeminiError(error: any): never {
    const message = String(error?.message || '');
    const retryDelay = this.getRetryDelayInSeconds(message);
    console.error('Gemini raw error:', message);

    if (
      message.includes('[429 Too Many Requests]') ||
      message.toLowerCase().includes('quota exceeded')
    ) {
      const retryText = retryDelay
        ? ` Please try again in ${retryDelay} seconds.`
        : ' Please try again later.';
      throw new GeminiServiceError(
        `AI caption quota has been reached.${retryText}`,
        429,
      );
    }

    if (
      message.includes('[503 Service Unavailable]') ||
      message.toLowerCase().includes('high demand') ||
      message.toLowerCase().includes('overloaded')
    ) {
      throw new GeminiServiceError(
        'AI caption service is busy right now. Retried with fallback models but Gemini is still unavailable. Please try again later.',
        503,
      );
    }

    if (
      message.includes('[404 Not Found]') ||
      message.toLowerCase().includes('not found') ||
      message.toLowerCase().includes('not supported')
    ) {
      throw new GeminiServiceError(
        `AI caption model "${config.GEMINI_MODEL}" is not available. Please set GEMINI_MODEL to a valid Gemini API model, for example gemini-2.5-flash-lite.`,
        503,
      );
    }

    if (
      message.includes('[400 Bad Request]') ||
      message.toLowerCase().includes('api key')
    ) {
      throw new GeminiServiceError(
        'AI caption service is not configured correctly. Please check the Gemini API key.',
        503,
      );
    }

    throw new GeminiServiceError(
      'AI caption service is temporarily unavailable. Please try again later.',
      503,
    );
  }

  public async generateCaption(data: IAIGenerationRequest): Promise<string> {
    try {
      let prompt = '';
      const { language, tone, useEmoji } = data.options;
      const tonePart = tone ? `in a ${tone} tone` : 'in an engaging tone';
      const emojiPart = useEmoji
        ? 'Include 1-3 relevant emojis.'
        : 'Do not use any emojis.';
      const langPart = language
        ? `The response MUST be in ${language}.`
        : 'Match the language of the provided context if possible, otherwise use English.';

      if (data.type === 'generate') {
        if (data.image) {
          prompt = `Analyze this image and write a catchy social media caption ${tonePart}.
                    ${emojiPart} ${langPart}
                    The caption MUST be no longer than 512 characters.`;

          let imageData: string;
          let mimeType = 'image/jpeg';

          if (data.image.startsWith('data:')) {
            const parts = data.image.split(',');
            imageData = parts[1];
            mimeType = parts[0].split(':')[1].split(';')[0];
          } else {
            try {
              const imageResp = await fetch(data.image);
              const arrayBuffer = await imageResp.arrayBuffer();
              imageData = Buffer.from(arrayBuffer).toString('base64');
              const contentType = imageResp.headers.get('content-type');
              if (contentType) mimeType = contentType;
            } catch (e) {
              throw new GeminiServiceError(
                'Failed to fetch image for AI analysis.',
                400,
              );
            }
          }

          const result = await this.generateWithFallback([
            prompt,
            {
              inlineData: {
                data: imageData,
                mimeType,
              },
            },
          ]);
          return this.getResultText(result);
        } else {
          const hasContext = !!data.context && data.context.trim().length > 0;
          const actionPrefix = hasContext ? 'Improve' : 'Write';
          prompt = `${actionPrefix} a creative social media caption based on this context: "${data.context || ''}" ${tonePart}.
                    ${emojiPart} ${langPart}
                    The caption MUST be no longer than 512 characters.`;
          const result = await this.generateWithFallback(prompt);
          return this.getResultText(result);
        }
      } else if (data.type === 'improve') {
        prompt = `Improve the following social media caption to make it more engaging, professional, and catchy: "${data.context || ''}".
                  Keep the core message but enhance the vocabulary and flow. ${tonePart}.
                  ${emojiPart} ${langPart}
                  The improved caption MUST be no longer than 512 characters.
                  Return ONLY the improved caption text.`;
        const result = await this.generateWithFallback(prompt);
        return this.getResultText(result);
      } else if (data.type === 'alternatives') {
        prompt = `Given this social media caption: "${data.context || ''}", provide 3 different alternatives ${tonePart}.
                  ${emojiPart} ${langPart}
                  Each alternative MUST be no longer than 512 characters.
                  Return ONLY the alternatives, one per line, starting with a bullet point.`;
        const result = await this.generateWithFallback(prompt);
        return this.getResultText(result);
      } else if (data.type === 'check') {
        prompt = `Review this social media post for tone, safety, and engagement: "${data.context || ''}".
                  Give a very brief feedback (max 2 sentences) and suggest a small fix if needed. ${langPart}`;
        const result = await this.generateWithFallback(prompt);
        return this.getResultText(result);
      } else if (data.type === 'advice') {
        prompt = `Based on current social media trends, when is the best time to post this content: "${data.context || ''}"?
                  Give a very brief recommendation (max 2 sentences). ${langPart}`;
        const result = await this.generateWithFallback(prompt);
        return this.getResultText(result);
      } else if (data.type === 'custom' as any) {
        const result = await this.generateWithFallback(data.context);
        return this.getResultText(result);
      }
      return '';
    } catch (error: any) {
      if (error instanceof GeminiServiceError) {
        throw error;
      }
      this.handleGeminiError(error);
    }
  }
}

export const geminiService: GeminiService = new GeminiService();
