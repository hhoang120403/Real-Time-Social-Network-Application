import { IMessageData } from '@chat/interfaces/chat.interface';
import { chatQueue } from '@service/queues/chat.queue';
import { MessageCache } from '@service/redis/message.cache';
import { socketIOChatObject } from '@socket/chat';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import mongoose from 'mongoose';

const messageCache: MessageCache = new MessageCache();

export class AddMessageReactionController {
  public async addMessageReaction(req: Request, res: Response): Promise<void> {
    const { conversationId, messageId, reaction, type } = req.body;

    const updatedMessage: IMessageData =
      await messageCache.updateMessageReaction(
        conversationId,
        messageId,
        reaction,
        `${req.currentUser!.username}`,
        type,
      );

    socketIOChatObject.emit('message reaction', updatedMessage);

    chatQueue.addChatJob('updateMessageReactionInDB', {
      messageId: new mongoose.Types.ObjectId(messageId as string),
      reaction,
      senderName: `${req.currentUser!.username}`,
      type,
    });

    res.status(HTTP_STATUS.OK).json({
      message: 'Message reaction updated successfully',
    });
  }
}
