import Joi from 'joi';

export const DemoProfileValidation = {
  createSchema: Joi.object({
    fullName: Joi.string().required(),
    username: Joi.string().required(),
    phone: Joi.string().required(),
    email: Joi.string().email().required(),
    bio: Joi.string().allow('', null).optional(),
    socialLinks: Joi.array().items(Joi.string()).optional(),
    profilePhoto: Joi.string().allow('', null).optional(),
    coverPhoto: Joi.string().allow('', null).optional(),
    password: Joi.string().required(),
    isActive: Joi.boolean().default(true)
  }),

  statusUpdateSchema: Joi.object({
    isActive: Joi.boolean().required()
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
