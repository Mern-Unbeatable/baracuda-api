import Joi from 'joi';

export const basePhotoSchema = Joi.object({
  kind: Joi.string().valid('SINGLE', 'SIX', 'TWELVE').required(),
  theme: Joi.when('kind', {
    is: 'SIX',
    then: Joi.string().valid('RED', 'BLUE').required().messages({
      'any.only': 'For SIX photos, theme must be RED or BLUE',
      'any.required': 'Theme is required for SIX photos'
    }),
    otherwise: Joi.when('kind', {
      is: 'TWELVE',
      then: Joi.string().valid('FULL').required().messages({
        'any.only': 'For TWELVE photos, theme must be FULL',
        'any.required': 'Theme is required for TWELVE photos'
      }),
      otherwise: Joi.string().valid(null, '').optional()
    })
  }),
  zodiacSign: Joi.when('kind', {
    is: 'SINGLE',
    then: Joi.string().valid('ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO', 'LIBRA', 'SCORPIO', 'SAGITTARIUS', 'CAPRICORN', 'AQUARIUS', 'PISCES').optional().allow(null, ''),
    otherwise: Joi.string().valid(null, '').optional()
  }),
  zodiacSigns: Joi.any().optional(), // Allow array/JSON of signs for TWELVE and SIX
  categoryId: Joi.string().uuid().optional().allow(null, ''),
  title: Joi.any().required().messages({ 'any.required': 'Title is required' }),
  story: Joi.any().optional().allow(null, ''),
  camera: Joi.string().optional().allow(null, ''),
  resolution: Joi.string().optional().allow(null, ''),
  format: Joi.string().optional().allow(null, ''),
  images: Joi.any().optional().messages({ 'any.required': 'At least one image is required' }),
  video: Joi.any().optional().allow(null, ''),
});
