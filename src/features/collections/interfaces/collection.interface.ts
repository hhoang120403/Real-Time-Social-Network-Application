import { Document } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface ICollectionDocument extends Document {
  _id: ObjectId;
  userId: string | ObjectId;
  name: string;
  posts: string[] | ObjectId[];
  createdAt?: Date;
}

export interface ICollectionCreatePayload {
  name: string;
  postId?: string;
}
