import { IConversationDocument } from '@chat/interfaces/conversation.interface';
import { Model, Schema, model } from 'mongoose';

const conversationSchema: Schema = new Schema({
  senderId: { type: Schema.Types.ObjectId, ref: 'User' },
  receiverId: { type: Schema.Types.ObjectId, ref: 'User' },
});

const ConversationModel: Model<IConversationDocument> =
  model<IConversationDocument>(
    'Conversation',
    conversationSchema,
    'Conversation',
  );

export { ConversationModel };
