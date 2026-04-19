import { IMessageData } from '@chat/interfaces/chat.interface';
import { IConversationDocument } from '@chat/interfaces/conversation.interface';
import { MessageModel } from '@chat/models/chat.schema';
import { ConversationModel } from '@chat/models/conversation.schema';
import { ObjectId } from 'mongodb';

class ChatService {
  public async addMessageToDB(data: IMessageData): Promise<void> {
    const conversation: IConversationDocument[] = await ConversationModel.find({
      _id: data?.conversationId,
    }).exec();

    if (conversation.length === 0) {
      await ConversationModel.create({
        _id: data?.conversationId,
        senderId: data?.senderId,
        receiverId: data?.receiverId,
        deletedFor: [],
        deletedAtFor: [],
      });
    } else {
      await ConversationModel.updateOne(
        { _id: data?.conversationId },
        { $pull: { deletedFor: { $in: [data.senderId, data.receiverId] } } },
      ).exec();
    }

    await MessageModel.create({
      _id: data._id,
      conversationId: data.conversationId,
      receiverId: data.receiverId,
      receiverUsername: data.receiverUsername,
      receiverAvatarColor: data.receiverAvatarColor,
      receiverProfilePicture: data.receiverProfilePicture,
      senderId: data.senderId,
      senderUsername: data.senderUsername,
      senderAvatarColor: data.senderAvatarColor,
      senderProfilePicture: data.senderProfilePicture,
      body: data.body,
      gifUrl: data.gifUrl,
      isRead: data.isRead,
      selectedImage: data.selectedImage,
      reaction: data.reaction,
      createdAt: data.createdAt,
    });
  }

  public async getUserConversationList(
    userId: ObjectId,
  ): Promise<IMessageData[]> {
    const hiddenConversations = await ConversationModel.find({
      'deletedAtFor.userId': userId,
    })
      .select('_id deletedAtFor')
      .exec();
    const deletedAtByConversation = new Map<string, Date>();
    hiddenConversations.forEach((conversation) => {
      const deletedAtItem = conversation.deletedAtFor.find(
        (item) => `${item.userId}` === `${userId}`,
      );
      if (deletedAtItem) {
        deletedAtByConversation.set(
          `${conversation._id}`,
          deletedAtItem.deletedAt,
        );
      }
    });

    const messages: IMessageData[] = await MessageModel.aggregate([
      {
        $match: {
          $or: [{ senderId: userId }, { receiverId: userId }],
        },
      },
      {
        $group: {
          _id: '$conversationId',
          result: {
            $last: '$$ROOT',
          },
        },
      },
      {
        $project: {
          _id: '$result._id',
          conversationId: '$result.conversationId',
          senderId: '$result.senderId',
          senderUsername: '$result.senderUsername',
          senderAvatarColor: '$result.senderAvatarColor',
          senderProfilePicture: '$result.senderProfilePicture',
          receiverId: '$result.receiverId',
          receiverUsername: '$result.receiverUsername',
          receiverAvatarColor: '$result.receiverAvatarColor',
          receiverProfilePicture: '$result.receiverProfilePicture',
          body: '$result.body',
          gifUrl: '$result.gifUrl',
          isRead: '$result.isRead',
          selectedImage: '$result.selectedImage',
          reaction: '$result.reaction',
          createdAt: '$result.createdAt',
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
    ]);
    return messages.filter((message) => {
      const deletedAt = deletedAtByConversation.get(
        `${message.conversationId}`,
      );
      return !deletedAt || new Date(message.createdAt) > deletedAt;
    });
  }

  public async deleteConversationForUser(
    senderId: ObjectId,
    receiverId: ObjectId,
  ): Promise<void> {
    const deletedAt = new Date();
    await ConversationModel.updateOne(
      {
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
      {
        $addToSet: { deletedFor: senderId },
        $pull: { deletedAtFor: { userId: senderId } },
      },
    ).exec();
    await ConversationModel.updateOne(
      {
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
      { $push: { deletedAtFor: { userId: senderId, deletedAt } } },
    ).exec();
  }

  public async getConversationDeletedAtForUser(
    senderId: ObjectId,
    receiverId: ObjectId,
  ): Promise<Date | null> {
    const conversation = await ConversationModel.findOne({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    })
      .select('deletedAtFor')
      .exec();

    const deletedAtItem = conversation?.deletedAtFor.find(
      (item) => `${item.userId}` === `${senderId}`,
    );
    return deletedAtItem?.deletedAt ?? null;
  }

  public async getMessages(
    senderId: ObjectId,
    receiverId: ObjectId,
    sort: Record<string, 1 | -1>,
  ): Promise<IMessageData[]> {
    const query = {
      $or: [
        {
          senderId: senderId,
          receiverId: receiverId,
        },
        {
          senderId: receiverId,
          receiverId: senderId,
        },
      ],
    };
    const messages: IMessageData[] = await MessageModel.aggregate([
      {
        $match: query,
      },
      {
        $sort: sort,
      },
    ]);
    return messages;
  }

  public async markMessageAsDeleted(
    messageId: string,
    type: string,
  ): Promise<void> {
    if (type === 'deleteForMe') {
      await MessageModel.updateOne(
        { _id: messageId },
        { $set: { deleteForMe: true } },
      ).exec();
    } else if (type === 'deleteForEveryone') {
      await MessageModel.updateOne(
        { _id: messageId },
        { $set: { deleteForMe: true, deleteForEveryone: true } },
      ).exec();
    }
  }

  public async markMessageAsRead(
    senderId: ObjectId,
    receiverId: ObjectId,
  ): Promise<void> {
    const query = {
      $or: [
        {
          senderId: senderId,
          receiverId: receiverId,
          isRead: false,
        },
        {
          senderId: receiverId,
          receiverId: senderId,
          isRead: false,
        },
      ],
    };
    await MessageModel.updateMany(query, { $set: { isRead: true } }).exec();
  }

  public async updateMessageReaction(
    messageId: ObjectId,
    senderName: string,
    reaction: string,
    type: 'add' | 'remove',
  ): Promise<void> {
    if (type === 'add') {
      await MessageModel.updateOne(
        { _id: messageId },
        { $push: { reaction: { senderName, type: reaction } } },
      ).exec();
    } else {
      await MessageModel.updateOne(
        { _id: messageId },
        { $pull: { reaction: { senderName } } },
      ).exec();
    }
  }

  public async editChatMessage(
    messageId: string,
    body: string,
    gifUrl = '',
    selectedImage = '',
  ): Promise<void> {
    await MessageModel.updateOne(
      { _id: messageId },
      { $set: { body, gifUrl, selectedImage } },
    ).exec();
  }
}

export const chatService: ChatService = new ChatService();
