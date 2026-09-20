import Joi from 'joi';

export const CommentValidation = {
  bulkStatusSchema: Joi.object({
    commentIds: Joi.array().items(Joi.string()).min(1).required().messages({
      'array.min': 'At least one comment ID must be provided',
      'any.required': 'Comment IDs are required'
    }),
    status: Joi.string().valid('APPROVED', 'HIDDEN', 'DELETED', 'PENDING').required().messages({
      'any.only': 'Status must be APPROVED, HIDDEN, DELETED, or PENDING',
      'any.required': 'Status is required'
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
