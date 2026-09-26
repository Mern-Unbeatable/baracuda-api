import { ResponseUtil } from '../../utils/response.js';

export class CategoryController {
  constructor(categoryService) {
    this.categoryService = categoryService;
  }

  createCategory = async (req, res, next) => {
    try {
      const sourceLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';
      const category = await this.categoryService.createCategory(req.validatedBody, sourceLang);
      const isSubcategory = !!req.validatedBody.parentId;
      const message = isSubcategory ? 'Subcategory created successfully' : 'Category created successfully';
      
      return ResponseUtil.success(res, message, category, 201);
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('not found')) {
        return ResponseUtil.error(res, err.message, 400);
      }
      next(err);
    }
  }

  getAllCategories = async (req, res, next) => {
    try {
      const categories = await this.categoryService.getAllCategories();
      return ResponseUtil.success(res, 'Categories retrieved successfully', categories);
    } catch (err) {
      next(err);
    }
  }

  deleteCategory = async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id) {
        return ResponseUtil.error(res, 'Category ID is required', 400);
      }
      await this.categoryService.deleteCategory(id);
      return ResponseUtil.success(res, 'Category deleted successfully', null);
    } catch (err) {
      if (err.message.includes('not found')) {
        return ResponseUtil.error(res, err.message, 404);
      }
      next(err);
    }
  }
}
