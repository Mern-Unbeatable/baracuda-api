import Joi from 'joi';
import { ResponseUtil } from '../../utils/response.js';
import { basePhotoSchema } from '../../validators/photo.validator.js';

export const ArtworkValidation = {
  createSchema: basePhotoSchema.keys({
    visibility: Joi.string().valid('PUBLIC', 'PRIVATE_BUSINESS').optional().allow(null, ''),
    competitionState: Joi.string().valid('PROFILE_ONLY', 'IN_COMPETITION', 'ENDED').optional().allow(null, ''),
    subcategoryId: Joi.string().uuid().optional().allow(null, ''),
    tags: Joi.any().optional().allow(null, ''),
    isAiGenerated: Joi.any().optional(),
    copyrightConfirmed: Joi.any().optional(),
    quality: Joi.string().optional().allow(null, ''),
  }),

  createVideoCommentSchema: Joi.object({
    title: Joi.string().required().min(1).max(255),
    story: Joi.string().optional().allow(null, '').max(2000),
    isAiGenerated: Joi.any().optional(),
    visibility: Joi.string().valid('PUBLIC', 'PRIVATE_BUSINESS').optional().allow(null, ''),
    categoryId: Joi.string().uuid().optional().allow(null, ''),
    subcategoryId: Joi.string().uuid().optional().allow(null, '')
  }),

  updateSchema: Joi.object({
    title: Joi.string().optional(),
    story: Joi.string().optional().allow(null, ''),
    tags: Joi.any().optional().allow(null, ''),
    camera: Joi.string().optional().allow(null, ''),
    resolution: Joi.string().optional().allow(null, ''),
    quality: Joi.string().optional().allow(null, ''),
  }),

  promoteSchema: Joi.object({
    durationDays: Joi.number().valid(7, 15, 30).optional(),
    duration_days: Joi.number().valid(7, 15, 30).optional(),
  }).or('durationDays', 'duration_days'),

  switchCompetitionSchema: Joi.object({
    // competitionId is intentionally omitted as the backend will auto-resolve the OPEN competition
  }),

  resubmitSchema: Joi.object({
    // newCompetitionId is intentionally omitted as backend auto-resolves OPEN competition
  }),

  commentSchema: Joi.object({
    body: Joi.string().required().min(1).max(2000),
    parentId: Joi.string().uuid().optional().allow(null, '')
  }),

  reportSchema: Joi.object({
    reason: Joi.string().valid(
      'Copyright Infringement',
      'Illegal or Prohibited Content',
      'Harmful or Dangerous Content',
      'Offensive or Abusive Content',
      'Nudity or Sexual Content',
      'Spam or Misleading Content',
      'Stolen Photo',
      'Child Privacy / COPPA Violation',
      'Other'
    ).required().messages({
      'any.only': 'Invalid report reason. Allowed reasons are: {#valids}'
    }),
    details: Joi.string().optional().allow(null, '').max(500)
  }),

  validate: (schema) => {
    return (req, res, next) => {
      let payload = { ...req.query, ...req.body };
      
      if (typeof req.body === 'string') {
        try {
          payload = { ...payload, ...JSON.parse(req.body) };
        } catch (e) {}
      }
      
      // Handle files differently since they come as arrays for images
      if (req.files) {
        if (req.files['images'] && req.files['images'].length > 0) {
          payload.images = req.files['images'];
        }
        if (req.files['video'] && req.files['video'].length > 0) {
          payload.video = req.files['video'][0];
        }
      }

      const { error, value } = schema.validate(payload, { abortEarly: false, allowUnknown: true });
      if (error) {
        return ResponseUtil.error(res, 'Validation error', 400, error.details.map(x => x.message));
      }
      
      const validatedBody = { ...value };
      delete validatedBody.images;
      delete validatedBody.video;
      
      req.validatedBody = validatedBody;
      next();
    };
  }
};
