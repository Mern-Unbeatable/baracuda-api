import Joi from 'joi';

export const albumTypeValidation = {
  create: Joi.object({
    kind: Joi.string().valid('SINGLE', 'SIX', 'TWELVE').required(),
    name: Joi.string().required(),
    prizeMoney: Joi.number().min(0).required(),
    entryFee: Joi.number().min(0).optional(),
    description: Joi.string().allow('', null),
    features: Joi.string().allow('', null),
    isActive: Joi.boolean().optional(),
    sortOrder: Joi.number().integer().optional(),
    iconKey: Joi.string().allow('', null).optional()
  }),
  update: Joi.object({
    name: Joi.string().required(),
    prizeMoney: Joi.number().min(0).required(),
    entryFee: Joi.number().min(0).optional(),
    description: Joi.string().allow('', null),
    features: Joi.string().allow('', null),
    isActive: Joi.boolean().optional(),
    sortOrder: Joi.number().integer().optional(),
    iconKey: Joi.string().allow('', null).optional()
  })
};
