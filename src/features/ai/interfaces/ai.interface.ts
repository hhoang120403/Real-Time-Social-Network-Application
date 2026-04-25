export interface IAIOptions {
  language?: string;
  tone?: string;
  useEmoji?: boolean;
}

export interface IAIGenerationRequest {
  type: 'generate' | 'alternatives' | 'improve' | 'check' | 'advice';
  context?: string;
  image?: string; // base64
  options: IAIOptions;
}
