import { Request, Response } from 'express';
import { authUserPayload } from '@root/mocks/auth.mock';
import {
  chatMessage,
  chatMockRequest,
  chatMockResponse,
  messageDataMock,
} from '@root/mocks/chat.mock';
import { MessageCache } from '@service/redis/message.cache';
import { GetChatMessagesController } from '@chat/controllers/get-chat-messages';
import { chatService } from '@service/db/chat.service';

jest.useFakeTimers();
jest.mock('@service/queues/base.queue');
jest.mock('@service/redis/message.cache');

describe('Get', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('conversationList', () => {
    it('should send correct json response if chat list exist in redis', async () => {
      const req: Request = chatMockRequest({}, {}, authUserPayload) as Request;
      const res: Response = chatMockResponse();
      jest
        .spyOn(MessageCache.prototype, 'getUserConversationList')
        .mockResolvedValue([messageDataMock]);

      await GetChatMessagesController.prototype.getConversationList(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Conversation list fetched successfully',
        list: [messageDataMock],
      });
    });

    it('should send correct json response if no chat list response from redis', async () => {
      const req: Request = chatMockRequest({}, {}, authUserPayload) as Request;
      const res: Response = chatMockResponse();
      jest
        .spyOn(MessageCache.prototype, 'getUserConversationList')
        .mockResolvedValue([]);
      jest
        .spyOn(chatService, 'getUserConversationList')
        .mockResolvedValue([messageDataMock]);

      await GetChatMessagesController.prototype.getConversationList(req, res);
      expect(chatService.getUserConversationList).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Conversation list fetched successfully',
        list: [messageDataMock],
      });
    });

    it('should send correct json response with empty chat list if it does not exist (redis & database)', async () => {
      const req: Request = chatMockRequest(
        {},
        chatMessage,
        authUserPayload,
      ) as Request;
      const res: Response = chatMockResponse();
      jest
        .spyOn(MessageCache.prototype, 'getUserConversationList')
        .mockResolvedValue([]);
      jest.spyOn(chatService, 'getUserConversationList').mockResolvedValue([]);

      await GetChatMessagesController.prototype.getConversationList(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Conversation list fetched successfully',
        list: [],
      });
    });
  });

  describe('messages', () => {
    it('should send correct json response if chat messages exist in redis', async () => {
      const req: Request = chatMockRequest({}, chatMessage, authUserPayload, {
        receiverId: '60263f14648fed5246e322d8',
      }) as Request;
      const res: Response = chatMockResponse();
      jest
        .spyOn(MessageCache.prototype, 'getChatMessagesFromCache')
        .mockResolvedValue([messageDataMock]);

      await GetChatMessagesController.prototype.getMessages(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Messages fetched successfully',
        messages: [messageDataMock],
      });
    });

    it('should send correct json response if no chat message response from redis', async () => {
      const req: Request = chatMockRequest({}, chatMessage, authUserPayload, {
        receiverId: '60263f14648fed5246e322d8',
      }) as Request;
      const res: Response = chatMockResponse();
      jest
        .spyOn(MessageCache.prototype, 'getChatMessagesFromCache')
        .mockResolvedValue([]);
      jest
        .spyOn(chatService, 'getMessages')
        .mockResolvedValue([messageDataMock]);

      await GetChatMessagesController.prototype.getMessages(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Messages fetched successfully',
        messages: [messageDataMock],
      });
    });

    it('should send correct json response with empty chat messages if it does not exist (redis & database)', async () => {
      const req: Request = chatMockRequest({}, chatMessage, authUserPayload, {
        receiverId: '6064793b091bf02b6a71067a',
      }) as Request;
      const res: Response = chatMockResponse();
      jest
        .spyOn(MessageCache.prototype, 'getChatMessagesFromCache')
        .mockResolvedValue([]);
      jest.spyOn(chatService, 'getMessages').mockResolvedValue([]);

      await GetChatMessagesController.prototype.getMessages(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Messages fetched successfully',
        messages: [],
      });
    });
  });
});
