import Joi from 'joi';

export class AdvertisementValidation {
  static createSchema = Joi.object({
    name: Joi.string().required().messages({
      'string.empty': 'Name is required',
      'any.required': 'Name is required'
    }),
    email: Joi.string().email().required().messages({
      'string.empty': 'Email is required',
      'string.email': 'Valid email is required',
      'any.required': 'Email is required'
    }),
    phone: Joi.string().required().messages({
      'string.empty': 'Phone is required',
      'any.required': 'Phone is required'
    }),
    businessType: Joi.string().valid('LOCAL', 'ONLINE').required().messages({
      'any.only': 'Business type must be LOCAL or ONLINE',
      'any.required': 'Business type is required'
    }),
    businessName: Joi.string().required().messages({
      'string.empty': 'Business name is required',
      'any.required': 'Business name is required'
    }),
    selectPage: Joi.string().required().messages({
      'string.empty': 'Select page is required',
      'any.required': 'Select page is required'
    }),
    websiteUrl: Joi.when('businessType', {
      is: 'ONLINE',
      then: Joi.string().uri().required().messages({
        'string.empty': 'Website URL is required for online businesses',
        'string.uri': 'Website URL must be a valid URI',
        'any.required': 'Website URL is required for online businesses'
      }),
      otherwise: Joi.string().allow('', null).optional()
    }),
    description: Joi.string().max(200).required().messages({
      'string.empty': 'Description is required',
      'string.max': 'Description cannot exceed 200 characters',
      'any.required': 'Description is required'
    }),
    location: Joi.string().required().messages({
      'string.empty': 'Location is required',
      'any.required': 'Location is required'
    }),
    durationDays: Joi.number().valid(7, 14, 30).required().messages({
      'any.only': 'Duration must be 7, 14, or 30 days',
      'any.required': 'Duration is required'
    })
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
