import Joi from 'joi';
import { ResponseUtil } from '../../utils/response.js';

export const ArtworkValidation = {
  createSchema: Joi.object({
    kind: Joi.string().valid('SINGLE', 'SIX', 'TWELVE').required(),
    theme: Joi.string().valid('RED', 'BLUE', 'FULL').optional().allow(null, ''),
    zodiacSign: Joi.string().valid('ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO', 'LIBRA', 'SCORPIO', 'SAGITTARIUS', 'CAPRICORN', 'AQUARIUS', 'PISCES').optional().allow(null, ''),
    visibility: Joi.string().valid('PUBLIC', 'PRIVATE_BUSINESS').optional().allow(null, ''),
    competitionState: Joi.string().valid('PROFILE_ONLY', 'IN_COMPETITION', 'ENDED').optional().allow(null, ''),
    categoryId: Joi.string().uuid().optional().allow(null, ''),
    subcategoryId: Joi.string().uuid().optional().allow(null, ''),
    title: Joi.any().required().messages({ 'any.required': 'Title is required' }),
    story: Joi.any().optional().allow(null, ''),
    tags: Joi.any().optional().allow(null, ''),
    camera: Joi.string().optional().allow(null, ''),
    resolution: Joi.string().optional().allow(null, ''),
    format: Joi.string().optional().allow(null, ''),
    isAiGenerated: Joi.any().optional(),
    copyrightConfirmed: Joi.any().optional(),
    quality: Joi.string().optional().allow(null, ''),
    images: Joi.any().required().messages({ 'any.required': 'At least one image is required' }),
    video: Joi.any().optional().allow(null, ''),
  }),

  updateSchema: Joi.object({
    title: Joi.any().optional(),
    story: Joi.any().optional().allow(null, ''),
    tags: Joi.any().optional().allow(null, ''),
    camera: Joi.string().optional().allow(null, ''),
    resolution: Joi.string().optional().allow(null, ''),
    quality: Joi.string().optional().allow(null, ''),
  }),

  promoteSchema: Joi.object({
    durationDays: Joi.number().valid(7, 15, 30).required(),
  }),

  switchCompetitionSchema: Joi.object({
    // competitionId is intentionally omitted as the backend will auto-resolve the OPEN competition
  }),

  resubmitSchema: Joi.object({
    // newCompetitionId is intentionally omitted as backend auto-resolves OPEN competition
  }),

  validate: (schema) => {
    return (req, res, next) => {
      const payload = { ...req.body };
      
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
