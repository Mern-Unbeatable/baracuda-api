import { ResponseUtil } from '../../utils/response.js';

export class CategoryController {
  constructor(categoryService) {
    this.categoryService = categoryService;
  }

  createCategory = async (req, res, next) => {
    try {
      const category = await this.categoryService.createCategory(req.validatedBody);
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
}
