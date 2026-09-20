import Joi from 'joi';

export const albumTypeValidation = {
  update: Joi.object({
    name: Joi.string().required(),
    prizeMoney: Joi.number().min(0).required(),
    description: Joi.string().allow('', null),
    features: Joi.string().allow('', null)
  })
};
