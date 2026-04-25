import Joi, { ObjectSchema } from 'joi';

const addChatSchema: ObjectSchema = Joi.object().keys({
  conversationId: Joi.string().optional().allow(null, ''),
  receiverId: Joi.string().required(),
  receiverUsername: Joi.string().required(),
  receiverAvatarColor: Joi.string().required(),
  receiverProfilePicture: Joi.string().optional().allow(null, ''),
  body: Joi.string().optional().allow(null, ''),
  gifUrl: Joi.string().optional().allow(null, ''),
  selectedImage: Joi.string().optional().allow(null, ''),
  isRead: Joi.boolean().optional()
});

const markChatSchema: ObjectSchema = Joi.object().keys({
  senderId: Joi.string().required(),
  receiverId: Joi.string().required()
});

const editChatSchema: ObjectSchema = Joi.object().keys({
  senderId: Joi.string().required(),
  receiverId: Joi.string().required(),
  messageId: Joi.string().required(),
  body: Joi.string().required().allow(''),
  gifUrl: Joi.string().optional().allow(null, ''),
  selectedImage: Joi.string().optional().allow(null, '')
});

export { addChatSchema, markChatSchema, editChatSchema };
