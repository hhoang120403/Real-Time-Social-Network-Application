import { IMessageData } from '@chat/interfaces/chat.interface';
import { chatService } from '@service/db/chat.service';
import { MessageCache } from '@service/redis/message.cache';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import mongoose from 'mongoose';

const messageCache: MessageCache = new MessageCache();

export class GetChatMessagesController {
  public async getConversationList(req: Request, res: Response): Promise<void> {
    let list: IMessageData[] = [];
    const cachedList: IMessageData[] =
      await messageCache.getUserConversationList(`${req.currentUser!.userId}`);
    if (cachedList.length) {
      list = cachedList;
    } else {
      list = await chatService.getUserConversationList(
        new mongoose.Types.ObjectId(req.currentUser!.userId),
      );
    }
    res.status(HTTP_STATUS.OK).json({
      message: 'Conversation list fetched successfully',
      list,
    });
  }

  public async getMessages(req: Request, res: Response): Promise<void> {
    const { receiverId } = req.params;
    let messages: IMessageData[] = [];
    const cachedMessages: IMessageData[] =
      await messageCache.getChatMessagesFromCache(
        `${req.currentUser!.userId}`,
        receiverId as string,
      );
    if (cachedMessages.length) {
      messages = cachedMessages;
    } else {
      messages = await chatService.getMessages(
        new mongoose.Types.ObjectId(req.currentUser!.userId),
        new mongoose.Types.ObjectId(receiverId as string),
        { createdAt: 1 },
      );
    }
    res.status(HTTP_STATUS.OK).json({
      message: 'Messages fetched successfully',
      messages,
    });
  }
}
