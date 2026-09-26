import Joi from 'joi';
import { ResponseUtil } from '../../utils/response.js';

export const AnnouncementValidation = {
  createUpdateSchema: Joi.object({
    message: Joi.string().min(1).max(120).required(),
    icon: Joi.string().allow(null, '').optional(),
    type: Joi.string().lowercase().valid(
      'competition_announcement', 'winner_announcement', 'important_notice',
      'competition_reminder', 'new_feature', 'event_announcement', 'promotion',
      'website_update', 'community_news', 'general_announcement'
    ).required(),
    link: Joi.object({
      url: Joi.string().uri().required(),
      buttonName: Joi.string().required()
    }).allow(null).optional(),
    startDate: Joi.date().iso().required(),
    startTime: Joi.string().required(),
    noEndDate: Joi.boolean().default(false),
    endDate: Joi.when('noEndDate', {
      is: true,
      then: Joi.any().valid(null).optional(),
      otherwise: Joi.date().iso().required()
    }),
    endTime: Joi.when('noEndDate', {
      is: true,
      then: Joi.any().valid(null).optional(),
      otherwise: Joi.string().required()
    }),
    activeState: Joi.string().lowercase().valid('active', 'inactive').required(),
    priority: Joi.string().lowercase().valid('low', 'medium', 'high').required()
  }),

  validate: (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return ResponseUtil.error(res, 'Validation error', 400, error.details.map(e => e.message));
    }
    
    // Explicit custom logic for link
    if (value.link !== null && value.link !== undefined) {
      if (!value.link.url || !value.link.buttonName) {
        return ResponseUtil.error(res, 'Validation error', 400, ['Link must contain both url and buttonName, or be null.']);
      }
    }

    req.body = value;
    next();
  }
};
