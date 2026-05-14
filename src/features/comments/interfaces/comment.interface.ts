import { ObjectId } from 'mongodb';
import { Document } from 'mongoose';
import { IReactions } from '@reaction/interfaces/reaction.interface';

export interface ICommentReaction {
  username: string;
  avatarColor: string;
  type: string;
  profilePicture: string;
  createdAt?: Date;
}

export interface ICommentReply {
  _id?: string | ObjectId;
  username: string;
  avatarColor: string;
  profilePicture: string;
  comment: string;
  image?: string;
  gifUrl?: string;
  createdAt?: Date;
  userFrom?: string | ObjectId;
  reactions?: IReactions;
  reactionList?: ICommentReaction[];
}

export interface ICommentDocument extends Document {
  username: string;
  avatarColor: string;
  postId: string;
  profilePicture: string;
  comment: string;
  image?: string;
  gifUrl?: string;
  createdAt?: Date;
  userTo?: string | ObjectId;
  userFrom?: string | ObjectId;
  reactions?: IReactions;
  reactionList?: ICommentReaction[];
  replies?: ICommentReply[];
}

export interface ICommentJob {
  postId: string;
  userTo: string;
  userFrom: string;
  username: string;
  comment: ICommentDocument;
}

export interface ICommentNameList {
  count: number;
  names: string[];
}

export interface IQueryComment {
  _id?: string | ObjectId;
  postId?: string | ObjectId;
}

export interface IQuerySort {
  createdAt?: number;
}
