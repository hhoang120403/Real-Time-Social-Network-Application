import Joi, { ObjectSchema } from 'joi';

const loginSchema: ObjectSchema = Joi.object().keys({
  username: Joi.string().required().min(4).max(8).messages({
    'string.base': 'Username must be of type string',
    'string.min': 'Username must be at least 4 characters long',
    'string.max': 'Username must be at most 8 characters long',
    'string.empty': 'Username is a required field',
  }),
  password: Joi.string().required().min(4).max(12).messages({
    'string.base': 'Password must be of type string',
    'string.min': 'Password must be at least 4 characters long',
    'string.max': 'Password must be at most 12 characters long',
    'string.empty': 'Password is a required field',
  }),
});

export { loginSchema };
