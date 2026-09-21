import Joi from 'joi';

const popularPlatforms = [
  { name: 'facebook', regex: /facebook\.com/i },
  { name: 'instagram', regex: /instagram\.com/i },
  { name: 'twitter', regex: /(twitter\.com|x\.com)/i },
  { name: 'tiktok', regex: /tiktok\.com/i },
  { name: 'youtube', regex: /youtube\.com/i },
  { name: 'linkedin', regex: /linkedin\.com/i },
  { name: 'snapchat', regex: /snapchat\.com/i },
  { name: 'pinterest', regex: /pinterest\.com/i },
  { name: 'reddit', regex: /reddit\.com/i }
];

const parseSocialLinks = (value, helpers) => {
  try {
    let urls = value;
    if (typeof value === 'string') {
      urls = JSON.parse(value);
    }
    if (!Array.isArray(urls)) {
      return helpers.message('socialLinks must be a JSON array of URLs');
    }
    const result = {};
    for (const url of urls) {
      try { new URL(url); } catch (e) { return helpers.message(`Invalid URL format: ${url}`); }
      let matched = false;
      for (const platform of popularPlatforms) {
        if (platform.regex.test(url)) {
          result[platform.name] = url;
          matched = true;
          break;
        }
      }
      if (!matched) {
        return helpers.message(`Unsupported social media platform for URL: ${url}`);
      }
    }
    return result;
  } catch (e) {
    return helpers.message('socialLinks must be a valid JSON array of strings');
  }
};

export class CampaignValidation {
  static createLinkSchema = Joi.object({});

  static getLinksQuerySchema = Joi.object({
    status: Joi.string().valid('ALL', 'ACTIVE', 'USED', 'EXPIRED').default('ALL'),
    dateCreated: Joi.string().valid('LAST_7_DAYS', 'LAST_10_DAYS', 'LAST_15_DAYS', 'LAST_30_DAYS', 'ALL').default('ALL'),
    requirements: Joi.string().valid('ALL', 'COMPLETED', 'INCOMPLETE').default('ALL'),
    rewardStatus: Joi.string().valid('ALL', 'NOT_ELIGIBLE', 'PAID', 'UNDER_REVIEW').default('ALL'),
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).default(10)
  });

  static changeRewardSchema = Joi.object({
    status: Joi.string().valid('PAID', 'NOT_ELIGIBLE').required().messages({
      'any.only': 'Status must be PAID or NOT_ELIGIBLE',
      'any.required': 'Status is required'
    })
  });

  static submitCampaignSchema = Joi.object({
    fullName: Joi.string().required(),
    username: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().optional().allow('', null),
    country: Joi.string().optional().allow('', null),
    paypalAccount: Joi.string().required(),
    about: Joi.string().optional().allow('', null),
    socialLinks: Joi.any().custom(parseSocialLinks).optional().allow('', null),
    password: Joi.string().min(6).required()
  }).unknown(true); // Allow unknown for file paths and metadata keys

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

  static validateQuery(schema) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.query, { abortEarly: false, allowUnknown: true });
      if (error) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: error.details.map(e => e.message).join(', ')
        });
      }
      for (const key of Object.keys(req.query)) {
        delete req.query[key];
      }
      Object.assign(req.query, value);
      next();
    };
  }
}
