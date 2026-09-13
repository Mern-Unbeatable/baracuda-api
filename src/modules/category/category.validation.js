import Joi from 'joi';

export const CategoryValidation = {
  createCategory: Joi.object({
    name: Joi.object().required().messages({
      'any.required': 'Category name object is required'
    }),
    slug: Joi.string().required().messages({
      'string.empty': 'Slug cannot be empty',
      'any.required': 'Slug is required'
    }),
    description: Joi.object().optional(),
    isActive: Joi.boolean().default(true),
    sortOrder: Joi.number().integer().default(0),
    parentId: Joi.string().uuid().optional().allow(null).messages({
      'string.guid': 'Parent ID must be a valid UUID'
    })
  })
};
