import { Request, Response } from 'express';
import { authUserPayload } from '@root/mocks/auth.mock';
import {
  reactionMockRequest,
  reactionMockResponse,
  reactionData,
} from '@root/mocks/reactions.mock';
import { reactionService } from '@service/db/reaction.service';
import { ReactionCache } from '@service/redis/reaction.cache';
import { GetReactionsController } from '@reaction/controllers/get-reactions';
import { postMockData } from '@root/mocks/post.mock';
import mongoose from 'mongoose';

jest.useFakeTimers();
jest.mock('@service/queues/base.queue');
jest.mock('@service/redis/reaction.cache');

describe('Get', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('reactions', () => {
    it('should send correct json response if reactions exist in cache', async () => {
      const req: Request = reactionMockRequest({}, {}, authUserPayload, {
        postId: `${postMockData._id}`,
      }) as Request;
      const res: Response = reactionMockResponse();
      jest
        .spyOn(ReactionCache.prototype, 'getReactionsFromCache')
        .mockResolvedValue([[reactionData], 1]);

      await GetReactionsController.prototype.getReactions(req, res);
      expect(
        ReactionCache.prototype.getReactionsFromCache,
      ).toHaveBeenCalledWith(`${postMockData._id}`);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Reactions retrieved successfully',
        reactions: [reactionData],
        count: 1,
      });
    });

    it('should send correct json response if reactions exist in database', async () => {
      const req: Request = reactionMockRequest({}, {}, authUserPayload, {
        postId: `${postMockData._id}`,
      }) as Request;
      const res: Response = reactionMockResponse();
      jest
        .spyOn(ReactionCache.prototype, 'getReactionsFromCache')
        .mockResolvedValue([[], 0]);
      jest
        .spyOn(reactionService, 'getPostReactions')
        .mockResolvedValue([[reactionData], 1]);

      await GetReactionsController.prototype.getReactions(req, res);
      expect(reactionService.getPostReactions).toHaveBeenCalledWith(
        { postId: new mongoose.Types.ObjectId(`${postMockData._id}`) },
        { createdAt: -1 },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Reactions retrieved successfully',
        reactions: [reactionData],
        count: 1,
      });
    });

    it('should send correct json response if reactions list is empty', async () => {
      const req: Request = reactionMockRequest({}, {}, authUserPayload, {
        postId: `${postMockData._id}`,
      }) as Request;
      const res: Response = reactionMockResponse();
      jest
        .spyOn(ReactionCache.prototype, 'getReactionsFromCache')
        .mockResolvedValue([[], 0]);
      jest
        .spyOn(reactionService, 'getPostReactions')
        .mockResolvedValue([[], 0]);

      await GetReactionsController.prototype.getReactions(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Reactions retrieved successfully',
        reactions: [],
        count: 0,
      });
    });
  });

  describe('singleReactionByUsername', () => {
    it('should send correct json response if reactions exist in cache', async () => {
      const req: Request = reactionMockRequest({}, {}, authUserPayload, {
        postId: `${postMockData._id}`,
        username: postMockData.username,
      }) as Request;
      const res: Response = reactionMockResponse();
      jest
        .spyOn(ReactionCache.prototype, 'getSingleReactionByUsernameFromCache')
        .mockResolvedValue([reactionData, 1]);

      await GetReactionsController.prototype.getSingleReactionByUsername(
        req,
        res,
      );
      expect(
        ReactionCache.prototype.getSingleReactionByUsernameFromCache,
      ).toHaveBeenCalledWith(`${postMockData._id}`, postMockData.username);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Reaction by username retrieved successfully',
        reaction: reactionData,
        count: 1,
      });
    });

    it('should send correct json response if reactions exist in database', async () => {
      const req: Request = reactionMockRequest({}, {}, authUserPayload, {
        postId: `${postMockData._id}`,
        username: postMockData.username,
      }) as Request;
      const res: Response = reactionMockResponse();
      jest
        .spyOn(ReactionCache.prototype, 'getSingleReactionByUsernameFromCache')
        .mockResolvedValue([]);
      jest
        .spyOn(reactionService, 'getSinglePostReactionByUsername')
        .mockResolvedValue([reactionData, 1]);

      await GetReactionsController.prototype.getSingleReactionByUsername(
        req,
        res,
      );
      expect(
        reactionService.getSinglePostReactionByUsername,
      ).toHaveBeenCalledWith(`${postMockData._id}`, postMockData.username);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Reaction by username retrieved successfully',
        reaction: reactionData,
        count: 1,
      });
    });

    it('should send correct json response if reactions list is empty', async () => {
      const req: Request = reactionMockRequest({}, {}, authUserPayload, {
        postId: `${postMockData._id}`,
        username: postMockData.username,
      }) as Request;
      const res: Response = reactionMockResponse();
      jest
        .spyOn(ReactionCache.prototype, 'getSingleReactionByUsernameFromCache')
        .mockResolvedValue([]);
      jest
        .spyOn(reactionService, 'getSinglePostReactionByUsername')
        .mockResolvedValue([]);

      await GetReactionsController.prototype.getSingleReactionByUsername(
        req,
        res,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Reaction by username retrieved successfully',
        reaction: {},
        count: 0,
      });
    });
  });

  describe('reactionsByUsername', () => {
    it('should send correct json response if reactions exist in database', async () => {
      const req: Request = reactionMockRequest({}, {}, authUserPayload, {
        username: postMockData.username,
      }) as Request;
      const res: Response = reactionMockResponse();
      jest
        .spyOn(reactionService, 'getReactionsByUsername')
        .mockResolvedValue([reactionData]);

      await GetReactionsController.prototype.getReactionsByUsername(req, res);
      expect(reactionService.getReactionsByUsername).toHaveBeenCalledWith(
        postMockData.username,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Reactions by username retrieved successfully',
        reactions: [reactionData],
      });
    });

    it('should send correct json response if reactions list is empty', async () => {
      const req: Request = reactionMockRequest({}, {}, authUserPayload, {
        username: postMockData.username,
      }) as Request;
      const res: Response = reactionMockResponse();
      jest
        .spyOn(reactionService, 'getReactionsByUsername')
        .mockResolvedValue([]);

      await GetReactionsController.prototype.getReactionsByUsername(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Reactions by username retrieved successfully',
        reactions: [],
      });
    });
  });
});
