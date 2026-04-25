import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { StreamClient } from '@stream-io/node-sdk';
import { config } from '@root/config';

export class VideoController {
  public async token(req: Request, res: Response): Promise<void> {
    const apiKey = config.STREAM_API_KEY;
    const apiSecret = config.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Stream API keys are missing in backend configuration' });
      return;
    }

    const client = new StreamClient(apiKey, apiSecret);
    const userId = req.currentUser!.userId;
    // Expire token in 1 hour
    const token = client.generateUserToken({ user_id: userId, validity_in_seconds: 3600 });
    
    res.status(HTTP_STATUS.OK).json({ token });
  }
}
