import { IMessageData } from '@chat/interfaces/chat.interface';
import { markChatSchema, editChatSchema } from '@chat/schemas/chat';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { uploads } from '@global/helpers/cloudinary-upload';
import { BadRequestError } from '@global/helpers/error-handler';
import { chatQueue } from '@service/queues/chat.queue';
import { MessageCache } from '@service/redis/message.cache';
import { config } from '@root/config';
import { socketIOChatObject } from '@socket/chat';
import { UploadApiResponse } from 'cloudinary';
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

  @joiValidation(editChatSchema)
  public async editChatMessage(req: Request, res: Response): Promise<void> {
    const { senderId, receiverId, messageId, body, gifUrl = '', selectedImage = '' } = req.body;
    let fileUrl = selectedImage;

    if (selectedImage?.startsWith('data:image')) {
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

    const updatedMessage: IMessageData & { isLastMessage: boolean } =
      await messageCache.updateChatMessage(
        `${senderId}`,
        `${receiverId}`,
        `${messageId}`,
        `${body}`,
        `${gifUrl}`,
        `${fileUrl}`,
      );

    socketIOChatObject.emit('message update', updatedMessage);
    if (updatedMessage.isLastMessage) {
      socketIOChatObject.emit('chat list', {
        ...updatedMessage,
        isEdited: true,
      });
    }

    chatQueue.addChatJob('updateChatMessageInDB', {
      messageId: new mongoose.Types.ObjectId(messageId as string),
      body,
      gifUrl,
      selectedImage: fileUrl,
    });

    res.status(HTTP_STATUS.OK).json({
      message: 'Message updated successfully',
    });
  }
}
