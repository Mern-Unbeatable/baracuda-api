import Joi from 'joi';

export class OrderValidation {
  static updateStatusSchema = Joi.object({
    status: Joi.string().valid(
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED'
    ).required()
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
