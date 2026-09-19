import Joi from 'joi';
import { ResponseUtil } from '../../utils/response.js';

export class BusinessValidation {
  static createSchema = Joi.object({
    categoryId: Joi.string().uuid().optional(),
    subcategoryId: Joi.string().uuid().optional(),
    kind: Joi.string().valid('TWELVE', 'SIX', 'SINGLE').default('TWELVE'),
    theme: Joi.string().valid('RED', 'BLUE').optional(),
    zodiacSign: Joi.string().optional(),
    zodiacSigns: Joi.any().optional(),
    title: Joi.any().required(),
    story: Joi.any().optional(),
    isAiGenerated: Joi.boolean().default(false),
    copyrightConfirmed: Joi.boolean().default(false)
  });

  static validate(schema) {
    return (req, res, next) => {
      // Parse stringified booleans
      if (typeof req.body.isAiGenerated === 'string') {
        req.body.isAiGenerated = req.body.isAiGenerated === 'true';
      }
      if (typeof req.body.copyrightConfirmed === 'string') {
        req.body.copyrightConfirmed = req.body.copyrightConfirmed === 'true';
      }

      const { error, value } = schema.validate(req.body, { abortEarly: false });
      
      if (error) {
        const errors = error.details.map((detail) => detail.message);
        return ResponseUtil.error(res, 'Validation failed', 400, errors);
      }
      
      req.validatedBody = value;
      next();
    };
  }
}
