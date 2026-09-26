import Joi from 'joi';

export const CategoryValidation = {
  createCategory: Joi.object({
    name: Joi.string().required().messages({
      'string.empty': 'Category name cannot be empty',
      'any.required': 'Category name is required'
    }),
    slug: Joi.string().required().messages({
      'string.empty': 'Slug cannot be empty',
      'any.required': 'Slug is required'
    }),
    description: Joi.string().optional(),
    isActive: Joi.boolean().default(true),
    sortOrder: Joi.number().integer().default(0),
    parentId: Joi.string().uuid().optional().allow(null).messages({
      'string.guid': 'Parent ID must be a valid UUID'
    })
  })
};
