import Joi from 'joi';

export class StoreValidation {
  static createSchema = Joi.object({
    title: Joi.string().required(),
    category: Joi.string().valid(
      'ART_PRINTS',
      'HANDMADE_CRAFTS',
      'APPAREL',
      'PHOTOBOOKS',
      'DIGITAL_PRESET',
      'OTHERS'
    ).required(),
    price: Joi.number().min(0).required(),
    setEditionSize: Joi.string().required(),
    description: Joi.string().required(),
    copyrightConfirmed: Joi.boolean().truthy('1', 1, 'true').falsy('0', 0, 'false').default(false)
  });

  static updateSchema = Joi.object({
    title: Joi.string().optional(),
    category: Joi.string().valid(
      'ART_PRINTS',
      'HANDMADE_CRAFTS',
      'APPAREL',
      'PHOTOBOOKS',
      'DIGITAL_PRESET',
      'OTHERS'
    ).optional(),
    price: Joi.number().min(0).optional(),
    setEditionSize: Joi.string().allow('', null).optional(),
    description: Joi.string().allow('', null).optional(),
    isActive: Joi.boolean().truthy('1', 1, 'true').falsy('0', 0, 'false').optional(),
    copyrightConfirmed: Joi.boolean().truthy('1', 1, 'true').falsy('0', 0, 'false').optional()
  });

  static promoteSchema = Joi.object({
    durationDays: Joi.number().valid(7, 15, 30).required()
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
