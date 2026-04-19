import { BaseQueue } from './base.queue';
import { IChatJobData, IMessageData } from '@chat/interfaces/chat.interface';
import { chatWorker } from '@worker/chat.worker';

class ChatQueue extends BaseQueue {
  constructor() {
    super('chats');
    this.processJob('addChatMessageToDB', 5, chatWorker.addChatMessageToDB);
    this.processJob(
      'markMessageAsDeletedInDB',
      5,
      chatWorker.markMessageAsDeleted,
    );
    this.processJob(
      'markMessageAsReadInDB',
      5,
      chatWorker.markMessageAsReadInDB,
    );
    this.processJob(
      'updateMessageReactionInDB',
      5,
      chatWorker.updateMessageReactionInDB,
    );
    this.processJob(
      'updateChatMessageInDB',
      5,
      chatWorker.updateChatMessageInDB,
    );
  }

  public addChatJob(name: string, data: IChatJobData | IMessageData): void {
    this.addJob(name, data);
  }
}

export const chatQueue: ChatQueue = new ChatQueue();
