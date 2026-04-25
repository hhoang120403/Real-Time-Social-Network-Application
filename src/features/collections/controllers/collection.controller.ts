import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { CollectionModel } from '@collections/models/collection.schema';
import { ICollectionDocument } from '@collections/interfaces/collection.interface';
import { ObjectId } from 'mongodb';

export class CollectionController {
  public async create(req: Request, res: Response): Promise<void> {
    const { name, postId } = req.body;
    const collection: ICollectionDocument = new CollectionModel({
      userId: req.currentUser!.userId,
      name,
      posts: postId ? [new ObjectId(postId)] : []
    }) as ICollectionDocument;
    await collection.save();
    res.status(HTTP_STATUS.CREATED).json({ message: 'Collection created successfully', collection });
  }

  public async updatePostCollections(req: Request, res: Response): Promise<void> {
    const { postId, collectionIds } = req.body;
    
    // Get all collections of user
    const userCollections = await CollectionModel.find({ userId: req.currentUser!.userId });
    
    for (const collection of userCollections) {
      const isSelected = collectionIds.includes(collection._id.toString());
      if (isSelected) {
        // Add post to collection if not already there
        await CollectionModel.updateOne(
          { _id: collection._id },
          { $addToSet: { posts: new ObjectId(postId) } }
        );
      } else {
        // Remove post from collection if it was there
        await CollectionModel.updateOne(
          { _id: collection._id },
          { $pull: { posts: new ObjectId(postId) } }
        );
      }
    }

    res.status(HTTP_STATUS.OK).json({ message: 'Post collections updated successfully' });
  }

  public async getCollections(req: Request, res: Response): Promise<void> {
    const collections = await CollectionModel.find({ userId: req.currentUser!.userId }).sort({ createdAt: -1 });
    res.status(HTTP_STATUS.OK).json({ message: 'User collections', collections });
  }

  public async getCollectionPosts(req: Request, res: Response): Promise<void> {
    const { collectionId } = req.params;
    const collection = await CollectionModel.findOne({ _id: collectionId, userId: req.currentUser!.userId }).populate('posts');
    res.status(HTTP_STATUS.OK).json({ message: 'Collection posts', collection });
  }

  public async deleteCollection(req: Request, res: Response): Promise<void> {
    const { collectionId } = req.params;
    await CollectionModel.deleteOne({ _id: collectionId, userId: req.currentUser!.userId });
    res.status(HTTP_STATUS.OK).json({ message: 'Collection deleted successfully' });
  }
}
