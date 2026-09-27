import Joi from 'joi';

export const NewsletterValidation = {
  subscribe: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    })
  }),

  sendCampaign: Joi.object({
    subject: Joi.string().required().messages({
      'any.required': 'Subject is required'
    }),
    title: Joi.string().required().messages({
      'any.required': 'Title is required'
    }),
    content: Joi.string().required().messages({
      'any.required': 'Content is required'
    }),
    ctaText: Joi.string().optional(),
    ctaUrl: Joi.string().uri().optional(),
    target: Joi.string().valid('EVERYONE', 'SELECTED', 'NEW_SUBSCRIBERS').required(),
    selectedIds: Joi.string().optional() // Comma separated IDs or emails for target = SELECTED
  })
};
