import Joi from 'joi';

export const albumTypeValidation = {
  create: Joi.object({
    kind: Joi.string().valid('SINGLE', 'SIX', 'TWELVE').required(),
    name: Joi.string().required(),
    prizeMoney: Joi.number().min(0).required(),
    description: Joi.string().allow('', null),
    features: Joi.string().allow('', null)
  }),
  update: Joi.object({
    name: Joi.string().required(),
    prizeMoney: Joi.number().min(0).required(),
    description: Joi.string().allow('', null),
    features: Joi.string().allow('', null)
  })
};
