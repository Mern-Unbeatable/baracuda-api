import { Router } from 'express';
import { AdminPromotionController } from './admin-promotion.controller.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.middleware.js';

export class AdminPromotionModule {
  constructor() {
    this.router = Router();
    this.controller = new AdminPromotionController();
    this.initializeRoutes();
  }

  initializeRoutes() {
    // All routes require Admin privileges
    this.router.use(requireAuth, requireAdmin);

    // Get all promoted items (Artworks, Sell Photos, Products) with filtering and statistics
    this.router.get('/', this.controller.getAllPromotions);

    // Get single promotion details
    this.router.get('/:id', this.controller.getPromotionById);

    // Update / Toggle promotion status (active / inactive)
    this.router.patch('/:id/status', this.controller.updatePromotionStatus);
  }
}
