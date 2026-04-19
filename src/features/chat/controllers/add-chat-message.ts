import {
  IMessageData,
  IMessageNotification,
} from '@chat/interfaces/chat.interface';
import { addChatSchema } from '@chat/schemas/chat';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { uploads } from '@global/helpers/cloudinary-upload';
import { BadRequestError } from '@global/helpers/error-handler';
import { INotificationTemplate } from '@notification/interfaces/notification.interface';
import { config } from '@root/config';
import { notificationTemplate } from '@service/emails/templates/notifications/notification-template';
import { chatQueue } from '@service/queues/chat.queue';
import { emailQueue } from '@service/queues/email.queue';
import { MessageCache } from '@service/redis/message.cache';
import { UserCache } from '@service/redis/user.cache';
import { socketIOChatObject } from '@socket/chat';
import { IUserDocument } from '@user/interfaces/user.interface';
import { UploadApiResponse } from 'cloudinary';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { ObjectId } from 'mongodb';
import mongoose from 'mongoose';

const userCache: UserCache = new UserCache();
const messageCache: MessageCache = new MessageCache();

export class AddChatMessageController {
  @joiValidation(addChatSchema)
  public async addChatMessage(req: Request, res: Response): Promise<void> {
    const {
      conversationId,
      receiverId,
      receiverUsername,
      receiverAvatarColor,
      receiverProfilePicture,
      body,
      gifUrl,
      isRead,
      selectedImage,
    } = req.body;

    let fileUrl = '';
    const messageObjectId: ObjectId = new ObjectId();
    const conversationObjectId: ObjectId = conversationId
      ? new mongoose.Types.ObjectId(conversationId)
      : new ObjectId();

    const sender: IUserDocument = (await userCache.getUserFromCache(
      req.currentUser!.userId,
    )) as IUserDocument;

    if (selectedImage.length) {
      const result: UploadApiResponse = (await uploads(
        selectedImage,
        `${req.currentUser!.userId}`,
        true,
        true,
      )) as UploadApiResponse;

      if (!result?.public_id) {
        throw new BadRequestError(result.message);
      }

      fileUrl = `https://res.cloudinary.com/${config.CLOUD_NAME}/image/upload/v${result.version}/${result.public_id}`;
    }

    const messageData: IMessageData = {
      _id: messageObjectId,
      conversationId: conversationObjectId,
      receiverId,
      receiverUsername,
      receiverAvatarColor,
      receiverProfilePicture,
      senderId: `${req.currentUser!.userId}`,
      senderUsername: `${req.currentUser!.username}`,
      senderAvatarColor: `${req.currentUser!.avatarColor}`,
      senderProfilePicture: `${sender.profilePicture}`,
      body,
      gifUrl,
      isRead,
      selectedImage: fileUrl,
      reaction: [],
      createdAt: new Date(),
      deleteForEveryone: false,
      deleteForMe: false,
    };

    if (!isRead) {
      AddChatMessageController.prototype.messageNotification({
        currentUser: req.currentUser!,
        message: body,
        receiverName: receiverUsername,
        receiverId,
        messageData,
      });
    }

    // 1 - Add sender to chat list in cache
    await messageCache.addChatListToCache(
      `${req.currentUser!.userId}`,
      `${receiverId}`,
      `${conversationObjectId}`,
    );

    // 2 - Add receiver to chat list in cache
    await messageCache.addChatListToCache(
      `${receiverId}`,
      `${req.currentUser!.userId}`,
      `${conversationObjectId}`,
    );

    // 3 - Add message data to cache
    await messageCache.addChatMessageToCache(
      `${conversationObjectId}`,
      messageData,
    );

    AddChatMessageController.prototype.emitSocketIoEvent(messageData);

    // 4 - Add message to chat queue (db)
    chatQueue.addChatJob('addChatMessageToDB', messageData);

    res.status(HTTP_STATUS.OK).json({
      message: 'Message added successfully',
      conversationId: conversationObjectId,
    });
  }

  public async addChatUsers(req: Request, res: Response): Promise<void> {
    const chatUsers = await messageCache.addChatUsersToCache(req.body);
    socketIOChatObject.emit('add chat users', chatUsers);
    res.status(HTTP_STATUS.OK).json({
      message: 'Chat users added successfully',
    });
  }

  public async removeChatUsers(req: Request, res: Response): Promise<void> {
    const chatUsers = await messageCache.removeChatUsersFromCache(req.body);
    socketIOChatObject.emit('add chat users', chatUsers);
    res.status(HTTP_STATUS.OK).json({
      message: 'Chat users removed successfully',
    });
  }

  private emitSocketIoEvent(data: IMessageData): void {
    socketIOChatObject.emit('message received', data);
    socketIOChatObject.emit('chat list', data);
  }

  private async messageNotification({
    currentUser,
    message,
    receiverName,
    receiverId,
  }: IMessageNotification): Promise<void> {
    const cachedUser: IUserDocument = (await userCache.getUserFromCache(
      `${receiverId}`,
    )) as IUserDocument;
    if (cachedUser.notifications.messages) {
      const templateParams: INotificationTemplate = {
        username: receiverName,
        message,
        header: `Message notification from ${currentUser.username}`,
      };
      const template: string =
        notificationTemplate.notificationMessageTemplate(templateParams);
      emailQueue.addEmailJob('directMessageEmail', {
        receiverEmail: cachedUser.email!,
        template,
        subject: `You've received a message from ${currentUser.username}`,
      });
    }
  }
}
