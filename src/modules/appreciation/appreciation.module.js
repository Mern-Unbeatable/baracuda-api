import { Router } from 'express';
import { AppreciationController } from './appreciation.controller.js';
import { appreciationService } from './appreciation.service.js';
import { AppreciationValidation } from './appreciation.validation.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { optionalAuth } from '../../middlewares/optionalAuth.middleware.js';

export class AppreciationModule {
  constructor() {
    this.router = Router();
    this.appreciationService = appreciationService;
    this.appreciationController = new AppreciationController(this.appreciationService);

    this.initializeRoutes();
  }

  initializeRoutes() {
    // Award appreciation (Gold, Silver, Bronze)
    this.router.post(
      '/award',
      requireAuth,
      AppreciationValidation.validate(AppreciationValidation.awardSchema),
      this.appreciationController.awardAppreciation
    );

    // Get appreciation stats for a photographer
    this.router.get(
      '/:userId',
      optionalAuth,
      this.appreciationController.getAppreciationStats
    );
  }
}
