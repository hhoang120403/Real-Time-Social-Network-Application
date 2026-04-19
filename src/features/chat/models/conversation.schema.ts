import { IConversationDocument } from '@chat/interfaces/conversation.interface';
import { Model, Schema, model } from 'mongoose';

const conversationSchema: Schema = new Schema({
  senderId: { type: Schema.Types.ObjectId, ref: 'User' },
  receiverId: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedFor: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  deletedAtFor: [
    {
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      deletedAt: { type: Date },
    },
  ],
});

const ConversationModel: Model<IConversationDocument> =
  model<IConversationDocument>(
    'Conversation',
    conversationSchema,
    'Conversation',
  );

export { ConversationModel };
