import { IMessageData } from '@chat/interfaces/chat.interface';
import { chatQueue } from '@service/queues/chat.queue';
import { chatService } from '@service/db/chat.service';
import { MessageCache } from '@service/redis/message.cache';
import { socketIOChatObject } from '@socket/chat';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import mongoose from 'mongoose';

const messageCache: MessageCache = new MessageCache();

export class DeleteChatMessageController {
  public async deleteConversationForMe(
    req: Request,
    res: Response,
  ): Promise<void> {
    const receiverId = req.params.receiverId as string;
    const senderId = `${req.currentUser!.userId}`;

    await messageCache.removeChatListItemFromCache(senderId, receiverId);
    await chatService.deleteConversationForUser(
      new mongoose.Types.ObjectId(senderId),
      new mongoose.Types.ObjectId(receiverId),
    );

    res.status(HTTP_STATUS.OK).json({
      message: 'Conversation deleted successfully',
    });
  }

  public async markMessageAsDeleted(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { senderId, receiverId, messageId, type } = req.params;

    const updatedMessage: IMessageData =
      await messageCache.markMessageAsDeleted(
        `${senderId}`,
        `${receiverId}`,
        `${messageId}`,
        `${type}`,
      );

    socketIOChatObject.emit('message read', updatedMessage);
    socketIOChatObject.emit('chat list', updatedMessage);

    chatQueue.addChatJob('markMessageAsDeletedInDB', {
      messageId: new mongoose.Types.ObjectId(messageId as string),
      type: type as string,
    });

    res.status(HTTP_STATUS.OK).json({
      message: 'Message marked as deleted successfully',
    });
  }
}
