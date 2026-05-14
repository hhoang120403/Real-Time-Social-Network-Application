import Joi, { ObjectSchema } from 'joi';

const addCommentSchema: ObjectSchema = Joi.object().keys({
  userTo: Joi.string().required().messages({
    'any.required': 'userTo is a required property'
  }),
  postId: Joi.string().required().messages({
    'any.required': 'postId is a required property'
  }),
  comment: Joi.string().optional().allow(null, '').messages({
    'any.required': 'comment is a required property'
  }),
  image: Joi.string().optional().allow(null, ''),
  gifUrl: Joi.string().optional().allow(null, ''),
  profilePicture: Joi.string().optional().allow(null, ''),
  commentsCount: Joi.number().optional().allow(null, '')
});

const addCommentReactionSchema: ObjectSchema = Joi.object().keys({
  postId: Joi.string().required().messages({
    'any.required': 'postId is a required property'
  }),
  commentId: Joi.string().required().messages({
    'any.required': 'commentId is a required property'
  }),
  type: Joi.string().required().messages({
    'any.required': 'Reaction type is a required property'
  }),
  profilePicture: Joi.string().optional().allow(null, ''),
  previousReaction: Joi.string().optional().allow(null, '')
});

const addCommentReplySchema: ObjectSchema = Joi.object().keys({
  postId: Joi.string().required().messages({
    'any.required': 'postId is a required property'
  }),
  commentId: Joi.string().required().messages({
    'any.required': 'commentId is a required property'
  }),
  comment: Joi.string().optional().allow(null, '').messages({
    'any.required': 'comment is a required property'
  }),
  profilePicture: Joi.string().optional().allow(null, ''),
  image: Joi.string().optional().allow(null, ''),
  gifUrl: Joi.string().optional().allow(null, '')
});

const addCommentReplyReactionSchema: ObjectSchema = Joi.object().keys({
  postId: Joi.string().required().messages({
    'any.required': 'postId is a required property'
  }),
  commentId: Joi.string().required().messages({
    'any.required': 'commentId is a required property'
  }),
  replyId: Joi.string().required().messages({
    'any.required': 'replyId is a required property'
  }),
  type: Joi.string().required().messages({
    'any.required': 'Reaction type is a required property'
  }),
  profilePicture: Joi.string().optional().allow(null, ''),
  previousReaction: Joi.string().optional().allow(null, '')
});

const editCommentSchema: ObjectSchema = Joi.object().keys({
  comment: Joi.string().required().messages({
    'any.required': 'comment is a required property'
  })
});

const editCommentReplySchema: ObjectSchema = Joi.object().keys({
  postId: Joi.string().optional().allow(null, ''),
  commentId: Joi.string().optional().allow(null, ''),
  replyId: Joi.string().optional().allow(null, ''),
  comment: Joi.string().required().messages({
    'any.required': 'comment is a required property'
  })
});

export {
  addCommentSchema,
  addCommentReactionSchema,
  addCommentReplySchema,
  addCommentReplyReactionSchema,
  editCommentSchema,
  editCommentReplySchema
};
