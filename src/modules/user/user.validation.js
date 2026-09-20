import Joi from 'joi';

export const userValidation = {
  updateStatus: Joi.object({
    status: Joi.string().valid('ACTIVE', 'SUSPENDED').required(),
    reason: Joi.string().when('status', {
      is: 'SUSPENDED',
      then: Joi.string().required().messages({
        'any.required': 'Reason is required when suspending a user',
        'string.empty': 'Reason is required when suspending a user'
      }),
      otherwise: Joi.string().optional().allow(null, '')
    })
  })
};
