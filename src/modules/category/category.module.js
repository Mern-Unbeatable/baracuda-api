import { Router } from 'express';
import prisma from '../../config/prisma.js';
import { CategoryService } from './category.service.js';
import { CategoryController } from './category.controller.js';
import { CategoryValidation } from './category.validation.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.middleware.js';

// Setup basic validation middleware inline or use an existing one if available.
// Assuming we create a quick inline validator if there isn't a global one exported easily:
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }
    req.validatedBody = value;
    next();
  };
};

const router = Router();
const categoryService = new CategoryService(prisma);
const categoryController = new CategoryController(categoryService);

// Public or User routes
router.get('/', categoryController.getAllCategories);

// Admin-only routes
router.post(
  '/',
  requireAuth,
  requireAdmin,
  validateBody(CategoryValidation.createCategory),
  categoryController.createCategory
);

export const CategoryModule = {
  router
};
