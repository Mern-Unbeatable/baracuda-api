import Joi from 'joi';

// Common required fields for all kinds (no story, no competitionState)
const commonRequired = {
  title: Joi.any().required().messages({ 'any.required': 'Title is required' }),
  price: Joi.number().min(0.01).required().messages({
    'number.min': 'Price must be greater than 0',
    'any.required': 'Price is required'
  }),
  isAiGenerated: Joi.any().required().messages({ 'any.required': 'isAiGenerated is required' }),
  copyrightConfirmed: Joi.any().required().messages({ 'any.required': 'copyrightConfirmed is required' }),
  resolution: Joi.string().required().messages({ 'any.required': 'Resolution is required' }),
  quality: Joi.string().required().messages({ 'any.required': 'Quality is required' }),
  categoryId: Joi.string().uuid().required().messages({ 'any.required': 'categoryId is required' }),
  subcategoryId: Joi.string().uuid().required().messages({ 'any.required': 'subcategoryId is required' }),
  images: Joi.any().required().messages({ 'any.required': 'At least one image is required' }),
  // Video is optional on sell/upload forms
  video: Joi.any().optional().allow(null, ''),
  story: Joi.any().optional().allow(null, ''),
};

const singleCreateSchema = Joi.object({
  kind: Joi.string().valid('SINGLE').required(),
  zodiacSign: Joi.string()
    .valid('ARIES','TAURUS','GEMINI','CANCER','LEO','VIRGO','LIBRA','SCORPIO','SAGITTARIUS','CAPRICORN','AQUARIUS','PISCES')
    .required()
    .messages({ 'any.required': 'zodiacSign is required for SINGLE', 'any.only': 'Invalid zodiac sign' }),
  ...commonRequired
});

const sixCreateSchema = Joi.object({
  kind: Joi.string().valid('SIX').required(),
  theme: Joi.string().valid('RED', 'BLUE').required().messages({
    'any.only': 'theme must be RED or BLUE for SIX',
    'any.required': 'theme is required for SIX'
  }),
  ...commonRequired
});

const twelveCreateSchema = Joi.object({
  kind: Joi.string().valid('TWELVE').required(),
  theme: Joi.string().valid('FULL').required().messages({
    'any.only': 'theme must be FULL for TWELVE',
    'any.required': 'theme is required for TWELVE'
  }),
  zodiacSigns: Joi.any().required().messages({ 'any.required': 'zodiacSigns is required for TWELVE' }),
  ...commonRequired
});

export const MarketplaceValidation = {
  // Dynamically pick schema based on kind
  createSchema: Joi.object({
    kind: Joi.string().valid('SINGLE', 'SIX', 'TWELVE').required()
  }).unknown(true), // Pre-check kind, full validation done in validate()

  updateSchema: Joi.object({
    kind: Joi.string().valid('SINGLE', 'SIX', 'TWELVE').optional(),
    title: Joi.any().optional(),
    story: Joi.any().optional().allow(null, ''),
    resolution: Joi.string().optional().allow(null, ''),
    quality: Joi.string().optional().allow(null, ''),
    price: Joi.number().min(0.01).optional(),
    camera: Joi.string().optional().allow(null, ''),
    license: Joi.string().optional().allow(null, ''),
    isAiGenerated: Joi.any().optional(),
    copyrightConfirmed: Joi.any().optional(),
    zodiacSign: Joi.string().optional().allow(null, ''),
    theme: Joi.string().optional().allow(null, ''),
    categoryId: Joi.string().uuid().optional().allow(null, ''),
    subcategoryId: Joi.string().uuid().optional().allow(null, ''),
    images: Joi.any().optional(),
    video: Joi.any().optional().allow(null, ''),
    zodiacSigns: Joi.any().optional(),
  }),

  promoteSchema: Joi.object({
    durationDays: Joi.number().valid(7, 15, 30).required(),
  }),

  validate: (schema) => {
    return (req, res, next) => {
      const payload = { ...(req.body || {}) };

      if (req.files) {
        if (req.files['images'] && req.files['images'].length > 0) {
          payload.images = req.files['images'];
        }
        if (req.files['video'] && req.files['video'].length > 0) {
          payload.video = req.files['video'][0];
        }
      }

      // Coerce multipart string numbers for price
      if (payload.price !== undefined && payload.price !== null && payload.price !== '') {
        const parsedPrice = Number(payload.price);
        if (!Number.isNaN(parsedPrice)) {
          payload.price = parsedPrice;
        }
      }

      // For create: pick the right schema based on kind
      let activeSchema = schema;
      if (schema === MarketplaceValidation.createSchema) {
        const kind = payload.kind;
        if (kind === 'SINGLE') activeSchema = singleCreateSchema;
        else if (kind === 'SIX') activeSchema = sixCreateSchema;
        else if (kind === 'TWELVE') activeSchema = twelveCreateSchema;
        else {
          return res.status(400).json({
            success: false,
            statusCode: 400,
            error: 'Validation error',
            details: ['kind must be SINGLE, SIX, or TWELVE']
          });
        }
      }

      const { error, value } = activeSchema.validate(payload, { abortEarly: false, allowUnknown: false });
      if (error) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: 'Validation error',
          details: error.details.map(x => x.message)
        });
      }

      const validatedBody = { ...value };
      delete validatedBody.images;
      delete validatedBody.video;

      req.validatedBody = validatedBody;
      next();
    };
  }
};
