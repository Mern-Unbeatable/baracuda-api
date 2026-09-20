import Joi from 'joi';

export const SupportValidation = {
  createSchema: Joi.object({
    name: Joi.string().required().messages({
      'any.required': 'Full name is required',
      'string.empty': 'Full name cannot be empty'
    }),
    email: Joi.string().email().required().messages({
      'any.required': 'Email is required',
      'string.email': 'Invalid email format'
    }),
    subject: Joi.string().required().messages({
      'any.required': 'Subject is required',
      'string.empty': 'Subject cannot be empty'
    }),
    message: Joi.string().required().messages({
      'any.required': 'Message is required',
      'string.empty': 'Message cannot be empty'
    })
  }),

  replySchema: Joi.object({
    answer: Joi.string().required().messages({
      'any.required': 'Answer is required',
      'string.empty': 'Answer cannot be empty'
    })
  }),

  validate: (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(err => err.message)
      });
    }
    req.body = value;
    next();
  }
};
