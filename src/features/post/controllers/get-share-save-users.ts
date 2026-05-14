import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { PostModel } from '@post/models/post.schema';
import { CollectionModel } from '@collections/models/collection.schema';
import { UserModel } from '@user/models/user.schema';
import mongoose from 'mongoose';

export class GetShareAndSaveUsersController {
  public async shares(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;

    // Find all posts that share this post
    // Try both ObjectId and string because sharedPost is a Mixed field
    const posts = await PostModel.find({
      $or: [
        { 'sharedPost._id': new mongoose.Types.ObjectId(postId as string) },
        { 'sharedPost._id': postId as string },
      ],
    }).select('userId createdAt');

    // Extract unique userIds and convert to ObjectIds for aggregation
    const uniqueUserIds = [
      ...new Set(posts.map((p) => p.userId.toString())),
    ].map((id) => new mongoose.Types.ObjectId(id));

    // Get unique user details using aggregation to join with Auth
    const users = await UserModel.aggregate([
      { $match: { _id: { $in: uniqueUserIds } } },
      {
        $lookup: {
          from: 'Auth',
          localField: 'authId',
          foreignField: '_id',
          as: 'authId',
        },
      },
      { $unwind: '$authId' },
      {
        $project: {
          _id: 1,
          username: '$authId.username',
          avatarColor: '$authId.avatarColor',
          profilePicture: 1,
        },
      },
    ]);

    res.status(HTTP_STATUS.OK).json({
      message: 'Post shares retrieved successfully',
      users,
    });
  }

  public async saves(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;

    // Find all collections that contain this post
    const collections = await CollectionModel.find({
      posts: {
        $in: [new mongoose.Types.ObjectId(postId as string), postId as string],
      },
    }).select('userId');

    const uniqueUserIds = [
      ...new Set(collections.map((c) => c.userId.toString())),
    ].map((id) => new mongoose.Types.ObjectId(id));

    // Get user details using aggregation to join with Auth
    const users = await UserModel.aggregate([
      { $match: { _id: { $in: uniqueUserIds } } },
      {
        $lookup: {
          from: 'Auth',
          localField: 'authId',
          foreignField: '_id',
          as: 'authId',
        },
      },
      { $unwind: '$authId' },
      {
        $project: {
          _id: 1,
          username: '$authId.username',
          avatarColor: '$authId.avatarColor',
          profilePicture: 1,
        },
      },
    ]);

    res.status(HTTP_STATUS.OK).json({
      message: 'Post saves retrieved successfully',
      users,
    });
  }
}
