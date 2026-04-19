import { AddChatMessageController } from '@chat/controllers/add-chat-message';
import { AddMessageReactionController } from '@chat/controllers/add-message-reaction';
import { DeleteChatMessageController } from '@chat/controllers/delete-chat-message';
import { GetChatMessagesController } from '@chat/controllers/get-chat-messages';
import { UpdateChatMessageController } from '@chat/controllers/update-chat-message';
import { authMiddleware } from '@global/helpers/auth-middleware';

import express, { Router } from 'express';

class ChatRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get(
      '/chat/message/conversation-list',
      authMiddleware.checkAuthentication,
      GetChatMessagesController.prototype.getConversationList,
    );
    this.router.get(
      '/chat/message/user/:receiverId',
      authMiddleware.checkAuthentication,
      GetChatMessagesController.prototype.getMessages,
    );
    this.router.post(
      '/chat/message',
      authMiddleware.checkAuthentication,
      AddChatMessageController.prototype.addChatMessage,
    );
    this.router.post(
      '/chat/message/add-chat-users',
      authMiddleware.checkAuthentication,
      AddChatMessageController.prototype.addChatUsers,
    );
    this.router.post(
      '/chat/message/remove-chat-users',
      authMiddleware.checkAuthentication,
      AddChatMessageController.prototype.removeChatUsers,
    );
    this.router.put(
      '/chat/message/mark-as-read',
      authMiddleware.checkAuthentication,
      UpdateChatMessageController.prototype.markMessageAsRead,
    );
    this.router.put(
      '/chat/message/update',
      authMiddleware.checkAuthentication,
      UpdateChatMessageController.prototype.editChatMessage,
    );
    this.router.put(
      '/chat/message/reaction',
      authMiddleware.checkAuthentication,
      AddMessageReactionController.prototype.addMessageReaction,
    );
    this.router.delete(
      '/chat/message/mark-as-deleted/:messageId/:senderId/:receiverId/:type',
      authMiddleware.checkAuthentication,
      DeleteChatMessageController.prototype.markMessageAsDeleted,
    );
    this.router.delete(
      '/chat/message/conversation/:receiverId',
      authMiddleware.checkAuthentication,
      DeleteChatMessageController.prototype.deleteConversationForMe,
    );

    return this.router;
  }
}

export const chatRoutes: ChatRoutes = new ChatRoutes();
