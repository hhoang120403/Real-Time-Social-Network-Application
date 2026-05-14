/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { CollectionModel } from '@collections/models/collection.schema';
import { ICollectionDocument } from '@collections/interfaces/collection.interface';
import { ObjectId } from 'mongodb';
import { PostModel } from '@post/models/post.schema';
import { PostCache } from '@service/redis/post.cache';
import { socketIOPostObject } from '@socket/post';

export class CollectionController {
  public async create(req: Request, res: Response): Promise<void> {
    const { name, postId } = req.body;
    const collection: ICollectionDocument = new CollectionModel({
      userId: req.currentUser!.userId,
      name,
      posts: postId ? [new ObjectId(postId)] : [],
    }) as ICollectionDocument;
    await collection.save();

    if (postId) {
      const userCollections = await CollectionModel.find({
        userId: req.currentUser!.userId,
      });
      const hadBefore = userCollections
        .filter((c) => c._id.toString() !== collection._id.toString())
        .some((c) => c.posts.some((p) => p.toString() === postId));

      if (!hadBefore) {
        const post = await PostModel.findOneAndUpdate(
          { _id: postId },
          { $inc: { savesCount: 1 } },
          { new: true },
        ).lean();

        if (post) {
          const postCache = new PostCache();
          await postCache.updatePostInCache(postId, post as any);
          socketIOPostObject.emit('update post', post);
        }
      }

      const currentPost = await PostModel.findById(postId).lean();
      res
        .status(HTTP_STATUS.CREATED)
        .json({ message: 'Collection created successfully', collection, post: currentPost });
      return;
    }

    res
      .status(HTTP_STATUS.CREATED)
      .json({ message: 'Collection created successfully', collection });
  }

  public async updatePostCollections(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { postId, collectionIds } = req.body;

    const userCollections = await CollectionModel.find({
      userId: req.currentUser!.userId,
    });

    for (const collection of userCollections) {
      const isSelected = collectionIds.includes(collection._id.toString());
      if (isSelected) {
        await CollectionModel.updateOne(
          { _id: collection._id },
          { $addToSet: { posts: new ObjectId(postId) } },
        );
      } else {
        await CollectionModel.updateOne(
          { _id: collection._id },
          { $pull: { posts: new ObjectId(postId) } },
        );
      }
    }

    const hadBefore = userCollections.some((c) =>
      c.posts.some((p) => p.toString() === postId),
    );
    const hasAfter = collectionIds.length > 0;

    if (hadBefore !== hasAfter) {
      const incValue = hasAfter ? 1 : -1;
      const post = await PostModel.findOneAndUpdate(
        { _id: postId },
        { $inc: { savesCount: incValue } },
        { new: true },
      ).lean();

      if (post) {
        const postCache = new PostCache();
        await postCache.updatePostInCache(postId, post as any);
        socketIOPostObject.emit('update post', post);
      }
    }

    const currentPost = await PostModel.findById(postId).lean();
    res
      .status(HTTP_STATUS.OK)
      .json({ message: 'Post collections updated successfully', post: currentPost });
  }

  public async getCollections(req: Request, res: Response): Promise<void> {
    const collections = await CollectionModel.find({
      userId: req.currentUser!.userId,
    }).sort({ createdAt: -1 });
    res
      .status(HTTP_STATUS.OK)
      .json({ message: 'User collections', collections });
  }

  public async getCollectionPosts(req: Request, res: Response): Promise<void> {
    const { collectionId } = req.params;
    const collection = await CollectionModel.findOne({
      _id: collectionId,
      userId: req.currentUser!.userId,
    }).populate('posts');
    res
      .status(HTTP_STATUS.OK)
      .json({ message: 'Collection posts', collection });
  }

  public async deleteCollection(req: Request, res: Response): Promise<void> {
    const { collectionId } = req.params;
    await CollectionModel.deleteOne({
      _id: collectionId,
      userId: req.currentUser!.userId,
    });
    res
      .status(HTTP_STATUS.OK)
      .json({ message: 'Collection deleted successfully' });
  }
}
