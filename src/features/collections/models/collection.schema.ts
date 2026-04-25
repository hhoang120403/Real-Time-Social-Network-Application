import { ICollectionDocument } from '@collections/interfaces/collection.interface';
import { model, Model, Schema } from 'mongoose';

const collectionSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  name: { type: String, default: '' },
  posts: [{ type: Schema.Types.ObjectId, ref: 'Post' }],
  createdAt: { type: Date, default: Date.now }
});

const CollectionModel: Model<ICollectionDocument> = model<ICollectionDocument>('Collection', collectionSchema, 'Collection');

export { CollectionModel };
