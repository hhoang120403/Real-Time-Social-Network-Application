import { IMessageData } from '@chat/interfaces/chat.interface';
import { markChatSchema } from '@chat/schemas/chat';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { chatQueue } from '@service/queues/chat.queue';
import { MessageCache } from '@service/redis/message.cache';
import { socketIOChatObject } from '@socket/chat';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import mongoose from 'mongoose';

const messageCache: MessageCache = new MessageCache();

export class UpdateChatMessageController {
  @joiValidation(markChatSchema)
  public async markMessageAsRead(req: Request, res: Response): Promise<void> {
    const { senderId, receiverId } = req.body;

    const updatedMessage: IMessageData = await messageCache.updateChatMessages(
      `${senderId}`,
      `${receiverId}`,
    );

    socketIOChatObject.emit('message read', updatedMessage);
    socketIOChatObject.emit('chat list', updatedMessage);

    chatQueue.addChatJob('markMessageAsReadInDB', {
      senderId: new mongoose.Types.ObjectId(senderId as string),
      receiverId: new mongoose.Types.ObjectId(receiverId as string),
    });

    res.status(HTTP_STATUS.OK).json({
      message: 'Message marked as read successfully',
    });
  }
}
