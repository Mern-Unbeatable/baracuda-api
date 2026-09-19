import Joi from 'joi';

export const NewsletterValidation = {
  subscribe: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    })
  }),

  sendCampaign: Joi.object({
    subject: Joi.string().required().custom((value, helpers) => {
      try {
        const parsed = JSON.parse(value);
        if (!parsed.en) throw new Error();
        return value;
      } catch (err) {
        return helpers.error('any.invalid');
      }
    }).messages({
      'any.invalid': 'Subject must be a valid JSON string with an "en" key'
    }),
    title: Joi.string().required().custom((value, helpers) => {
      try {
        const parsed = JSON.parse(value);
        if (!parsed.en) throw new Error();
        return value;
      } catch (err) {
        return helpers.error('any.invalid');
      }
    }).messages({
      'any.invalid': 'Title must be a valid JSON string with an "en" key'
    }),
    content: Joi.string().required().custom((value, helpers) => {
      try {
        const parsed = JSON.parse(value);
        if (!parsed.en) throw new Error();
        return value;
      } catch (err) {
        return helpers.error('any.invalid');
      }
    }).messages({
      'any.invalid': 'Content must be a valid JSON string with an "en" key'
    }),
    ctaText: Joi.string().optional(),
    ctaUrl: Joi.string().uri().optional(),
    target: Joi.string().valid('EVERYONE', 'SELECTED', 'NEW_SUBSCRIBERS').required(),
    selectedIds: Joi.string().optional() // Comma separated IDs or emails for target = SELECTED
  })
};
