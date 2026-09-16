import Joi from 'joi';

export class PostValidation {
  static createSchema = Joi.object({
    body: Joi.string().required().messages({
      'string.empty': 'Post body is required',
      'any.required': 'Post body is required'
    }),
    copyrightConfirmed: Joi.boolean().truthy('1', 1, 'true').falsy('0', 0, 'false').default(false)
  });

  static updateSchema = Joi.object({
    body: Joi.string().allow('').optional(),
    copyrightConfirmed: Joi.boolean().truthy('1', 1, 'true').falsy('0', 0, 'false').optional()
  });

  static validate(schema) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.body, { abortEarly: false, allowUnknown: true });
      if (error) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: error.details.map(e => e.message).join(', ')
        });
      }
      req.body = value;
      next();
    };
  }
}
