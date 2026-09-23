import Joi from 'joi';
import { ResponseUtil } from '../../utils/response.js';

export class AdminReportValidation {
  static statusSchema = Joi.object({
    status: Joi.string().valid('PENDING', 'UNDER_REVIEW', 'RESOLVED').required()
  });

  static actionSchema = Joi.object({
    action: Joi.string().valid('CONTENT_REMOVED', 'WARN', 'SUSPEND', 'BAN', 'MARK_RESOLVED').required()
  });

  static validate(schema) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.body, { abortEarly: false, allowUnknown: true });
      if (error) {
        return ResponseUtil.error(res, 'Validation error', 400, error.details.map(x => x.message));
      }
      req.validatedBody = value;
      next();
    };
  }
}
