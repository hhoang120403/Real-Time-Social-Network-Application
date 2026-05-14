import mongoose, { model, Model, Schema } from 'mongoose';
import { ICommentDocument } from '@comment/interfaces/comment.interface';

const commentSchema: Schema = new Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', index: true },
  comment: { type: String, default: '' },
  image: { type: String, default: '' },
  gifUrl: { type: String, default: '' },
  username: { type: String },
  avatarColor: { type: String },
  profilePicture: { type: String },
  userTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  userFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  reactions: {
    like: { type: Number, default: 0 },
    love: { type: Number, default: 0 },
    happy: { type: Number, default: 0 },
    wow: { type: Number, default: 0 },
    sad: { type: Number, default: 0 },
    angry: { type: Number, default: 0 },
  },
  reactionList: [
    {
      username: { type: String },
      avatarColor: { type: String },
      type: { type: String },
      profilePicture: { type: String },
      createdAt: { type: Date, default: Date.now() },
    },
  ],
  replies: [
    {
      username: { type: String },
      avatarColor: { type: String },
      profilePicture: { type: String },
      comment: { type: String, default: '' },
      image: { type: String, default: '' },
      gifUrl: { type: String, default: '' },
      userFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reactions: {
        like: { type: Number, default: 0 },
        love: { type: Number, default: 0 },
        happy: { type: Number, default: 0 },
        wow: { type: Number, default: 0 },
        sad: { type: Number, default: 0 },
        angry: { type: Number, default: 0 },
      },
      reactionList: [
        {
          username: { type: String },
          avatarColor: { type: String },
          type: { type: String },
          profilePicture: { type: String },
          createdAt: { type: Date, default: Date.now() },
        },
      ],
      createdAt: { type: Date, default: Date.now() },
    },
  ],
  createdAt: { type: Date, default: Date.now() },
});

const CommentsModel: Model<ICommentDocument> = model<ICommentDocument>(
  'Comment',
  commentSchema,
  'Comment',
);
export { CommentsModel };
