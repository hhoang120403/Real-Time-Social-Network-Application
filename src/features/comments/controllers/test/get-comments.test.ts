import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { authUserPayload } from '@root/mocks/auth.mock';
import {
  commentNames,
  commentsData,
  reactionMockRequest,
  reactionMockResponse,
} from '@root/mocks/reactions.mock';
import { CommentCache } from '@service/redis/comment.cache';
import { GetCommentController } from '@comment/controllers/get-comments';
import { commentService } from '@service/db/comment.service';

jest.useFakeTimers();
jest.mock('@service/queues/base.queue');
jest.mock('@service/redis/comment.cache');

describe('Get', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('comments', () => {
    it('should send correct json response if comments exist in cache', async () => {
      const req: Request = reactionMockRequest({}, {}, authUserPayload, {
        postId: '6027f77087c9d9ccb1555268',
      }) as Request;
      const res: Response = reactionMockResponse();
      jest
        .spyOn(CommentCache.prototype, 'getCommentsFromCache')
        .mockResolvedValue([commentsData]);

      await GetCommentController.prototype.getComments(req, res);
      expect(CommentCache.prototype.getCommentsFromCache).toHaveBeenCalledWith(
        '6027f77087c9d9ccb1555268',
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Comments retrieved successfully',
        comments: [commentsData],
      });
    });

    it('should send correct json response if comments exist in database', async () => {
      const req: Request = reactionMockRequest({}, {}, authUserPayload, {
        postId: '6027f77087c9d9ccb1555268',
      }) as Request;
      const res: Response = reactionMockResponse();
      jest
        .spyOn(CommentCache.prototype, 'getCommentsFromCache')
        .mockResolvedValue([]);
      jest
        .spyOn(commentService, 'getPostCommentsFromDB')
        .mockResolvedValue([commentsData]);

      await GetCommentController.prototype.getComments(req, res);
      expect(commentService.getPostCommentsFromDB).toHaveBeenCalledWith(
        { postId: new mongoose.Types.ObjectId('6027f77087c9d9ccb1555268') },
        { createdAt: -1 },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Comments retrieved successfully',
        comments: [commentsData],
      });
    });
  });

  describe('commentsNamesFromCache', () => {
    it('should send correct json response if data exist in redis', async () => {
      const req: Request = reactionMockRequest({}, {}, authUserPayload, {
        postId: '6027f77087c9d9ccb1555268',
      }) as Request;
      const res: Response = reactionMockResponse();
      jest
        .spyOn(CommentCache.prototype, 'getCommentsNamesFromCache')
        .mockResolvedValue([commentNames]);

      await GetCommentController.prototype.getCommentsNames(req, res);
      expect(
        CommentCache.prototype.getCommentsNamesFromCache,
      ).toHaveBeenCalledWith('6027f77087c9d9ccb1555268');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Comments names retrieved successfully',
        comments: [commentNames],
      });
    });

    it('should send correct json response if data exist in database', async () => {
      const req: Request = reactionMockRequest({}, {}, authUserPayload, {
        postId: '6027f77087c9d9ccb1555268',
      }) as Request;
      const res: Response = reactionMockResponse();
      jest
        .spyOn(CommentCache.prototype, 'getCommentsNamesFromCache')
        .mockResolvedValue([]);
      jest
        .spyOn(commentService, 'getPostCommentNames')
        .mockResolvedValue([commentNames]);

      await GetCommentController.prototype.getCommentsNames(req, res);
      expect(commentService.getPostCommentNames).toHaveBeenCalledWith(
        { postId: new mongoose.Types.ObjectId('6027f77087c9d9ccb1555268') },
        { createdAt: -1 },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Comments names retrieved successfully',
        comments: [commentNames],
      });
    });

    it('should return empty comments if data does not exist in redis and database', async () => {
      const req: Request = reactionMockRequest({}, {}, authUserPayload, {
        postId: '6027f77087c9d9ccb1555268',
      }) as Request;
      const res: Response = reactionMockResponse();
      jest
        .spyOn(CommentCache.prototype, 'getCommentsNamesFromCache')
        .mockResolvedValue([]);
      jest.spyOn(commentService, 'getPostCommentNames').mockResolvedValue([]);

      await GetCommentController.prototype.getCommentsNames(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Comments names retrieved successfully',
        comments: [],
      });
    });
  });

  describe('singleComment', () => {
    it('should send correct json response from cache', async () => {
      const req: Request = reactionMockRequest({}, {}, authUserPayload, {
        commentId: '6064861bc25eaa5a5d2f9bf4',
        postId: '6027f77087c9d9ccb1555268',
      }) as Request;
      const res: Response = reactionMockResponse();
      jest
        .spyOn(CommentCache.prototype, 'getSingleCommentFromCache')
        .mockResolvedValue([commentsData]);

      await GetCommentController.prototype.getSingleComment(req, res);
      expect(
        CommentCache.prototype.getSingleCommentFromCache,
      ).toHaveBeenCalledWith(
        '6027f77087c9d9ccb1555268',
        '6064861bc25eaa5a5d2f9bf4',
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Single comment retrieved successfully',
        comments: commentsData,
      });
    });

    it('should send correct json response from database', async () => {
      const req: Request = reactionMockRequest({}, {}, authUserPayload, {
        commentId: '6064861bc25eaa5a5d2f9bf4',
        postId: '6027f77087c9d9ccb1555268',
      }) as Request;
      const res: Response = reactionMockResponse();
      jest
        .spyOn(CommentCache.prototype, 'getSingleCommentFromCache')
        .mockResolvedValue([]);
      jest
        .spyOn(commentService, 'getPostCommentsFromDB')
        .mockResolvedValue([commentsData]);

      await GetCommentController.prototype.getSingleComment(req, res);
      expect(commentService.getPostCommentsFromDB).toHaveBeenCalledWith(
        { _id: new mongoose.Types.ObjectId('6064861bc25eaa5a5d2f9bf4') },
        { createdAt: -1 },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Single comment retrieved successfully',
        comments: commentsData,
      });
    });
  });
});
